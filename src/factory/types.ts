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
  | "env_example"
  | "other_config";

/** Inventory evidence finding kinds (localize + evidence only). */
export type InventoryFindingKind =
  | "config_surface"
  | "ci_secret_pattern"
  | "env_example_honesty"
  | "dependency_harness"
  | "agent_harness";

export type InventoryFindingSeverity = "note" | "warning";

export interface InventoryFinding {
  id: string;
  kind: InventoryFindingKind;
  severity: InventoryFindingSeverity;
  /** Repo-relative path */
  path: string;
  title: string;
  /** Human note — never contains secret values or exploit steps */
  summary: string;
  /** Pattern name only (e.g. secrets.NPM_TOKEN) — never the value */
  pattern?: string;
  /** Optional 1-based line for SARIF region */
  startLine?: number;
  tags?: string[];
}

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
  /** Evidence findings (secret *patterns*, env honesty, harness risks) */
  findings: InventoryFinding[];
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
    localFirstDefault: true;
  };
}

export interface InventorySkipEntry {
  id: string;
  reason: string;
}

/** Multi-repo / Desk slice B inventory (feeds locate planning). */
export interface MultiRepoInventoryArtifact {
  schemaVersion: "zeroday-config-inventory/v1";
  generatedAt: string;
  repoCount: number;
  repos: InventoryArtifact[];
  skipped: InventorySkipEntry[];
  /** Global ranked hotspots across all repos */
  rankedHotspots: Array<
    ConfigHotspot & { repoRoot: string; repoId: string; rank: number }
  >;
  /** Flattened findings across repos (redact-ready) */
  findings: Array<InventoryFinding & { repoId: string }>;
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
  /** When true, missing path is skipped instead of failing */
  optional?: boolean;
}

export interface InventoryManifest {
  schemaVersion?: string;
  repos: InventoryManifestRepo[];
  /** Explicitly parked targets (documented, not scanned) */
  skip?: InventorySkipEntry[];
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
