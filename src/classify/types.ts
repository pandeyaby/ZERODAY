/**
 * Classification labels for the Splunk+Cisco CISO rollup.
 *
 * These are fixture-driven classifier OUTPUTS for human review —
 * not live SOC detection of adversaries or agent misfires in production.
 */

export type ClassificationLabel =
  | "possible_breach"
  | "infra_failure"
  | "software_defect"
  | "agent_misfire"
  | "needs_human";

export const CLASSIFICATION_LABELS: ClassificationLabel[] = [
  "possible_breach",
  "infra_failure",
  "software_defect",
  "agent_misfire",
  "needs_human",
];

export interface ClassificationEvidence {
  kind: "locate_file" | "telemetry_event" | "note";
  id: string;
  summary: string;
  /** Repo-relative path when kind=locate_file */
  filePath?: string;
  /** Telemetry event id when kind=telemetry_event */
  telemetryId?: string;
  cwe?: string;
}

export interface CisoObject {
  schema: "zeroday-ciso-v1";
  generatedAt: string;
  /** Primary label — never treat as proof without human review */
  classification: ClassificationLabel;
  /** Alias of classification for Splunk/Cisco buyers (same value) */
  finding_class: ClassificationLabel;
  /** Set when telemetry input shows east-west / lateral-shaped hops (INPUT only) */
  east_west_suspected: boolean;
  /** 0–1 heuristic confidence of the classifier rule match — not exploitability */
  confidence: number;
  /** Always true: human review required before treating label as truth */
  needs_human: true;
  human_review_required: true;
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    notLiveAdversaryProof: true;
    notProductionSoc: true;
    noAutoMerge: true;
    noPoC: true;
    fixtureDrivenClassifier: true;
    telemetryInputOnly: true;
  };
  inputs: {
    locateReport?: string;
    telemetryFixture?: string;
    advisoryId?: string;
    cweId?: string;
  };
  evidence: ClassificationEvidence[];
  next_human_action: string;
  rationale: string[];
  /** Signals the rule engine observed (for analyst transparency) */
  signals: {
    softwareDefect: boolean;
    possibleBreach: boolean;
    infraFailure: boolean;
    agentMisfire: boolean;
  };
}

/**
 * Desk E evidence pack — crash classify + evidence for human review.
 * Classification is never proof of exploitability.
 */
export interface ClassifyEvidencePack {
  schemaVersion: "zeroday-classify-evidence/v1";
  desk: "E";
  generatedAt: string;
  classification: ClassificationLabel;
  finding_class: ClassificationLabel;
  confidence: number;
  needs_human: true;
  human_review_required: true;
  east_west_suspected: boolean;
  /** Honesty rail — always true */
  classification_not_exploitability: true;
  source: {
    from: string | null;
    scenario: string | null;
    locateReport: string | null;
    telemetryFixture: string | null;
    advisoryId: string | null;
    cweId: string | null;
  };
  /** Embedded CISO rollup (same classifier output) */
  ciso: CisoObject;
  evidence: ClassificationEvidence[];
  rationale: string[];
  next_human_action: string;
  signals: CisoObject["signals"];
  posture: {
    deskE: true;
    crashClassify: true;
    classificationNotExploitability: true;
    needsHuman: true;
    humanReviewRequired: true;
    noAutoRemediate: true;
    noAutoMerge: true;
    noPoC: true;
    secretsRedacted: true;
    fixtureDrivenClassifier: true;
    localizationOnly: true;
    notLiveSoc: true;
    notExploitProof: true;
  };
}

export interface ClassifyEvidenceWriteResult {
  pack: ClassifyEvidencePack;
  ciso: CisoObject;
  outputDir: string;
  classifyJsonPath: string;
  classifyMdPath: string;
  cisoJsonPath: string;
  cisoMdPath: string;
  readmePath: string;
}
