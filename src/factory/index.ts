/**
 * ZERODAY Localization & Evidence Defense Factory.
 * inventory → locate → classify → own → (optional draft) → defend → verify
 */

export type {
  InferenceProvider,
  InventoryFile,
  CodeOwnersRule,
  InventoryArtifact,
  OwnershipHit,
  OwnershipArtifact,
  DefendCheckKind,
  DefendCheckResult,
  DefendArtifact,
  FactoryStagePaths,
  FactoryRunSummary,
  FactoryRunOptions,
} from "./types";

export {
  buildInventory,
  writeInventory,
  parseCodeowners,
  findCodeownersPath,
} from "./inventory";

export {
  buildOwnership,
  writeOwnership,
  matchCodeownersPattern,
  ownersForFile,
} from "./ownership";

export {
  buildDefendArtifact,
  writeDefendArtifact,
  collectDefendChecks,
  refuseExploitReproduction,
  runExistingTests,
} from "./defend";

export {
  resolveInferenceProvider,
  remoteInferenceAcked,
  REMOTE_INFERENCE_REQUIRED,
  NEBIUS_DOCS_HINT,
  INFERENCE_ENV_DOC,
  type ResolvedInference,
} from "./provider";

export { runFactory, type FactoryArtifacts } from "./run";
