/**
 * Hybrid live runs: ZERODAY's own analysis becomes Antares' starting context.
 *
 * Before Antares explores, ZERODAY runs its static pass on the same read-only
 * snapshot — dependency exposure from the advisory + lockfiles, vulnerable
 * functions, and rules-engine candidates — and hands the summary to Antares
 * through the official CLI's `--query` ("additional CWE-scoped security
 * instructions"). Antares still decides; afterwards each file is marked with
 * who flagged it, so a reviewer sees where the model and the rules agree.
 */

import type { AdvisoryRef, LocalizationResult, RankedFile } from "./types";
import { runRulesLocalization } from "./rules/index";

/** Keeps the instruction short enough to leave the model's context for code. */
const MAX_QUERY_CHARS = 1500;
const MAX_CANDIDATES = 8;

export interface AntaresContext {
  /** Text passed as `antares query --query`; empty when there is nothing to add. */
  query: string;
  /** The static pass it came from. */
  rules: LocalizationResult;
}

export async function buildAntaresContext(
  advisory: AdvisoryRef,
  snapshotPath: string,
  opts: { offline?: boolean } = {},
): Promise<AntaresContext> {
  const rules = await runRulesLocalization(advisory, snapshotPath, { offline: opts.offline === true });
  return { query: contextQuery(advisory, rules), rules };
}

export function contextQuery(advisory: AdvisoryRef, rules: LocalizationResult): string {
  const lines: string[] = [];
  const am = rules.summary.advisoryMatch;
  if (am && am.verdict !== "not-used") {
    const pkgs = am.packages
      .filter((p) => p.affected || am.verdict !== "affected")
      .slice(0, 3)
      .map((p) => `${p.name}@${p.installed} (${p.file})`)
      .join(", ");
    lines.push(
      `- Dependency check for ${advisory.id}: ${am.verdict.replace("-", " ")}${pkgs ? ` — ${pkgs}` : ""}.` +
        (am.symbols.length ? ` Vulnerable functions named by the advisory: ${am.symbols.slice(0, 5).join(", ")}.` : ""),
    );
  }
  const candidates = rules.rankedFiles.slice(0, MAX_CANDIDATES);
  if (candidates.length) {
    lines.push("- Candidate locations from static analysis:");
    for (const f of candidates) {
      const line = f.evidence[0]?.startLine;
      lines.push(`  ${f.rank}. ${f.filePath}${line ? `:${line}` : ""} — ${f.title}`);
    }
  }
  if (!lines.length) return "";
  const text = [
    `ZERODAY pre-analysis for ${advisory.cweId} (static analysis; may be incomplete or wrong):`,
    ...lines,
    "Read these first, but confirm each by reading the code, look beyond them, and submit only files you confirm.",
  ].join("\n");
  return text.length <= MAX_QUERY_CHARS ? text : `${text.slice(0, MAX_QUERY_CHARS - 1)}…`;
}

/**
 * Marks each Antares file with `sources` and records agreement in
 * `summary.hybrid`; carries the dependency verdict over. Antares' ranking stays.
 */
export function mergeHybrid(result: LocalizationResult, ctx: AntaresContext, opts: { contextSent?: boolean } = {}): void {
  const rulesByPath = new Map(ctx.rules.rankedFiles.map((f) => [f.filePath, f]));
  const antaresPaths = new Set(result.rankedFiles.map((f) => f.filePath));
  const agreed: string[] = [];
  for (const f of result.rankedFiles) {
    const r = rulesByPath.get(f.filePath);
    f.sources = r ? ["antares", "rules"] : ["antares"];
    if (r) {
      agreed.push(f.filePath);
      f.evidence.push({ ...r.evidence[0]!, note: `Rules agree: ${r.evidence[0]?.note ?? r.title}` });
    }
  }
  const rulesOnly: RankedFile[] = ctx.rules.rankedFiles.filter((f) => !antaresPaths.has(f.filePath));
  result.summary.hybrid = {
    contextSent: opts.contextSent ?? ctx.query.length > 0,
    rulesCandidates: ctx.rules.rankedFiles.length,
    agreed,
    antaresOnly: result.rankedFiles.filter((f) => !rulesByPath.has(f.filePath)).map((f) => f.filePath),
    rulesOnly: rulesOnly.map((f) => ({
      filePath: f.filePath,
      title: f.title,
      ...(f.evidence[0]?.startLine ? { line: f.evidence[0].startLine } : {}),
    })),
  };
  if (ctx.rules.summary.advisoryMatch && !result.summary.advisoryMatch) {
    result.summary.advisoryMatch = ctx.rules.summary.advisoryMatch;
  }
}

/**
 * Several Antares runs on the same snapshot, merged by vote: files ranked in
 * more runs first, then by best rank. Each file notes how many runs ranked it.
 */
export function mergeSamples(runs: LocalizationResult[]): LocalizationResult {
  const base = runs[0]!;
  const byPath = new Map<string, { file: RankedFile; votes: number; best: number }>();
  for (const r of runs) {
    for (const f of r.rankedFiles) {
      const cur = byPath.get(f.filePath);
      if (!cur) byPath.set(f.filePath, { file: { ...f, evidence: [...f.evidence] }, votes: 1, best: f.rank });
      else {
        cur.votes += 1;
        cur.best = Math.min(cur.best, f.rank);
      }
    }
  }
  const ordered = [...byPath.values()].sort((a, b) => b.votes - a.votes || a.best - b.best || a.file.filePath.localeCompare(b.file.filePath));
  const rankedFiles = ordered.map((e, i) => ({
    ...e.file,
    rank: i + 1,
    evidence: [...e.file.evidence, { filePath: e.file.filePath, note: `Antares ranked this file in ${e.votes} of ${runs.length} runs.` }],
  }));
  const allIncomplete = runs.every((r) => r.summary.incompleteReason);
  return {
    ...base,
    rankedFiles,
    explorationTrace: runs.flatMap((r) => r.explorationTrace),
    warnings: [...base.warnings, `Merged ${runs.length} Antares runs by vote (--samples ${runs.length}).`],
    summary: {
      ...base.summary,
      findingCount: rankedFiles.length,
      terminalCallsUsed: runs.reduce((n, r) => n + r.summary.terminalCallsUsed, 0),
      incompleteReason: allIncomplete ? base.summary.incompleteReason : null,
      samples: { runs: runs.length, votes: Object.fromEntries(ordered.map((e) => [e.file.filePath, e.votes])) },
    },
  };
}
