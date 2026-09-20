/**
 * Desk shared helpers — path resolution (real-first; --fixture for smoke)
 * + Desk Console in-process runners for the local Operator /play UI
 * + Reports browser + org cassette record/replay (UI-2)
 * + Live brain endpoint wizard (UI-3)
 * + Prove-doors stranger:verify (POST /api/stranger-verify)
 * + Prove-doors Door B live-url probe (POST /api/live-url-probe)
 * + Prove-doors cassette:replay (POST /api/cassette-replay)
 * + Prove-doors Measured A40 evidence (GET /api/gpu-evidence)
 * + Prove Run-all-doors orchestrator (POST /api/prove-doors).
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
  LIVE_VALIDATE_DEFAULT_REPO,
  LIVE_VALIDATE_DEFAULT_CWE,
  LIVE_VALIDATE_DOCS,
  LIVE_VALIDATE_EMPTY_STATE,
  liveCatalog,
  loadLiveEndpointConfig,
  saveLiveEndpointConfig,
  applyPreset,
  isAntaresShaped,
  resolveValidateTarget,
  runLiveDoctor,
  runLiveLocate,
  runLiveValidate,
  runLiveAction,
  LiveEndpointError,
  type LiveAction,
  type LiveEndpointConfig,
  type LivePreset,
  type LivePresetId,
  type LiveResult,
  type LiveRunRequest,
  type LiveValidateResult,
  type LastGoodAntares,
  type ValidateTarget,
} from "./live-endpoint.ts";

export {
  STRANGER_VERIFY_SCHEMA,
  STRANGER_VERIFY_REPO_ROOT,
  runStrangerVerify,
  probeOperatorEndpoint,
  modelsUrlFromLiveUrl,
  strangerVerifyCatalog,
  StrangerVerifyError,
  type StrangerVerifyOptions,
  type StrangerVerifyResult,
  type StrangerVerifyDoorB,
  type StrangerVerifyProbe,
} from "./stranger-verify.ts";

export {
  LIVE_URL_PROBE_SCHEMA,
  runLiveUrlProbe,
  liveUrlProbeCatalog,
  LiveUrlProbeError,
  type LiveUrlProbeOptions,
  type LiveUrlProbeResult,
  type LiveUrlProbeNonClaims,
} from "./live-url-probe.ts";

export {
  CASSETTE_REPLAY_SCHEMA,
  CASSETTE_REPLAY_REPO_ROOT,
  runCassetteReplay,
  cassetteReplayCatalog,
  CassetteReplayError,
  type CassetteReplayOptions,
  type CassetteReplayResult,
  type CassetteReplayNonClaims,
} from "./cassette-replay.ts";

export {
  GPU_EVIDENCE_SCHEMA,
  GPU_EVIDENCE_REL,
  GPU_EVIDENCE_REPO_ROOT,
  GPU_LIVE_LOCATE_EVIDENCE_KIND,
  loadGpuEvidence,
  parseGpuLiveLocateEvidence,
  gpuEvidenceCatalog,
  GpuEvidenceError,
  type A40LiveLocateEvidence,
  type GpuEvidenceOk,
  type GpuEvidenceNonClaims,
  type LoadGpuEvidenceOptions,
} from "./gpu-evidence.ts";

export {
  PROVE_DOORS_SCHEMA,
  PROVE_DOORS_REPO_ROOT,
  runProveDoors,
  proveDoorsCatalog,
  type ProveDoorsOptions,
  type ProveDoorsResult,
  type ProveDoorAEntry,
  type ProveDoorCassetteEntry,
  type ProveDoorBEntry,
  type ProveDoorsNonClaims,
  type ProveDoorStatus,
} from "./prove-doors.ts";
