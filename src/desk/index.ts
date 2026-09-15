/**
 * Desk shared helpers — path resolution (real-first; --fixture for smoke)
 * + Desk Console in-process runners for the local Operator /play UI
 * + Reports browser + org cassette record/replay (UI-2).
 */

export {
  DESK_REPO_ROOT,
  findUsableReportsDir,
  fixtureClassifyDir,
  fixtureDeskReportsDir,
  fixtureInventoryManifest,
  looksLikeDeskReportsDir,
  resolveClassifyFromPath,
  resolveDeskReportsFrom,
  resolveInventoryTarget,
  type DeskInventorySource,
  type DeskReportsSource,
  type ResolveDeskReportsOptions,
  type ResolveInventoryTargetOptions,
  type ResolvedDeskReports,
  type ResolvedInventoryTarget,
} from "./resolve-from.ts";

export {
  DESK_ACTIONS,
  deskCatalog,
  runDeskAction,
  runDeskRules,
  runDeskFromSarif,
  runDeskInventory,
  runDeskPacket,
  runDeskHarden,
  runDeskClassify,
  runDeskCraft,
  type DeskAction,
  type DeskCatalog,
  type DeskResult,
  type DeskRunRequest,
} from "./console.ts";

export {
  REPORTS_ACTIONS,
  listReports,
  previewReport,
  recordOrgCassette,
  replayOrgCassette,
  runReportsAction,
  type ReportsAction,
  type ReportsResult,
  type ReportsRunRequest,
  type ReportListEntry,
  type ReportsListResult,
  type ReportsPreviewResult,
  type ReportsRecordResult,
  type ReportsReplayResult,
} from "./reports.ts";
