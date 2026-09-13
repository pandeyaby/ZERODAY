/**
 * ZERODAY Localization & Evidence Defense Factory.
 * inventory → locate → classify → own → (optional draft) → defend → verify
 */

export type {
  InferenceProvider,
  InventoryFile,
  CodeOwnersRule,
  ConfigSurfaceKind,
  LanguageStat,
  ConfigHotspot,
  RankedInventoryPath,
  InventoryArtifact,
  MultiRepoInventoryArtifact,
  InventoryManifest,
  InventoryManifestRepo,
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
  detectConfigSurface,
  collectConfigHotspots,
  collectLanguages,
  rankInventoryPaths,
  inventoryMarkdown,
  multiInventoryMarkdown,
  parseInventoryManifest,
  loadInventoryManifest,
  buildMultiRepoInventory,
  writeMultiRepoInventory,
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
  normalizeInferenceProvider,
  remoteInferenceAcked,
  REMOTE_INFERENCE_REQUIRED,
  REMOTE_DOCS_HINT,
  NEBIUS_DOCS_HINT,
  INFERENCE_ENV_DOC,
  type ResolvedInference,
} from "./provider";

export { runFactory, type FactoryArtifacts } from "./run";
