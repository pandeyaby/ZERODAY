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
export function mergeHybrid(result: LocalizationResult, ctx: AntaresContext): void {
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
    contextSent: ctx.query.length > 0,
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
