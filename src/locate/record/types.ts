/**
 * Org CI cassette schema (Keyless K3).
 * Redacted recordings for regression — not product mvp fixtures.
 * Localization ≠ exploitability. No PoC / exploit fields.
 */

import type {
  AdvisoryRef,
  RankedFile,
  TraceStep,
  LocalizationResult,
} from "../types";

export const ORG_CASSETTE_SCHEMA = "zeroday-org-cassette/v1" as const;

export type CassetteSourceMode = Exclude<
  LocalizationResult["mode"],
  "recording"
>;

export interface OrgCassette {
  schemaVersion: typeof ORG_CASSETTE_SCHEMA;
  /** Always true when written via `record --redact` (default ON). */
  redacted: true;
  recordedAt: string;
  /** Original locate door that produced the report. */
  sourceMode: CassetteSourceMode;
  advisory: AdvisoryRef;
  /** Repo label only — absolute paths stripped; typically `<repo>` or relative. */
  targetRepo: string;
  model: string;
  rankedFiles: RankedFile[];
  explorationTrace: TraceStep[];
  warnings: string[];
  posture: LocalizationResult["posture"];
  summary: LocalizationResult["summary"];
  /**
   * Human must review redaction before committing this cassette.
   * ZERODAY never auto-commits or uploads cassettes.
   */
  humanReviewNote: string;
}

export const HUMAN_REVIEW_NOTE =
  "Human review required before commit: confirm paths are repo-relative, " +
  "secret-shaped strings are stripped, and no customer source or tokens remain. " +
  "Org cassettes are for CI regression — not mvp product fixtures. " +
  "Never auto-commit / auto-PR / network-exfil cassettes.";

export interface RecordOptions {
  /** Locate reports directory containing report.json */
  from: string;
  /** Destination cassette JSON path */
  out: string;
  /**
   * Redaction is default ON and required for the user path.
   * Setting false refuses closed (org cassettes must be redacted).
   */
  redact?: boolean;
}
