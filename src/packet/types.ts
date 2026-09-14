/**
 * Desk slice A — offline security packet types.
 * Package inventory + SARIF evidence for human security-team sharing.
 * Generate only — never auto-post to Slack / GitHub / email.
 */

/** Packet classification — assigned only when inventory evidence maps clearly. */
export type PacketClassification =
  | "agent-misfire"
  | "config"
  | "dependency"
  | "unknown";

export const PACKET_CLASSIFICATIONS: PacketClassification[] = [
  "agent-misfire",
  "config",
  "dependency",
  "unknown",
];

export interface PacketFinding {
  id: string;
  /** Deterministic label from inventory kind — never guessed from free text */
  classification: PacketClassification;
  /** Why this label (evidence basis) — empty only for unknown */
  classificationBasis: string;
  severity: "note" | "warning";
  /** Original inventory finding kind */
  kind: string;
  repoId?: string;
  path: string;
  pattern?: string;
  title: string;
  /** Human note — secrets redacted; no PoC/exploit steps */
  summary: string;
  startLine?: number;
  tags?: string[];
}

export interface PacketPlaceholders {
  /** Fill before sharing with security team */
  moduleLink: string;
  prLink: string;
  ticketLink: string;
}

export interface PacketSourceRefs {
  reportsDir: string;
  inventoryJson: string | null;
  caseNote: string | null;
  sarifPaths: string[];
}

export interface SecurityPacket {
  schemaVersion: "zeroday-security-packet/v1";
  desk: "A";
  generatedAt: string;
  source: PacketSourceRefs;
  findings: PacketFinding[];
  classificationCounts: Record<PacketClassification, number>;
  placeholders: PacketPlaceholders;
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
    noAutoSend: true;
    secretsRedacted: true;
    needsHuman: true;
    hardenNotesOnly: true;
  };
}

export interface PacketWriteResult {
  packet: SecurityPacket;
  outputDir: string;
  packetJsonPath: string;
  summaryPath: string;
  findingsJsonPath: string;
  findingsMdPath: string;
  sarifPaths: string[];
  readmePath: string;
}
