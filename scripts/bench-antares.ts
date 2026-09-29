/**
 * Antares localization benchmark on real advisories (bench/antares/cases.json).
 *
 * For each case the repository is checked out at the fix commit's parent (the
 * vulnerable code, no history), then located three ways:
 *   rules   — ZERODAY's static engine alone (keyless)
 *   antares — Antares-1B alone (`antares query --cwe`)
 *   hybrid  — Antares-1B with ZERODAY's static pass sent as context (--context)
 * Ground truth: the non-test source files the fix commit changed. Only the CWE
 * is given to every arm — never the advisory text or the fix.
 *
 *   npm run bench:antares -- --arms rules                  # no GPU
 *   npm run bench:antares -- --arms rules,antares,hybrid   # endpoint via ANTARES_ENDPOINT / saved / local
 *   options: --cases GHSA-a,GHSA-b · --out <file> · --remote-inference · --repeat N
 *
 * Results are appended per (case, arm, run) to the --out JSON so an
 * interrupted GPU session resumes where it stopped.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { locate } from "../src/locate/index";

type Arm = "rules" | "antares" | "hybrid";

interface Case {
  id: string;
  cve: string | null;
  cwe: string;
  ecosystem: string;
  package: string;
  published: string;
  summary: string;
  repo: string;
  fixCommit: string;
  vulnerableCommit: string;
  groundTruth: string[];
  treeFiles: number;
  rulesCoverCwe: boolean;
}

interface RunResult {
  caseId: string;
  cwe: string;
  arm: Arm;
  run: number;
  ok: boolean;
  error?: string;
  ranked: string[];
  firstHitRank: number | null;
  hitAt1: boolean;
  hitAt3: boolean;
  recall: number;
  precision: number | null;
  seconds: number;
  toolCalls?: number;
  incomplete?: string | null;
  agreed?: string[];
  /** Hybrid arm: whether the static pass had anything to send (no rules findings → identical to Antares alone). */
  contextSent?: boolean;
  model?: string;
  at: string;
}

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const arms = (flag("--arms") ?? "rules").split(",").map((a) => a.trim()) as Arm[];
const only = flag("--cases")?.split(",");
const repeat = Number(flag("--repeat") ?? "1");
const outFile = path.resolve(flag("--out") ?? path.join(ROOT, "bench/antares/results/results.json"));
const remoteInference = args.includes("--remote-inference") || process.env.ZERODAY_REMOTE_INFERENCE_ACK === "1";
const cacheDir = path.join(process.env.ZERODAY_CACHE_DIR ?? path.join(os.homedir(), ".cache", "zeroday"), "bench-antares");

const cases = (JSON.parse(fs.readFileSync(path.join(ROOT, "bench/antares/cases.json"), "utf8")) as { cases: Case[] }).cases.filter(
  (c) => !only || only.includes(c.id),
);

function git(argv: string[], cwd: string): string {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8", timeout: 600_000 });
  if (r.status !== 0) throw new Error(`git ${argv.join(" ")}: ${r.stderr.trim().slice(0, 300)}`);
  return r.stdout;
}

/** The vulnerable tree (fix commit's parent) only — depth 1, so the fix is not in history. */
function checkout(c: Case): string {
  const dir = path.join(cacheDir, c.id);
  if (fs.existsSync(path.join(dir, ".zeroday-ready"))) return dir;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  git(["init", "-q"], dir);
  git(["remote", "add", "origin", `${c.repo}.git`], dir);
  git(["fetch", "-q", "--depth=1", "origin", c.vulnerableCommit], dir);
  git(["checkout", "-q", "FETCH_HEAD"], dir);
  fs.writeFileSync(path.join(dir, ".zeroday-ready"), c.vulnerableCommit);
  return dir;
}

function score(c: Case, ranked: string[]) {
  const truth = new Set(c.groundTruth);
  const idx = ranked.findIndex((f) => truth.has(f));
  const hits = ranked.filter((f) => truth.has(f)).length;
  return {
    firstHitRank: idx >= 0 ? idx + 1 : null,
    hitAt1: idx === 0,
    hitAt3: idx >= 0 && idx < 3,
    recall: hits / truth.size,
    precision: ranked.length ? hits / ranked.length : null,
  };
}

async function runArm(c: Case, repo: string, arm: Arm, run: number): Promise<RunResult> {
  const outputDir = path.join(path.dirname(outFile), "runs", c.id, `${arm}-${run}`);
  const t0 = Date.now();
  const base = { caseId: c.id, cwe: c.cwe, arm, run, at: new Date().toISOString() };
  try {
    const { result } = await locate({
      repo,
      advisory: c.cwe,
      outputDir,
      offline: true,
      ...(arm === "rules"
        ? { rules: true }
        : { live: true, context: arm === "hybrid", remoteInference, failOnIncomplete: false }),
    });
    const ranked = [...result.rankedFiles].sort((a, b) => a.rank - b.rank).map((f) => f.filePath);
    return {
      ...base,
      ok: true,
      ranked,
      ...score(c, ranked),
      seconds: Math.round((Date.now() - t0) / 100) / 10,
      ...(arm === "rules" ? {} : { toolCalls: result.summary.terminalCallsUsed, incomplete: result.summary.incompleteReason ?? null, model: result.model }),
      ...(result.summary.hybrid ? { agreed: result.summary.hybrid.agreed, contextSent: result.summary.hybrid.contextSent } : {}),
    };
  } catch (e) {
    return { ...base, ok: false, error: (e as Error).message.slice(0, 500), ranked: [], firstHitRank: null, hitAt1: false, hitAt3: false, recall: 0, precision: null, seconds: Math.round((Date.now() - t0) / 100) / 10 };
  }
}

function load(): RunResult[] {
  try {
    return (JSON.parse(fs.readFileSync(outFile, "utf8")) as { runs: RunResult[] }).runs;
  } catch {
    return [];
  }
}

function save(runs: RunResult[]) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ schema: "zeroday.antares-bench.results/v1", runs }, null, 1) + "\n");
}

async function main() {
const runs = load();
for (const c of cases) {
  let repo: string;
  try {
    repo = checkout(c);
  } catch (e) {
    console.log(`${c.id}: checkout failed — ${(e as Error).message}`);
    continue;
  }
  for (const arm of arms) {
    for (let r = 1; r <= repeat; r++) {
      if (runs.some((x) => x.caseId === c.id && x.arm === arm && x.run === r && x.ok)) continue;
      const res = await runArm(c, repo, arm, r);
      const i = runs.findIndex((x) => x.caseId === c.id && x.arm === arm && x.run === r);
      if (i >= 0) runs[i] = res;
      else runs.push(res);
      save(runs);
      console.log(
        `${c.cwe.padEnd(9)} ${c.id} ${arm.padEnd(7)} #${r} ` +
          (res.ok ? `hit@1=${res.hitAt1 ? "Y" : "-"} hit@3=${res.hitAt3 ? "Y" : "-"} files=${res.ranked.length} ${res.seconds}s${res.toolCalls ? ` calls=${res.toolCalls}` : ""}` : `ERROR ${res.error}`),
      );
    }
  }
}
console.log(`\n${runs.length} run(s) in ${path.relative(ROOT, outFile)} — summarize: npm run bench:antares:report`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
