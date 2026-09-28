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
  return (
    `| ${LABEL[arm] ?? arm} | ${cases} | ${rs.length} | **${pct(hit1, ok.length)}** | **${pct(hit3, ok.length)}** | ${pct(recall, ok.length)} | ${withFiles.length ? pct(prec, withFiles.length) : "—"} | ${empty} | ${incomplete + failed} | ${median(ok.map((r) => r.seconds))}s | ${calls.length ? median(calls) : "—"} |`
  );
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
lines.push("## CWEs the rules engine covers (89, 79, 22, 78, 94, 502, 918, 601)");
lines.push("");
lines.push(header);
for (const a of ARMS) lines.push(row(a, covered));
lines.push("");
lines.push("## CWEs only a model can attempt (862 missing authorization, 287 authentication, 1333 ReDoS, 1321 prototype pollution)");
lines.push("");
lines.push(header);
for (const a of ARMS) lines.push(row(a, modelOnly));
lines.push("");
lines.push("## All cases");
lines.push("");
lines.push(header);
for (const a of ARMS) lines.push(row(a, () => true));
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
    "- Advisories are recent to limit overlap with model training data; that overlap cannot be ruled out.\n" +
    "- Localization is not proof of exploitability. No exploit code is generated or run.",
);
fs.writeFileSync(outFile, lines.join("\n") + "\n");
console.log(`${runs.length} run(s) → ${path.relative(ROOT, outFile)}`);
console.log(lines.slice(0, 20).join("\n"));
