/**
 * Desk shared helpers — path resolution (real-first; --fixture for smoke).
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
