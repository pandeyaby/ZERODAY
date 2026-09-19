/**
 * DIPTYCH adapter envelope v0.2 — ZERODAY emit-only (compose lives in DIPTYCH).
 * Source of truth: docs/diptych-onepager.md (mirrored from DIPTYCH ONEPAGER).
 *
 * Hard omit: exploit / PoC / payload / AUROC / fabricated model scores.
 */

export const DIPTYCH_SCHEMA = "0.2" as const;
export const PAIRED_PROBE_SOURCE = "zeroday" as const;

export const OPERATORS = [
  "FREEZEDRY",
  "RESEED",
  "SCHEMAX",
  "SIGNFLIP",
  "SATEXTEND",
  "HISTSWAP",
  "TRAJSWAP",
  "VARSCALE",
] as const;

export type DiptychOperator = (typeof OPERATORS)[number];
export type ControlRole = "conforming" | "violating";
export type ExpectedVerdict = "pass" | "fail" | "inconclusive";
export type Coupling = "open_loop" | "crn_closed_loop";
export type CassetteFormat = "serialize_restore" | "vcr_json" | "none";

export type DecisionFingerprint = `sha256:${string}`;

export type CoverageCellStatus =
  | "green"
  | "deferred"
  | "pending"
  | "stub";

export interface CassetteRef {
  format: CassetteFormat;
  /** Repo-relative: diptych-probes/<OP>/<role>/cassette.json|.bin */
  bytes_or_path: string;
}

export interface TraceMeta {
  freeze_channels?: string[];
  decision_fingerprint?: DecisionFingerprint;
  rule_ids?: string[];
  sarif_result_count?: number;
  grade_sarif_keys?: string[];
  seed?: string;
  epsilon?: number;
  required_schema_keys?: string[];
  signflip_channel?: string;
  sat_lo?: number;
  sat_hi?: number;
  hist_splice_at?: number;
  traj_swap_at?: number;
  residual_eps?: number;
  var_scale?: number;
  var_eps?: number;
  mean_finding_count?: number;
  stability_floor?: number;
  /** Honest deferral — does NOT count as green. */
  inconclusive_reason?: string;
  deferred_without_semantic_witness?: boolean;
  [key: string]: unknown;
}

export interface TraceChannels {
  sarif_fingerprint?: { keys: string[] };
  decisions?: { values: unknown[] };
  schema?: { keys: string[] };
  stability?: { values: number[] };
  history?: { values: unknown[] };
  trajectory?: Record<string, unknown>;
  closed_loop_residual?: { values: number[] };
  variance_proxy?: { values: number[] };
  /** Named continuous target for SIGNFLIP / SATEXTEND. */
  [channel: string]: unknown;
}

export interface PairedProbeTrace {
  trace_id: string;
  events: unknown[];
  channels: TraceChannels;
  meta: TraceMeta;
}

/** ZeroDay→DIPTYCH probe-pair envelope (diptych_schema 0.2). */
export interface DiptychPairedProbeEnvelope {
  diptych_schema: typeof DIPTYCH_SCHEMA;
  source: typeof PAIRED_PROBE_SOURCE;
  operator: DiptychOperator;
  coupling: Coupling;
  horizon: { unit: "steps" | "ms" | "events"; length: number };
  probe_id: string;
  fixture_id: string;
  control_role: ControlRole;
  cassette: CassetteRef;
  traces: PairedProbeTrace[];
  expected_verdict: ExpectedVerdict;
  limits: {
    localizationOnly: true;
    notExploitability: true;
    noPoC: true;
  };
}

export interface OperatorCoverageCell {
  status: CoverageCellStatus;
  /** One-line hyperproperty + semantic-witness justification. */
  justification: string;
  conforming_path: string;
  violating_path: string;
}

export interface ZerodayCoverageMatrix {
  diptych_schema: typeof DIPTYCH_SCHEMA;
  source: typeof PAIRED_PROBE_SOURCE;
  operators: Record<DiptychOperator, OperatorCoverageCell>;
}
