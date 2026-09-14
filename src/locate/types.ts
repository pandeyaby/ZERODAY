/**
 * ZERODAY Antares localization types.
 * Localization ≠ exploitability. No PoC / payload fields exist here by design.
 */

export type AdvisoryKind = "cwe" | "cve" | "ghsa";

export interface AdvisoryRef {
  kind: AdvisoryKind;
  /** Normalized id, e.g. CWE-89, CVE-2024-1234, GHSA-xxxx-xxxx-xxxx */
  id: string;
  /** Primary CWE used for Antares query / fixture matching */
  cweId: string;
  /** Optional human title */
  title?: string;
}

export interface EvidenceSpan {
  filePath: string;
  startLine?: number;
  endLine?: number;
  excerpt?: string;
  note: string;
}

export interface RankedFile {
  /** Repo-relative path */
  filePath: string;
  /** 1-based rank within this investigation (Antares submission_rank semantics) */
  rank: number;
  cweIds: string[];
  title: string;
  evidence: EvidenceSpan[];
  /** MITRE taxonomy metadata when known — not model confidence */
  likelihoodOfExploit?: string;
}

export interface TraceStep {
  step: number;
  tool: "grep" | "find" | "cat" | "ls" | "other" | "submit";
  command: string;
  summary: string;
}

export interface LocalizationResult {
  /**
   * fixture = recorded Antares smoke;
   * rules = thin in-repo heuristics (keyless real-repo);
   * ingest = third-party SARIF file ingest (keyless);
   * live = local Antares CLI;
   * agent = keyless coding-agent operator
   */
  mode: "fixture" | "live" | "agent" | "rules" | "ingest";
  advisory: AdvisoryRef;
  targetRepo: string;
  snapshotPath?: string;
  model: string;
  generatedAt: string;
  rankedFiles: RankedFile[];
  explorationTrace: TraceStep[];
  warnings: string[];
  /** Explicit product posture — always present */
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
  };
  summary: {
    findingCount: number;
    incompleteReason: string | null;
    /** Machine class for incomplete live runs (null when complete) */
    incompleteClass?:
      | "no_submit"
      | "budget_exhausted"
      | "timeout"
      | "endpoint_error"
      | "parse_failure"
      | "unknown"
      | null;
    /** Operator tips when incomplete */
    incompleteTips?: string[];
    /** Best-effort live re-query was attempted */
    recoveryAttempted?: boolean;
    terminalCallBudget: number;
    terminalCallsUsed: number;
  };
}

export interface LocateOptions {
  repo: string;
  /** Raw advisory string: CWE-89 | CVE-… | GHSA-… (optional when fromSarif set) */
  advisory: string;
  /** Force fixture (CI / no-GPU). Incompatible with --rules / --from-sarif / --live / --endpoint. */
  fixture?: boolean;
  /** Force live Antares path (also implied when endpoint is set). Requires healthy --endpoint. */
  live?: boolean;
  /**
   * Keyless real-repo heuristics (Keyless K1). Explicit --rules only.
   * Incompatible with --fixture, --from-sarif, and --live/--endpoint. Not mvp default.
   */
  rules?: boolean;
  /**
   * Local SARIF 2.1 file path (Keyless K2). Explicit --from-sarif only.
   * Incompatible with --fixture / --rules / --live / --endpoint. File path only — no network fetch.
   */
  fromSarif?: string;
  /** Skip NVD/GHSA network resolve */
  offline?: boolean;
  /** Explicit CWE when CVE/GHSA cannot be resolved */
  explicitCwe?: string;
  outputDir?: string;
  /** OpenAI-compatible completions URL — implies live; never combined with --fixture */
  endpoint?: string;
  /** Served model id (live). Defaults to fdtn-ai/antares-1b when endpoint/live is set. */
  model?: string;
  /** Antares --tool-budget (1–50) for live query; default 30 when unset */
  toolBudget?: number;
  /**
   * Exit non-zero when live run is incomplete (no explicit submit).
   * Default true for live, false for fixture. Override with --fail-on-incomplete /
   * --no-fail-on-incomplete.
   */
  failOnIncomplete?: boolean;
  /**
   * Best-effort live recovery: one re-query with raised tool-budget when the model
   * stops without submit. Default true for live. Never invents findings.
   */
  liveRecovery?: boolean;
  /** Path to extracted official Antares CLI source (optional) */
  antaresCliSource?: string;
  failOnFindings?: boolean;
  /** ASFF placeholder account */
  awsAccountId?: string;
  awsRegion?: string;
  /** Test seam: custom fetch for live endpoint probe (no repo source) */
  probeFetch?: typeof fetch;
  /** Test seam: inject probe result (skips network) */
  probeResult?: import("./completions").CompletionsProbeResult;
  /**
   * Opt-in: allow prompts / repo-derived context to a non-loopback endpoint
   * (RunPod / remote vLLM). Also accepted via ZERODAY_REMOTE_INFERENCE_ACK=1.
   */
  remoteInference?: boolean;
}
