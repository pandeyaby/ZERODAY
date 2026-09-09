/**
 * Live incomplete-submission classification — never invent findings.
 *
 * When Antares ends without submit_vulnerable_files /
 * submit_no_vulnerability_found, ZERODAY must surface *why* (best-effort)
 * and operator next steps — not a fake ranked-file list.
 */

export type IncompleteClass =
  | "no_submit"
  | "budget_exhausted"
  | "timeout"
  | "endpoint_error"
  | "parse_failure"
  | "unknown";

/** Default Antares --tool-budget for ZERODAY live path (Antares CLI default is 15). */
export const DEFAULT_LIVE_TOOL_BUDGET = 30;

/** Cap for one best-effort recovery re-query. */
export const LIVE_RECOVERY_TOOL_BUDGET = 45;

export interface IncompleteClassification {
  incomplete: boolean;
  /** Stable machine class for CLI / CI */
  class: IncompleteClass | null;
  /** Human-readable reason (safe to put in report.md) */
  reason: string | null;
  /** Operator next actions — never invent findings */
  tips: string[];
}

export interface ClassifyIncompleteInput {
  rankedFileCount: number;
  submitted: boolean;
  /** Raw Antares summary.incomplete_reason when present */
  rawIncompleteReason?: string | null;
  terminalCallsUsed?: number;
  terminalCallBudget?: number;
  /** Combined stderr/stdout snippet from antares CLI (optional) */
  cliOutput?: string | null;
  /** spawnSync status (null often means killed by timeout) */
  exitStatus?: number | null;
  timedOut?: boolean;
  /** True when report.json was missing / unreadable */
  parseFailure?: boolean;
}

const TIP_HEALTH =
  "Check completions server health: GET /v1/models → 200; smoke POST /v1/completions (not chat).";
const TIP_MPS =
  "Mac MPS: float16 sampling can NaN — use greedy decoding (`python scripts/completions_server.py`).";
const TIP_BUDGET = `Raise exploration budget: zeroday locate … --tool-budget ${LIVE_RECOVERY_TOOL_BUDGET} (Antares range 1–50).`;
const TIP_COMPLETIONS =
  "Confirm endpoint is POST /v1/completions only — /v1/chat/completions breaks the Antares tool prompt.";
const TIP_NO_FAKE =
  "Do not invent findings. Incomplete ≠ clean negative; re-run or triage the exploration trace.";
const TIP_DOCS = "See README § Live incomplete runs and docs/antares.md.";

export function defaultIncompleteTips(klass: IncompleteClass): string[] {
  switch (klass) {
    case "budget_exhausted":
      return [TIP_BUDGET, TIP_HEALTH, TIP_MPS, TIP_NO_FAKE, TIP_DOCS];
    case "timeout":
      return [
        "Increase ANTARES_REMOTE_TIMEOUT_SECONDS or reduce repo size / ignore paths.",
        TIP_HEALTH,
        TIP_BUDGET,
        TIP_NO_FAKE,
        TIP_DOCS,
      ];
    case "endpoint_error":
      return [TIP_HEALTH, TIP_COMPLETIONS, TIP_MPS, TIP_NO_FAKE, TIP_DOCS];
    case "parse_failure":
      return [
        "antares query did not write a usable report.json — inspect CLI stderr.",
        TIP_HEALTH,
        TIP_COMPLETIONS,
        TIP_NO_FAKE,
        TIP_DOCS,
      ];
    case "no_submit":
      return [TIP_BUDGET, TIP_HEALTH, TIP_MPS, TIP_COMPLETIONS, TIP_NO_FAKE, TIP_DOCS];
    case "unknown":
    default:
      return [TIP_HEALTH, TIP_BUDGET, TIP_MPS, TIP_COMPLETIONS, TIP_NO_FAKE, TIP_DOCS];
  }
}

function pickClass(blob: string, input: ClassifyIncompleteInput): IncompleteClass {
  if (input.parseFailure) return "parse_failure";
  if (
    input.timedOut ||
    input.exitStatus === null ||
    /timeout|timed out|deadline|etimedout|time limit/i.test(blob)
  ) {
    if (input.timedOut || /timeout|timed out|deadline|etimedout|time limit/i.test(blob)) {
      return "timeout";
    }
  }
  if (
    /econnrefused|enotfound|fetch failed|connection refused|502|503|504|network error|chat\/completions/i.test(
      blob,
    )
  ) {
    return "endpoint_error";
  }
  const used = input.terminalCallsUsed ?? 0;
  const budget = input.terminalCallBudget ?? 0;
  if (
    (budget > 0 && used >= budget) ||
    /budget|tool.?budget|terminal.?call|call budget|max (?:turns|steps|calls)/i.test(
      blob,
    )
  ) {
    return "budget_exhausted";
  }
  if (
    /without an explicit final submission|ended without|no explicit (final )?submission|did not submit|no submission/i.test(
      blob,
    )
  ) {
    return "no_submit";
  }
  if (/parse|invalid json|malformed report/i.test(blob)) {
    return "parse_failure";
  }
  if (input.rawIncompleteReason?.trim()) return "unknown";
  return "no_submit";
}

function reasonFor(
  klass: IncompleteClass,
  raw: string,
  used: number,
  budget: number,
): string {
  if (raw) {
    return (
      `${raw} (class=${klass}). Incomplete localization — not a clean negative. ` +
      `ZERODAY did not invent findings.`
    );
  }
  switch (klass) {
    case "budget_exhausted":
      return (
        `Exploration budget exhausted (${used}/${budget || "?"}) without ` +
        `submit_vulnerable_files / submit_no_vulnerability_found. ` +
        `Incomplete — not a clean negative. ZERODAY did not invent findings.`
      );
    case "timeout":
      return (
        "Live Antares run timed out before an explicit final submission. " +
        "Incomplete — not a clean negative. ZERODAY did not invent findings."
      );
    case "endpoint_error":
      return (
        "Completions endpoint error interrupted Antares before an explicit submission. " +
        "Incomplete — not a clean negative. ZERODAY did not invent findings."
      );
    case "parse_failure":
      return (
        "Antares did not produce a usable report.json. " +
        "Not a localization result — findings were not invented."
      );
    case "no_submit":
      return (
        "Model ended without an explicit final submission " +
        "(no submit_vulnerable_files / submit_no_vulnerability_found). " +
        "Incomplete localization — not a clean negative. ZERODAY did not invent findings."
      );
    default:
      return (
        "Live Antares run ended incomplete without an explicit submit. " +
        "ZERODAY did not invent findings."
      );
  }
}

/**
 * Classify whether a localization finished with an explicit submit.
 * Never fabricates ranked files.
 */
export function classifyIncomplete(
  input: ClassifyIncompleteInput,
): IncompleteClassification {
  if (input.parseFailure) {
    return {
      incomplete: true,
      class: "parse_failure",
      reason: reasonFor("parse_failure", "", 0, 0),
      tips: defaultIncompleteTips("parse_failure"),
    };
  }

  // Explicit submit (vulnerable files or clean-negative) → complete
  if (input.submitted) {
    return {
      incomplete: false,
      class: null,
      reason: null,
      tips: [],
    };
  }

  const raw = (input.rawIncompleteReason ?? "").trim();
  const cli = input.cliOutput ?? "";
  const blob = `${raw}\n${cli}`;
  const used = input.terminalCallsUsed ?? 0;
  const budget = input.terminalCallBudget ?? 0;
  const klass = pickClass(blob, input);

  return {
    incomplete: true,
    class: klass,
    reason: reasonFor(klass, raw, used, budget),
    tips: defaultIncompleteTips(klass),
  };
}

/** Resolve live tool budget: explicit → env → DEFAULT_LIVE_TOOL_BUDGET. */
export function resolveLiveToolBudget(explicit?: number | null): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 1) {
    return Math.min(50, Math.floor(explicit));
  }
  const env = process.env.ANTARES_TOOL_BUDGET;
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n >= 1) return Math.min(50, Math.floor(n));
  }
  return DEFAULT_LIVE_TOOL_BUDGET;
}

/**
 * Whether CLI should exit non-zero for an incomplete live run.
 * Default: true for live, false for fixture/agent.
 */
export function shouldFailOnIncomplete(opts: {
  mode: "live" | "fixture" | "agent";
  failOnIncomplete?: boolean;
  incomplete: boolean;
}): boolean {
  if (!opts.incomplete) return false;
  if (typeof opts.failOnIncomplete === "boolean") return opts.failOnIncomplete;
  return opts.mode === "live";
}

export function formatIncompleteCliBlock(c: IncompleteClassification): string {
  if (!c.incomplete) return "";
  const lines = [
    `Incomplete class : ${c.class ?? "unknown"}`,
    `Incomplete reason: ${c.reason}`,
    "Next actions:",
    ...c.tips.map((t, i) => `  ${i + 1}. ${t}`),
  ];
  return lines.join("\n");
}

/** True when a best-effort re-query is worth trying. */
export function shouldAttemptLiveRecovery(
  klass: IncompleteClass | null | undefined,
): boolean {
  return (
    klass === "no_submit" ||
    klass === "budget_exhausted" ||
    klass === "unknown"
  );
}
