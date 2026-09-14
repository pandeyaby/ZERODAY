/**
 * Desk slice C — agent/package hardening recommendations.
 * Recommend-only by default; optional --draft CodeGuard notes (human-gated).
 * No auto-apply · no auto-PR · no auto-merge · no PoC.
 */

export type {
  HardenCategory,
  HardenPriority,
  HardenEvidence,
  HardenCodeGuardRef,
  HardenRecommendation,
  HardenDraftNote,
  HardenSourceRefs,
  HardenReport,
  HardenWriteResult,
} from "./types";

export { HARDEN_CATEGORIES } from "./types";

export {
  isHardenFindingKind,
  toHardenRecommendations,
  emptyCategoryCounts,
  type HardenSourceFinding,
} from "./recommend";

export { draftNoteMarkdown, buildHardenDraftNotes } from "./draft";

export { toHardenMarkdown, toHardenReadme } from "./summary";

export {
  loadHardenSources,
  buildHardenReport,
  writeHardenReport,
  defaultHardenReportsDir,
} from "./package";
