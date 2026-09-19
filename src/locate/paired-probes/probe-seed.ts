/**
 * Optional seed for paired-probe operators (from locate SARIF / report / vault).
 * Default CI path still uses in-repo recording fixtures when seed is omitted.
 */

import type { LocalizationResult } from "../types";

export interface PairedProbeSeed {
  /** Primary localization packet used by FREEZEDRY…VARSCALE witnesses. */
  primary: LocalizationResult;
  /**
   * Alt-history twin for HISTSWAP / TRAJSWAP mid-horizon contrast.
   * Synthesized from primary when the stranger door only has one locate artifact.
   */
  alt: LocalizationResult;
  /** Envelope fixture_id label (honest provenance, not a claim of exploitability). */
  fixtureId: string;
  /** Absolute path of the resolved SARIF or report.json on disk. */
  sourcePath: string;
  /** How the seed was resolved. */
  sourceKind: "report.json" | "sarif" | "locate-dir";
}
