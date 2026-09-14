/**
 * Desk slice C — agent/package hardening recommendations.
 * Recommend-only by default; optional CodeGuard-aligned draft notes.
 * Never auto-apply · never auto-PR · never auto-merge · never PoC.
 */

/** Harden recommendation category — evidence-backed from inventory/packet kinds. */
export type HardenCategory =
  | "agent-harness"
  | "package-scripts"
  | "secrets-hygiene"
  | "config-surface";

export const HARDEN_CATEGORIES: HardenCategory[] = [
  "agent-harness",
  "package-scripts",
  "secrets-hygiene",
  "config-surface",
];

export type HardenPriority = "high" | "medium" | "low";

export interface HardenEvidence {
  findingId: string;
  kind: string;
  path: string;
  repoId?: string;
  pattern?: string;
  /** Packet classification when source is Desk A */
  classification?: string;
  severity?: "note" | "warning";
  startLine?: number;
}

export interface HardenCodeGuardRef {
  ruleId: string;
  ruleFile: string;
  guidance: string;
  /** Advisory-style CWE used only for rule mapping — not exploitability proof */
  cweId?: string;
}

export interface HardenRecommendation {
  id: string;
  category: HardenCategory;
  priority: HardenPriority;
  title: string;
  /** Defensive recommendation — no PoC / exploit steps */
  recommendation: string;
  evidence: HardenEvidence;
  /** Present when --draft emits CodeGuard-aligned notes */
  codeguard?: HardenCodeGuardRef;
}

export interface HardenDraftNote {
  id: string;
  recommendationId: string;
  relativePath: string;
  title: string;
  markdown: string;
}

export interface HardenSourceRefs {
  reportsDir: string;
  inventoryJson: string | null;
  packetJson: string | null;
  findingsJson: string | null;
  caseNote: string | null;
  sarifPaths: string[];
}

export interface HardenReport {
  schemaVersion: "zeroday-harden-recommendations/v1";
  desk: "C";
  generatedAt: string;
  source: HardenSourceRefs;
  recommendations: HardenRecommendation[];
  categoryCounts: Record<HardenCategory, number>;
  draftNotes: HardenDraftNote[];
  posture: {
    recommendationsOnly: true;
    noAutoApply: true;
    noAutoPr: true;
    noAutoMerge: true;
    noPoC: true;
    secretsRedacted: true;
    needsHuman: true;
    draftNotesHumanGated: true;
    localizationOnly: true;
  };
}

export interface HardenWriteResult {
  report: HardenReport;
  outputDir: string;
  hardenJsonPath: string;
  hardenMdPath: string;
  draftDir: string | null;
  draftPaths: string[];
  readmePath: string;
}
