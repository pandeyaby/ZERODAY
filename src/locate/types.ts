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
  /** fixture = recorded Antares; live = local Antares CLI; agent = keyless coding-agent operator */
  mode: "fixture" | "live" | "agent";
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
    terminalCallBudget: number;
    terminalCallsUsed: number;
  };
}

export interface LocateOptions {
  repo: string;
  /** Raw advisory string: CWE-89 | CVE-… | GHSA-… */
  advisory: string;
  /** Force fixture even if live tools are available */
  fixture?: boolean;
  /** Force live Antares path (also implied when endpoint is set) */
  live?: boolean;
  /** Skip NVD/GHSA network resolve */
  offline?: boolean;
  /** Explicit CWE when CVE/GHSA cannot be resolved */
  explicitCwe?: string;
  outputDir?: string;
  /** OpenAI-compatible completions URL — implies live unless --fixture */
  endpoint?: string;
  model?: string;
  /** Path to extracted official Antares CLI source (optional) */
  antaresCliSource?: string;
  failOnFindings?: boolean;
  /** ASFF placeholder account */
  awsAccountId?: string;
  awsRegion?: string;
}
