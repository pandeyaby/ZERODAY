/**
 * Agent Operator Protocol types — keyless default path.
 * Coding agent explores read-only; ZERODAY validates + packages evidence.
 */

import type { AdvisoryRef, EvidenceSpan, LocalizationResult, RankedFile, TraceStep } from "../locate/types";

export type OperatorConfidence = "low" | "medium" | "high";

/** Agent submission schema (JSON). Validated before packaging. */
export interface OperatorSubmission {
  schemaVersion: "zeroday-operator-submission/v1";
  advisory: {
    kind: "cwe" | "cve" | "ghsa";
    id: string;
    cweId: string;
  };
  rankedFiles: Array<{
    filePath: string;
    rank: number;
    cweIds: string[];
    title: string;
    confidence: OperatorConfidence;
    evidence: Array<{
      filePath: string;
      startLine?: number;
      endLine?: number;
      excerpt: string;
      note: string;
    }>;
  }>;
  /** Always true for human review — product invariant */
  needs_human: true;
  explorationTrace?: TraceStep[];
  toolLog?: Array<{
    tool: "list" | "grep" | "read" | "other";
    command: string;
    summary?: string;
    at?: string;
  }>;
  notes?: string;
}

export interface OperatorBrief {
  schemaVersion: "zeroday-operator-brief/v1";
  runId: string;
  generatedAt: string;
  advisory: AdvisoryRef;
  targetRepo: string;
  snapshotPath: string;
  allowedTools: string[];
  forbiddenActions: string[];
  submissionSchemaPath: string;
  submissionPathHint: string;
  instructionsMarkdownPath: string;
}

export interface OperateOptions {
  repo: string;
  advisory: string;
  /** Force fixture submission (CI / offline) */
  fixture?: boolean;
  /** Path to agent submission JSON */
  from?: string;
  /** Read submission from stdin */
  stdin?: boolean;
  /** Emit brief only — do not wait for submission */
  briefOnly?: boolean;
  offline?: boolean;
  explicitCwe?: string;
  outputDir?: string;
  awsAccountId?: string;
  awsRegion?: string;
}

export interface OperateArtifacts {
  result: LocalizationResult;
  outputDir: string;
  runId: string;
  briefPath: string;
  schemaPath: string;
  instructionsPath: string;
  submissionPath: string;
  jsonPath: string;
  sarifPath: string;
  reportPath: string;
  commentPath: string;
  exportPaths: string[];
  evidenceDir: string;
  manifestPath: string;
}

export type { AdvisoryRef, EvidenceSpan, RankedFile, TraceStep, LocalizationResult };
