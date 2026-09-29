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
}

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const flag = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const inFile = path.resolve(flag("--in") ?? path.join(ROOT, "bench/antares/results/results.json"));
const outFile = path.resolve(flag("--out") ?? path.join(ROOT, "docs/antares-benchmark.md"));

const cases = (JSON.parse(fs.readFileSync(path.join(ROOT, "bench/antares/cases.json"), "utf8")) as { cases: Case[] }).cases;
const byId = new Map(cases.map((c) => [c.id, c]));
const runs = (JSON.parse(fs.readFileSync(inFile, "utf8")) as { runs: Run[] }).runs.filter((r) => byId.has(r.caseId));
const ARMS = ["rules", "antares", "hybrid"].filter((a) => runs.some((r) => r.arm === a));
const LABEL: Record<string, string> = {
  rules: "ZERODAY rules",
  antares: "Antares-1B alone",
  hybrid: "Antares-1B + ZERODAY context",
};

const rulesRun = new Map(runs.filter((r) => r.arm === "rules" && r.ok).map((r) => [r.caseId, r]));
/**
 * Whether a hybrid run actually received context. Recorded since the runner
 * added `contextSent`; for older results it is exact to infer it from the
 * rules run on the same case — context is built only from rules findings.
 */
const gotContext = (r: Run) => r.contextSent ?? (rulesRun.get(r.caseId)?.ranked.length ?? 0) > 0;

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
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
  return (
    `| ${LABEL[arm] ?? arm}${ctx} | ${cases} | ${rs.length} | **${pct(hit1, ok.length)}** | **${pct(hit3, ok.length)}** | ${pct(recall, ok.length)} | ${withFiles.length ? pct(prec, withFiles.length) : "—"} | ${empty} | ${incomplete + failed} | ${median(ok.map((r) => r.seconds))}s | ${calls.length ? median(calls) : "—"} |`
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
  return `| Antares-1B, 2 runs merged (\`--samples 2\`) | ${pairs.length} | ${pairs.length * 2} | **${pct(h1, pairs.length)}** | **${pct(h3, pairs.length)}** | ${pct(rec, pairs.length)} | — | — | — | — | — |`;
}

function eitherRow(group: (c: Case) => boolean): string | null {
  const xs = runs.filter((r) => r.arm === "antares" && r.ok && group(byId.get(r.caseId)!) && rulesRun.has(r.caseId));
  if (!xs.length) return null;
  const top3 = xs.filter((r) => r.hitAt3 || rulesRun.get(r.caseId)!.hitAt3).length;
  const any = xs.filter((r) => r.recall > 0 || rulesRun.get(r.caseId)!.recall > 0).length;
  return `| Rules + Antares-1B, both lists | ${new Set(xs.map((r) => r.caseId)).size} | ${xs.length} | — | **${pct(top3, xs.length)}** (either) | ${pct(any, xs.length)} (either) | — | — | — | — | — |`;
}

const header =
  "| Arm | Cases | Runs | Hit@1 | Hit@3 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |\n" +
  "|-----|------:|-----:|------:|------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|";

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
    "and a run scores a hit when a file the fix changed (tests excluded) is ranked. Cases: [`bench/antares/cases.json`](../bench/antares/cases.json) · " +
    "curation: [`bench/antares/curate.py`](../bench/antares/curate.py) · runner: `npm run bench:antares`.",
);
lines.push("");
if (models.length) lines.push(`Model: ${models.map((m) => `\`${m}\``).join(", ")} via \`cisco-antares-cli\`.`);
lines.push("");
lines.push("## What this shows");
lines.push("");
lines.push(
  "- **Antares reaches weaknesses the rules cannot model.** On missing authorization, authentication, ReDoS and prototype pollution the rules find nothing; Antares-1B finds the fixed file in some of them (tables below).\n" +
    "- **Antares-1B varies from run to run**, so merging runs by vote (`--samples 2`) lifts top-3 hits well above a single run. Rank-1 hits stay about the same.\n" +
    "- **Rules and Antares complement each other** — the fixed file is more often in the top 3 of *either* list than of one. `scan` and `locate --live` show both, and mark where they agree.\n" +
    "- **Sending the rules findings to Antares as context did not help** (fewer hits and lower recall where context was sent), so it is off by default (`--context` opts in). Runs where the rules had nothing to send are identical to Antares alone; the gap on model-only CWEs is run-to-run variation, which shows how noisy single runs are.",
);
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
  "**Hit@1** — a fixed file ranked first. **Hit@3** — in the top three. **Recall** — share of fixed files ranked anywhere. " +
    "**Precision** — share of ranked files that were fixed (runs that ranked something). **No answer** — ran, ranked nothing. " +
    "Per-case cells: **#1**, top-3, ranked (lower), miss (ranked only other files), none (ranked nothing).",
);
lines.push("");
lines.push("### Limits");
lines.push("");
lines.push(
  "- Ground truth is what the fix changed; a fix can touch a file that is not where the flaw is, and a flaw can span files the fix left alone.\n" +
    "- 36 cases is a small sample: one case moves Hit@1 by ~4 points per group. Read differences under ~10 points as noise.\n" +
    "- The two derived rows reuse the recorded runs: \"2 runs merged\" is the two Antares-alone passes merged by vote (what `--samples 2` does); \"both lists\" counts a hit when either the rules or that Antares run ranks a fixed file.\n" +
    "- Advisories are recent to limit overlap with model training data; that overlap cannot be ruled out.\n" +
    "- Localization is not proof of exploitability. No exploit code is generated or run.",
);
fs.writeFileSync(outFile, lines.join("\n") + "\n");
console.log(`${runs.length} run(s) → ${path.relative(ROOT, outFile)}`);
console.log(lines.slice(0, 20).join("\n"));
