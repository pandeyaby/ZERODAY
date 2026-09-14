/**
 * Desk slice A — offline security packet (share findings with security team).
 * Generate only — no auto-post. Consumes Desk B inventory reports + SARIF.
 */

export type {
  PacketClassification,
  PacketFinding,
  PacketPlaceholders,
  PacketSourceRefs,
  PacketWriteResult,
  SecurityPacket,
} from "./types";

export { PACKET_CLASSIFICATIONS } from "./types";

export {
  classifyInventoryKind,
  isPacketFindingKind,
} from "./classify";

export {
  toPacketSummary,
  toFindingsMarkdown,
  toPacketReadme,
} from "./summary";

export {
  loadPacketSources,
  toPacketFindings,
  buildSecurityPacket,
  writeSecurityPacket,
  defaultPacketReportsDir,
} from "./package";
