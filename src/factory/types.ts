/**
 * Localization & Evidence Defense Factory types.
 * Continuous loop: inventory → locate → classify → own → (optional draft) → verify.
 * Localization ≠ exploitability. No PoC / exploit / attack-path fields.
 */

import type { LocalizationResult } from "../locate/types";
import type { CisoObject } from "../classify/types";

export type InferenceProvider = "local" | "nebius";

export interface InventoryFile {
  path: string;
  bytes: number;
  kind: "source" | "manifest" | "docs" | "config" | "other";
}

export interface CodeOwnersRule {
  pattern: string;
  owners: string[];
}

export interface InventoryArtifact {
  schemaVersion: "zeroday-factory-inventory/v1";
  repoRoot: string;
  generatedAt: string;
  fileCount: number;
  files: InventoryFile[];
  manifests: string[];
  codeownersPath: string | null;
  codeownersRules: CodeOwnersRule[];
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
    localFirstDefault: true;
  };
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
  /** local (default) | nebius */
  inferenceProvider?: InferenceProvider;
  /** Completions base URL (local or Nebius) */
  endpoint?: string;
  model?: string;
  live?: boolean;
}
