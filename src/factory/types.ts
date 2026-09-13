/**
 * Localization & Evidence Defense Factory types.
 * Continuous loop: inventory → locate → classify → own → (optional draft) → verify.
 * Localization ≠ exploitability. No PoC / exploit / attack-path fields.
 */

import type { LocalizationResult } from "../locate/types";
import type { CisoObject } from "../classify/types";

/** Host-agnostic: local loopback vs any remote CUDA/vLLM endpoint (RunPod recommended). */
export type InferenceProvider = "local" | "remote";

export interface InventoryFile {
  path: string;
  bytes: number;
  kind: "source" | "manifest" | "docs" | "config" | "other";
}

export interface CodeOwnersRule {
  pattern: string;
  owners: string[];
}

/** Defensive config surfaces — inventory only; never exploit payloads. */
export type ConfigSurfaceKind =
  | "github_actions"
  | "docker"
  | "compose"
  | "package_manifest"
  | "agent_config"
  | "skill_config"
  | "codeowners"
  | "ci_config"
  | "other_config";

export interface LanguageStat {
  language: string;
  fileCount: number;
  bytes: number;
}

export interface ConfigHotspot {
  path: string;
  surface: ConfigSurfaceKind;
  /** Higher = more useful as a locate starting hint */
  score: number;
  reason: string;
}

export interface RankedInventoryPath {
  path: string;
  rank: number;
  score: number;
  surface: ConfigSurfaceKind | "source";
  reason: string;
}

export interface InventoryArtifact {
  schemaVersion: "zeroday-factory-inventory/v1";
  repoRoot: string;
  /** Optional stable id when inventoried via multi-repo manifest */
  repoId?: string;
  generatedAt: string;
  fileCount: number;
  files: InventoryFile[];
  manifests: string[];
  codeownersPath: string | null;
  codeownersRules: CodeOwnersRule[];
  /** Detected languages from source/config extensions */
  languages: LanguageStat[];
  /** Config surfaces (Actions, Docker, manifests, agent/skills, …) */
  configHotspots: ConfigHotspot[];
  /**
   * Ranked paths suitable as locate starting hints (hotspots first, then
   * high-signal source). Not vulnerability rankings / not exploit proof.
   */
  rankedPaths: RankedInventoryPath[];
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
    localFirstDefault: true;
  };
}

/** Multi-repo / Desk slice B inventory (feeds locate planning). */
export interface MultiRepoInventoryArtifact {
  schemaVersion: "zeroday-config-inventory/v1";
  generatedAt: string;
  repoCount: number;
  repos: InventoryArtifact[];
  /** Global ranked hotspots across all repos */
  rankedHotspots: Array<
    ConfigHotspot & { repoRoot: string; repoId: string; rank: number }
  >;
  /** Per-repo path hints for subsequent locate stages */
  locateHints: Array<{
    repoId: string;
    repoRoot: string;
    paths: string[];
    reason: string;
  }>;
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
    localFirstDefault: true;
    inventoryOnly: true;
  };
}

/** Manifest entry for `zeroday inventory --from` */
export interface InventoryManifestRepo {
  path: string;
  id?: string;
}

export interface InventoryManifest {
  schemaVersion?: string;
  repos: InventoryManifestRepo[];
}

export interface OwnershipHit {
  filePath: string;
  owners: string[];
  matchedPattern: string | null;
  blameHint: string | null;
}

export interface OwnershipArtifact {
  schemaVersion: "zeroday-factory-ownership/v1";
  generatedAt: string;
  hits: OwnershipHit[];
  unmatched: string[];
  reviewMarkdown: string;
  githubCommentMarkdown: string;
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    humanReviewRequired: true;
  };
}

export type DefendCheckKind =
  | "package_test_script"
  | "pytest_present"
  | "ci_workflow_present"
  | "fail_closed_posture"
  | "existing_test_run";

export interface DefendCheckResult {
  kind: DefendCheckKind;
  ok: boolean;
  summary: string;
  /** Never contains exploit/PoC reproduction steps */
  detail?: string;
}

export interface DefendArtifact {
  schemaVersion: "zeroday-factory-defend/v1";
  generatedAt: string;
  checks: DefendCheckResult[];
  ok: boolean;
  posture: {
    defendOnly: true;
    notVulnerabilityReproduction: true;
    notExploitConfirmation: true;
    failClosed: true;
  };
}

export interface FactoryStagePaths {
  inventory: string;
  inventoryMd?: string;
  locateReport?: string;
  classifyJson?: string;
  ownership: string;
  ownershipMd: string;
  ownershipComment: string;
  defend?: string;
  draft?: string;
  verifyJson: string;
  summaryJson: string;
  summaryMd: string;
}

export interface FactoryRunSummary {
  schemaVersion: "zeroday-factory-run/v1";
  runId: string;
  generatedAt: string;
  repo: string;
  advisory: string;
  stages: {
    inventory: true;
    locate: boolean;
    classify: boolean;
    ownership: boolean;
    draftFix: boolean;
    defend: boolean;
    verify: boolean;
  };
  locateMode?: LocalizationResult["mode"];
  findingCount: number;
  classification?: CisoObject["classification"];
  verifyOk: boolean;
  defendOk?: boolean;
  needsHuman: true;
  inferenceProvider: InferenceProvider;
  remoteInference: boolean;
  paths: FactoryStagePaths;
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
    keylessDefault: true;
    draftOnlyAfterExplicitAsk: true;
  };
}

export interface FactoryRunOptions {
  repo: string;
  advisory: string;
  outputDir?: string;
  /** CI-safe fixture locate (default true when no live endpoint) */
  fixture?: boolean;
  offline?: boolean;
  explicitCwe?: string;
  /** Optional classify scenario under fixtures/classify */
  classifyScenario?: string;
  /** Run defend-only harness (existing tests / fail-closed — never exploit repro) */
  defend?: boolean;
  /** Actually execute package test script when defend is on (still defend-only) */
  runTests?: boolean;
  /** Human gate for CodeGuard draft — mirrors draft-fix --i-asked-for-a-fix */
  iAskedForAFix?: boolean;
  /** Opt-in: allow prompts/repo-derived context to leave the machine for GPU endpoint */
  remoteInference?: boolean;
  /** local (default) | remote (any CUDA/vLLM host; RunPod recommended) */
  inferenceProvider?: InferenceProvider;
  /** Completions base URL (local loopback or remote with --remote-inference) */
  endpoint?: string;
  model?: string;
  live?: boolean;
}
