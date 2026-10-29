/**
 * Summarize bench/antares results: per arm, split into CWEs the rules engine
 * covers and CWEs only a model can attempt. Writes docs/antares-benchmark.md.
 *
 *   npm run bench:antares:report [-- --in <results.json> --out <file.md>]
 */

import fs from "node:fs";
import path from "node:path";

interface Run {
  caseId: string;
  cwe: string;
  arm: string;
  run: number;
  ok: boolean;
  error?: string;
  ranked: string[];
  hitAt1: boolean;
  hitAt3: boolean;
  recall: number;
  precision: number | null;
  seconds: number;
  toolCalls?: number;
  incomplete?: string | null;
  model?: string;
  contextSent?: boolean;
}
interface Case {
  id: string;
  cwe: string;
  repo: string;
  published: string;
  groundTruth: string[];
  rulesCoverCwe: boolean;
  /** Committer date of the fix commit (scripts/bench-antares-fixdates.ts). */
  fixDate?: string;
  /** Why the case is left out of every table (e.g. its only fixed file was added by the fix). */
  excluded?: string;
  /** Fixed files dropped from ground truth (added by the fix, so absent from the snapshot). */
  groundTruthDropped?: Array<{ file: string; reason: string }>;
}

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const flag = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const inFile = path.resolve(flag("--in") ?? path.join(ROOT, "bench/antares/results/results.json"));
const outFile = path.resolve(flag("--out") ?? path.join(ROOT, "docs/antares-benchmark.md"));

const allCases = (JSON.parse(fs.readFileSync(path.join(ROOT, "bench/antares/cases.json"), "utf8")) as { cases: Case[] }).cases;
const excludedCases = allCases.filter((c) => c.excluded);
const cases = allCases.filter((c) => !c.excluded);
const byId = new Map(cases.map((c) => [c.id, c]));
const runs = (JSON.parse(fs.readFileSync(inFile, "utf8")) as { runs: Run[] }).runs.filter((r) => byId.has(r.caseId));

/**
 * Score every run from its recorded ranked list against the current ground
 * truth, so a ground-truth correction in cases.json applies to every table.
 */
for (const r of runs) {
  const truth = new Set(byId.get(r.caseId)!.groundTruth);
  const idx = r.ranked.findIndex((f) => truth.has(f));
  const found = new Set(r.ranked.filter((f) => truth.has(f))).size;
  r.hitAt1 = idx === 0;
  r.hitAt3 = idx >= 0 && idx < 3;
  r.recall = found / truth.size;
  r.precision = r.ranked.length ? r.ranked.filter((f) => truth.has(f)).length / r.ranked.length : null;
}
const ARMS = ["rules", "antares", "antares2", "hybrid"].filter((a) => runs.some((r) => r.arm === a));
const LABEL: Record<string, string> = {
  rules: "ZERODAY rules",
  antares: "Antares-1B alone",
  antares2: "Antares-1B `--samples 2` (live)",
  hybrid: "Antares-1B + ZERODAY context",
};

const rulesRun = new Map(runs.filter((r) => r.arm === "rules" && r.ok).map((r) => [r.caseId, r]));
/**
 * Whether a hybrid run actually received context. Recorded since the runner
 * added `contextSent`; for older results it is inferred from the rules run on
 * the same case — context is built only from rules findings.
 */
const gotContext = (r: Run) => r.contextSent ?? (rulesRun.get(r.caseId)?.ranked.length ?? 0) > 0;

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

/** Antares-1B model card (hf.co/fdtn-ai/antares-1b): training data cutoff, VLoc Bench File F1, terminal-call budget. */
const ANTARES_DATA_CUTOFF = "2025-04-10";
const MODEL_CARD_F1 = 0.209;
const MODEL_CARD_BUDGET = 15;

/** File F1 for one run, as on the model card: a run with no files scores 0. */
const f1 = (r: Run) => {
  const p = r.precision ?? 0;
  return p > 0 && r.recall > 0 ? (2 * p * r.recall) / (p + r.recall) : 0;
};

/** Deterministic 32-bit PRNG (mulberry32): exact in IEEE doubles, unlike a 31-bit LCG multiply. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOOTSTRAP_RESAMPLES = 10_000;

/** 95% percentile interval of the mean of per-case values, resampling cases. */
function bootstrapMean(values: number[]): [number, number] | null {
  if (values.length < 5) return null;
  const rand = mulberry32(20260929);
  const stats: number[] = [];
  for (let i = 0; i < BOOTSTRAP_RESAMPLES; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++) sum += values[Math.floor(rand() * values.length)]!;
    stats.push(sum / values.length);
  }
  stats.sort((a, b) => a - b);
  return [stats[Math.floor(0.025 * stats.length)]!, stats[Math.floor(0.975 * stats.length)]!];
}

/** Per-case mean of a run value (a case's repeated runs count once). */
function perCase(rs: Run[], value: (r: Run) => number): Map<string, number> {
  const byCase = new Map<string, number[]>();
  for (const r of rs) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), value(r)]);
  return new Map([...byCase].map(([id, v]) => [id, v.reduce((a, b) => a + b, 0) / v.length]));
}

/**
 * 95% interval for a rate, by bootstrap over cases (a case's runs stay
 * together), so repeated runs of one case do not count as independent samples.
 */
const caseBootstrap = (rs: Run[], value: (r: Run) => number) => bootstrapMean([...perCase(rs, value).values()]);

/** Paired difference A − B over the cases both arms ran, with a case-bootstrap 95% interval. */
function pairedDiff(a: Run[], b: Run[], value: (r: Run) => number): { diff: number; ci: [number, number] | null; n: number } {
  const ma = perCase(a, value), mb = perCase(b, value);
  const d = [...ma].filter(([id]) => mb.has(id)).map(([id, v]) => v - mb.get(id)!);
  return { diff: d.length ? d.reduce((x, y) => x + y, 0) / d.length : 0, ci: bootstrapMean(d), n: d.length };
}
const pts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(100 * x))}`;
const measured = (c: [number, number] | null) => (c ? c[0] > 0 || c[1] < 0 : false);

const ci = (x: [number, number] | null) => (x ? ` <sub>${Math.round(100 * x[0])}–${Math.round(100 * x[1])}</sub>` : "");
const ci3 = (x: [number, number] | null) => (x ? ` <sub>${x[0].toFixed(2)}–${x[1].toFixed(2)}</sub>` : "");
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  return Math.round(v * 10) / 10;
};

function row(arm: string, group: (c: Case) => boolean): string {
  const rs = runs.filter((r) => r.arm === arm && group(byId.get(r.caseId)!));
  const ok = rs.filter((r) => r.ok);
  const cases = new Set(rs.map((r) => r.caseId)).size;
  const hit1 = ok.filter((r) => r.hitAt1).length;
  const hit3 = ok.filter((r) => r.hitAt3).length;
  const recall = ok.reduce((s, r) => s + r.recall, 0);
  const withFiles = ok.filter((r) => r.precision !== null);
  const prec = withFiles.reduce((s, r) => s + (r.precision ?? 0), 0);
  const empty = ok.filter((r) => r.ranked.length === 0).length;
  const incomplete = ok.filter((r) => r.incomplete).length;
  const failed = rs.length - ok.length;
  const calls = ok.map((r) => r.toolCalls ?? 0).filter((n) => n > 0);
  const ctx = arm === "hybrid" ? ` (context sent in ${ok.filter(gotContext).length} of ${ok.length} runs)` : "";
  const fileF1 = ok.length ? `${(ok.reduce((s, r) => s + f1(r), 0) / ok.length).toFixed(3)}${ci3(caseBootstrap(ok, f1))}` : "—";
  return (
    `| ${LABEL[arm] ?? arm}${ctx} | ${cases} | ${rs.length} | **${pct(hit1, ok.length)}**${ci(caseBootstrap(ok, (r) => Number(r.hitAt1)))} | **${pct(hit3, ok.length)}**${ci(caseBootstrap(ok, (r) => Number(r.hitAt3)))} | ${fileF1} | ${pct(recall, ok.length)} | ${withFiles.length ? pct(prec, withFiles.length) : "—"} | ${empty} | ${incomplete + failed} | ${median(ok.map((r) => r.seconds))}s | ${calls.length ? median(calls) : "—"} |`
  );
}

/**
 * Derived from runs already recorded — no extra inference:
 *  - Antares, 2 runs merged by vote (what `--samples 2` returns)
 *  - Rules + Antares: fixed file in the top 3 of either list / anywhere in either
 */
function mergedRow(group: (c: Case) => boolean): string | null {
  const ids = [...byId.keys()].filter((id) => group(byId.get(id)!));
  const pairs = ids
    .map((id) => [1, 2].map((n) => runs.find((r) => r.caseId === id && r.arm === "antares" && r.run === n && r.ok)))
    .filter((p): p is [Run, Run] => Boolean(p[0] && p[1]));
  if (!pairs.length) return null;
  let h1 = 0, h3 = 0, rec = 0;
  for (const [a, b] of pairs) {
    const votes = new Map<string, { v: number; best: number }>();
    for (const r of [a, b]) r.ranked.forEach((f, i) => {
      const e = votes.get(f);
      votes.set(f, e ? { v: e.v + 1, best: Math.min(e.best, i) } : { v: 1, best: i });
    });
    const merged = [...votes.entries()].sort((x, y) => y[1].v - x[1].v || x[1].best - y[1].best).map(([f]) => f);
    const truth = new Set(byId.get(a.caseId)!.groundTruth);
    const idx = merged.findIndex((f) => truth.has(f));
    if (idx === 0) h1++;
    if (idx >= 0 && idx < 3) h3++;
    rec += merged.filter((f) => truth.has(f)).length / truth.size;
  }
  // Rank ties (same votes) go to the file ranked higher in either run, as --samples does.
  return `| Antares-1B alone, its runs 1 and 2 merged afterwards (replay of \`--samples 2\`) | ${pairs.length} | 2 per case | **${pct(h1, pairs.length)}** | **${pct(h3, pairs.length)}** | — | ${pct(rec, pairs.length)} | — | — | — | — | — |`;
}

/** A fixed file in the top 3 of either list (up to 6 files to read), and recall of the union of both lists. */
function eitherRow(group: (c: Case) => boolean): string | null {
  const xs = runs.filter((r) => r.arm === "antares" && r.ok && group(byId.get(r.caseId)!) && rulesRun.has(r.caseId));
  if (!xs.length) return null;
  const top3 = xs.filter((r) => r.hitAt3 || rulesRun.get(r.caseId)!.hitAt3).length;
  const union = xs.reduce((s, r) => {
    const truth = byId.get(r.caseId)!.groundTruth;
    const both = new Set([...r.ranked, ...rulesRun.get(r.caseId)!.ranked]);
    return s + truth.filter((f) => both.has(f)).length / truth.length;
  }, 0);
  return `| Rules + Antares-1B (one run), both lists side by side | ${new Set(xs.map((r) => r.caseId)).size} | ${xs.length} | — | **${pct(top3, xs.length)}** (top 3 of either, up to 6 files) | — | ${pct(union, xs.length)} (union) | — | — | — | — | — |`;
}

const okRuns = (arm: string, group: (c: Case) => boolean = () => true) =>
  runs.filter((r) => r.arm === arm && r.ok && group(byId.get(r.caseId)!));
const rate = (rs: Run[], key: "hitAt1" | "hitAt3") => rs.filter((r) => r[key]).length / (rs.length || 1);
const rateCi = (rs: Run[], key: "hitAt1" | "hitAt3") => {
  const c = caseBootstrap(rs, (r) => Number(r[key]));
  return `${Math.round(100 * rate(rs, key))}%${c ? ` (95% CI ${Math.round(100 * c[0])}–${Math.round(100 * c[1])})` : ""}`;
};
const diffText = (d: { diff: number; ci: [number, number] | null }) =>
  `${pts(d.diff)} points${d.ci ? ` (95% CI ${pts(d.ci[0])} to ${pts(d.ci[1])})` : ""}`;

/** The --samples 2 bullet, from the recorded runs (all cases). */
function samplesLine(): string {
  const two = okRuns("antares2"), one = okRuns("antares");
  if (!two.length || !one.length) return "";
  const nCases = new Set(two.map((r) => r.caseId)).size;
  const passes = Math.round(two.length / nCases);
  const d = pairedDiff(two, one, (r) => Number(r.hitAt1));
  return (
    `Run live on all ${nCases} cases (${passes} pass${passes > 1 ? "es" : ""} each), it ranked the fixed file first in ${rateCi(two, "hitAt1")} of runs, against ${rateCi(one, "hitAt1")} for a single run: ` +
    `a paired difference of ${diffText(d)}. ` +
    (measured(d.ci) ? "That difference is measurable at this sample size." : "That is within the noise at this sample size, and merging costs a second run.")
  );
}

/** Antares vs rules, by group, as paired differences. */
function antaresVsRulesLine(): string {
  const a = okRuns("antares"), r = okRuns("rules");
  if (!a.length || !r.length) return "";
  const all = pairedDiff(a, r, (x) => Number(x.hitAt1));
  const mo = pairedDiff(okRuns("antares", modelOnly), okRuns("rules", modelOnly), (x) => Number(x.hitAt3));
  const cov = pairedDiff(okRuns("antares", covered), okRuns("rules", covered), (x) => Number(x.hitAt1));
  return (
    `Missing authorization, authentication, ReDoS and prototype pollution: the rules find nothing; ` +
    `Antares-1B puts a fixed file in the top 3 in ${rateCi(okRuns("antares", modelOnly), "hitAt3")} of runs (paired difference ${diffText(mo)}${measured(mo.ci) ? ", measurable" : ", not measurable at this size"}). ` +
    `Where the rules do apply, Antares vs rules on Hit@1 is ${diffText(cov)}; over all cases ${diffText(all)}` +
    `${measured(all.ci) ? "" : " — not a measurable difference at this sample size"}.`
  );
}

/** Paired differences table rows. */
function pairedRows(): string[] {
  const out: string[] = ["| Comparison | Cases | Group | Hit@1 difference <sub>95% CI</sub> | Hit@3 difference <sub>95% CI</sub> |", "|---|---:|---|---:|---:|"];
  const groups: Array<[string, (c: Case) => boolean]> = [["all", () => true], ["rules cover", covered], ["model only", modelOnly]];
  const comps: Array<[string, string, string]> = [["antares", "rules", "Antares-1B (one run) − rules"], ["antares2", "antares", "`--samples 2` − one run"], ["hybrid", "antares", "+ context − Antares alone"]];
  for (const [a, b, label] of comps) {
    if (!runs.some((r) => r.arm === a) || !runs.some((r) => r.arm === b)) continue;
    for (const [g, fn] of groups) {
      const h1 = pairedDiff(okRuns(a, fn), okRuns(b, fn), (r) => Number(r.hitAt1));
      const h3 = pairedDiff(okRuns(a, fn), okRuns(b, fn), (r) => Number(r.hitAt3));
      const cell = (d: typeof h1) => `${measured(d.ci) ? "**" : ""}${pts(d.diff)}${measured(d.ci) ? "**" : ""}${d.ci ? ` <sub>${pts(d.ci[0])} to ${pts(d.ci[1])}</sub>` : ""}`;
      out.push(`| ${label} | ${h1.n} | ${g} | ${cell(h1)} | ${cell(h3)} |`);
    }
  }
  return out;
}

const header =
  "| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |\n" +
  "|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|";

const covered = (c: Case) => c.rulesCoverCwe;
const modelOnly = (c: Case) => !c.rulesCoverCwe;
const models = [...new Set(runs.map((r) => r.model).filter(Boolean))];

const lines: string[] = [];
lines.push("# Antares localization benchmark (real advisories)");
lines.push("");
lines.push(
  `${cases.length} published GitHub-reviewed advisories across ${new Set(cases.map((c) => c.cwe)).size} CWEs, one project each, newest first ` +
    `(published ${cases.map((c) => c.published).sort()[0]} … ${cases.map((c) => c.published).sort().at(-1)}). ` +
    "Each repository is checked out at the **parent of the fix commit** (no history), every arm is given **only the CWE**, " +
    "and a run scores a hit when a file the fix modified (tests excluded) is ranked. Cases: [`bench/antares/cases.json`](../bench/antares/cases.json) · " +
    "curation: [`bench/antares/curate.py`](../bench/antares/curate.py) · runner: `npm run bench:antares`.",
);
lines.push("");
if (models.length) lines.push(`Model: ${models.map((m) => `\`${m}\``).join(", ")} via \`cisco-antares-cli\`.`);
lines.push("");
if (excludedCases.length || cases.some((c) => c.groundTruthDropped?.length)) {
  lines.push(
    `**Ground-truth corrections.** A file the fix *added* does not exist in the vulnerable snapshot, so it cannot be ranked. ` +
      (excludedCases.length
        ? `${excludedCases.length === 1 ? "One case is" : `${excludedCases.length} cases are`} left out because ${excludedCases.length === 1 ? "its only fixed file was" : "their only fixed files were"} added by the fix: ` +
          excludedCases.map((c) => `[${c.id}](https://github.com/advisories/${c.id})`).join(", ") + ". "
        : "") +
      cases
        .filter((c) => c.groundTruthDropped?.length)
        .map((c) => `[${c.id}](https://github.com/advisories/${c.id}) drops \`${c.groundTruthDropped!.map((d) => path.basename(d.file)).join("`, `")}\``)
        .join("; ") +
      ". All runs are re-scored from their recorded ranked lists.",
  );
  lines.push("");
}
lines.push("## What this shows");
lines.push("");
lines.push(
  `- **Antares reaches weaknesses the rules cannot model.** ${antaresVsRulesLine()}\n` +
    `- **Antares-1B varies from run to run**, and \`--samples 2\` runs it twice and merges by vote (\`scan\` and \`locate --live\` default to one run). ${samplesLine()}\n` +
    "- **Showing both lists helps a reviewer, at a cost.** The top 3 of *either* list holds a fixed file more often than either list alone (tables below), but that is up to 6 files to read instead of 3. `scan` and `locate --live` show both and mark where they agree.\n" +
    "- **Sending the rules findings to Antares as context did not help** (paired differences below), so it is off by default (`--context` opts in). Runs where the rules had nothing to send are identical to Antares alone; the gap on model-only CWEs is run-to-run variation, which shows how noisy single runs are.",
);
lines.push("");
const cutoffMs = Date.parse(ANTARES_DATA_CUTOFF);
const dated = cases.filter((c) => c.fixDate);
const preCutoff = dated.filter((c) => Date.parse(c.fixDate!) < cutoffMs);
const postCutoff = (c: Case) => Boolean(c.fixDate) && Date.parse(c.fixDate!) >= cutoffMs;
const earliestAfter = dated.filter(postCutoff).map((c) => c.fixDate!).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
const firstPublished = cases.map((c) => c.published).sort()[0]!;
lines.push("## Training-data overlap");
lines.push("");
if (dated.length < cases.length) {
  lines.push(
    `Antares-1B's training data ends **${ANTARES_DATA_CUTOFF}** ([model card](https://huggingface.co/fdtn-ai/antares-1b)). Every advisory was published after that ` +
      `(earliest **${firstPublished}**), but an old fix can receive a late advisory: fix-commit dates are recorded for ${dated.length} of ${cases.length} cases ` +
      "(`npm run bench:antares:fixdates`).",
  );
} else {
  lines.push(
    `Antares-1B's training data ends **${ANTARES_DATA_CUTOFF}** ([model card](https://huggingface.co/fdtn-ai/antares-1b)). ` +
      `Every advisory was published after that (earliest **${firstPublished}**), and ${cases.length - preCutoff.length} of ${cases.length} fixes were committed after it ` +
      `(earliest ${earliestAfter?.slice(0, 10)}; dates from \`npm run bench:antares:fixdates\`). ` +
      (preCutoff.length
        ? `${preCutoff.length === 1 ? "One fix predates" : `${preCutoff.length} fixes predate`} the cutoff despite a recent advisory — ` +
          preCutoff.map((c) => `[${c.id}](https://github.com/advisories/${c.id}) (${c.cwe}, fixed ${c.fixDate!.slice(0, 10)})`).join(", ") +
          " — so the model may have seen it. The table below leaves it out; the other tables include it."
        : "So the model cannot have been trained on these fixes."),
  );
  if (preCutoff.length) {
    lines.push("");
    lines.push(`### Only fixes committed after ${ANTARES_DATA_CUTOFF} (${cases.length - preCutoff.length} cases)`);
    lines.push("");
    lines.push(header);
    for (const a of ARMS) lines.push(row(a, postCutoff));
  }
}
lines.push("");
lines.push("The vulnerable code itself may predate the cutoff; the label saying where the flaw is does not.");
lines.push("");
lines.push("## Compared with the model card");
lines.push("");
{
  const one = okRuns("antares");
  const f = one.length ? one.reduce((s, r) => s + f1(r), 0) / one.length : 0;
  const c = caseBootstrap(one, f1);
  const inside = c ? c[0] <= MODEL_CARD_F1 && MODEL_CARD_F1 <= c[1] : false;
  lines.push(
    `The model card reports **File F1 ${MODEL_CARD_F1}** for Antares-1B on VLoc Bench (500 tasks, 147 CWEs, ${MODEL_CARD_BUDGET} terminal calls, mean of 3 runs). ` +
      `Here a single Antares-1B run scores **${f.toFixed(3)}**${c ? ` (95% CI ${c[0].toFixed(2)}–${c[1].toFixed(2)})` : ""}, computed the same way per run (no answer scores 0) and averaged. ` +
      (inside ? "The model card's figure is inside that interval: **no measurable difference** — read it as consistent with the card, not better. " : "") +
      `The setups differ: ${cases.length} hand-picked recent advisories across ${new Set(cases.map((c) => c.cwe)).size} CWEs, ZERODAY's default budget of 30 tool calls (not ${MODEL_CARD_BUDGET}), and ground truth limited to modified source files. ` +
      "Hit@1 / Hit@3 answer the question a reviewer asks — *is the file I read first the right one?* — and every interval here is a bootstrap over cases.",
  );
}
lines.push("");
lines.push("## CWEs the rules engine covers (89, 79, 22, 78, 94, 502, 918, 601)");
lines.push("");
lines.push(header);
for (const a of ARMS) lines.push(row(a, covered));
for (const extra of [mergedRow(covered), eitherRow(covered)]) if (extra) lines.push(extra);
lines.push("");
lines.push("## CWEs only a model can attempt (862 missing authorization, 287 authentication, 1333 ReDoS, 1321 prototype pollution)");
lines.push("");
lines.push(header);
for (const a of ARMS) lines.push(row(a, modelOnly));
for (const extra of [mergedRow(modelOnly), eitherRow(modelOnly)]) if (extra) lines.push(extra);
lines.push("");
lines.push("## All cases");
lines.push("");
lines.push(header);
for (const a of ARMS) lines.push(row(a, () => true));
for (const extra of [mergedRow(() => true), eitherRow(() => true)]) if (extra) lines.push(extra);
lines.push("");
lines.push("## Paired differences");
lines.push("");
lines.push(
  "Each comparison uses the cases both arms ran, takes the per-case difference (a case's repeated runs averaged first) and bootstraps over cases. " +
    "**Bold** means the 95% interval excludes zero. With this many comparisons, one or two may cross zero by chance.",
);
lines.push("");
lines.push(...pairedRows());
lines.push("");
lines.push("## Per case");
lines.push("");
lines.push(`| Case | CWE | Repository | Fixed file(s) | ${ARMS.map((a) => LABEL[a]).join(" | ")} |`);
lines.push(`|------|-----|------------|---------------|${ARMS.map(() => "---").join("|")}|`);
for (const c of cases) {
  const cells = ARMS.map((a) => {
    const rs = runs.filter((r) => r.caseId === c.id && r.arm === a);
    if (!rs.length) return "—";
    return rs
      .map((r) => (!r.ok ? "error" : r.hitAt1 ? "**#1**" : r.hitAt3 ? "top-3" : r.recall > 0 ? "ranked" : r.ranked.length ? "miss" : "none"))
      .join(" / ");
  });
  lines.push(
    `| [${c.id}](https://github.com/advisories/${c.id}) | ${c.cwe} | ${c.repo.replace("https://github.com/", "")} | ${c.groundTruth.map((f) => `\`${path.basename(f)}\``).join(", ")} | ${cells.join(" | ")} |`,
  );
}
lines.push("");
lines.push(
  "**Hit@1** — a fixed file ranked first. **Hit@3** — in the top three (small numbers: 95% interval, bootstrap over cases). **File F1** — per-run harmonic mean of precision and recall, averaged (as on the model card). **Recall** — share of fixed files ranked anywhere. " +
    "**Precision** — share of ranked files that were fixed (runs that ranked something). **No answer** — ran, ranked nothing. " +
    "Per-case cells: **#1**, top-3, ranked (lower), miss (ranked only other files), none (ranked nothing).",
);
lines.push("");
lines.push("### Limits");
lines.push("");
lines.push(
  "- Ground truth is what the fix changed; a fix can touch a file that is not where the flaw is, and a flaw can span files the fix left alone.\n" +
    `- ${cases.length} cases is a small sample: one case moves Hit@1 by ~3 points overall. Use the paired differences, not overlapping intervals, to compare arms, and expect one or two of the ~18 comparisons to look significant by chance.\n` +
    "- **Curation favours the rules.** Cases were chosen as the 3 newest advisories for 12 hand-picked CWEs, with 1–3 changed source files and 30–3000 files in the repository, in JavaScript/TypeScript, Python, Java and Go — the languages the rules engine reads. 8 of the 12 CWEs are ones the rules cover, so the \"all cases\" rows lean towards them.\n" +
    "- The derived rows reuse recorded runs: \"merged afterwards\" replays two Antares-alone runs through the `--samples 2` vote; it differs from the live `--samples 2` arm because live runs are separate draws. \"Both lists side by side\" counts the top 3 of either list (up to 6 files) and the recall of their union.\n" +
    "- \"Context sent\" counts for the hybrid arm are inferred from the rules run on the same case (older runs did not record them).\n" +
    `- Training-data overlap: see above (model data cutoff ${ANTARES_DATA_CUTOFF}; fix-commit dates in \`cases.json\`).\n` +
    "- Localization is not proof of exploitability. No exploit code is generated or run.",
);
fs.writeFileSync(outFile, lines.join("\n") + "\n");
console.log(`${runs.length} run(s) → ${path.relative(ROOT, outFile)}`);
console.log(lines.slice(0, 20).join("\n"));
