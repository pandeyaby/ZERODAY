/**
 * Desk shared helpers — path resolution (real-first; --fixture for smoke)
 * + Desk Console in-process runners for the local Operator /play UI
 * + Reports browser + org cassette record/replay (UI-2)
 * + Live brain endpoint wizard (UI-3).
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

export {
  LIVE_ACTIONS,
  LIVE_PRESETS,
  DESK_ENDPOINT_SCHEMA,
  DESK_ENDPOINT_REL,
  liveCatalog,
  loadLiveEndpointConfig,
  saveLiveEndpointConfig,
  applyPreset,
  runLiveDoctor,
  runLiveLocate,
  runLiveAction,
  LiveEndpointError,
  type LiveAction,
  type LiveEndpointConfig,
  type LivePreset,
  type LivePresetId,
  type LiveResult,
  type LiveRunRequest,
} from "./live-endpoint.ts";
