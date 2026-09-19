/**
 * ZERODAY → DIPTYCH paired probes (diptych_schema 0.2).
 * Emit-only adapter; no DIPTYCH operator orchestration.
 */

export {
  DIPTYCH_SCHEMA,
  PAIRED_PROBE_SOURCE,
  OPERATORS,
} from "./types";
export type {
  DiptychOperator,
  DiptychPairedProbeEnvelope,
  ZerodayCoverageMatrix,
  ControlRole,
  ExpectedVerdict,
  Coupling,
} from "./types";

export {
  decisionFingerprintFromSarif,
  decisionFingerprintFromPacket,
  normalizeSarifFindings,
  SARIF_FINGERPRINT_KEYS,
} from "./fingerprint";

export { runAllPairedProbes, JUSTIFICATIONS } from "./run-all";
export { gateEnvelopes, buildMatrix, loadEnvelope } from "./gate";
export {
  gateAxisMutate,
  gateAxisMutateOne,
  gateAxisMutateAllEight,
} from "./gate-axis-mutate";
export type { AxisMutateProof, AxisMutateFailure } from "./gate-axis-mutate";
export { ALL_REQUIRED_SCHEMA_KEYS } from "./schema-keys";
export {
  freezePacket,
  restorePacket,
  serializePacket,
  deserializePacket,
} from "./packet";

export {
  SAMPLE_GRADE_KIND,
  buildSampleDiptychGradeReport,
  renderSampleGradeMarkdown,
  writeSampleGradeReport,
  loadMatrixOrJustifications,
} from "./sample-report";
export type {
  SampleGradeCell,
  SampleDiptychGradeReport,
} from "./sample-report";
