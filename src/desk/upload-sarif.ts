/**
 * Desk upload-sarif dry-run — validates SARIF + builds Code Scanning request JSON.
 * Always dry-run; never calls GitHub / transport from Desk.
 * Live upload stays CLI (`zeroday upload-sarif`) with security_events: write.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPathAllowed,
  PathPolicyError,
} from "../lib/path-policy";
import {
  uploadSarif,
  UploadSarifError,
  UPLOAD_SARIF_POSTURE,
  type UploadSarifPayload,
  type UploadSarifResult,
} from "../locate/upload-sarif";
import { findUsableReportsDir } from "./resolve-from";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_SARIF_DESK_REPO_ROOT = path.resolve(HERE, "../..");

export const UPLOAD_SARIF_DESK_SCHEMA = "zeroday-upload-sarif-desk/v1" as const;

/** Checked-in fixture SARIF for Desk smoke when no path / last report. */
export const UPLOAD_SARIF_DESK_DEFAULT_FIXTURE = path.join(
  "fixtures",
  "locate",
  "ingest-sample",
  "sample.sarif",
);

export interface UploadSarifDeskNonClaims {
  localizationNotExploitability: true;
  needsHuman: true;
  deskDryRunOnly: true;
  neverCallsGitHubFromDesk: true;
  liveUploadCliOnly: true;
  requiresSecurityEventsWriteForLive: true;
  noGpuNoRunPod: true;
}

export interface UploadSarifDeskResult {
  schemaVersion: typeof UPLOAD_SARIF_DESK_SCHEMA;
  ok: true;
  dryRun: true;
  sarifPath: string;
  source: "sarifPath" | "last-report" | "fixture";
  message: string;
  payload: UploadSarifPayload;
  posture: typeof UPLOAD_SARIF_POSTURE;
  nonClaims: UploadSarifDeskNonClaims;
  command: string;
}

export interface UploadSarifDeskOptions {
  /** Explicit SARIF path (sandboxed). */
  sarifPath?: string;
  /** When true and no sarifPath, use fixture sample (Desk smoke). */
  fixture?: boolean;
  /** owner/repo for dry-run payload (optional; module resolves env/git). */
  repository?: string;
  ref?: string;
  commit?: string;
  toolName?: string;
  cwd?: string;
  /**
   * Injectable transport — must never be invoked (Desk is always dry-run).
   * Tests pass a counter to assert zero calls.
   */
  transport?: (payload: UploadSarifPayload) => UploadSarifResult;
}

export class UploadSarifDeskError extends Error {
  code: string;
  constructor(message: string, code = "UPLOAD_SARIF_DESK") {
    super(message);
    this.name = "UploadSarifDeskError";
    this.code = code;
  }
}

const NON_CLAIMS: UploadSarifDeskNonClaims = {
  localizationNotExploitability: true,
  needsHuman: true,
  deskDryRunOnly: true,
  neverCallsGitHubFromDesk: true,
  liveUploadCliOnly: true,
  requiresSecurityEventsWriteForLive: true,
  noGpuNoRunPod: true,
};

function findLastReportSarif(cwd: string): string | undefined {
  const reportsRoot = path.join(cwd, "zeroday-reports");
  const usable = findUsableReportsDir(reportsRoot);
  if (usable) {
    const candidate = path.join(usable, "report.sarif");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  if (!fs.existsSync(reportsRoot)) return undefined;
  let best: { path: string; mtime: number } | null = null;
  let children: fs.Dirent[];
  try {
    children = fs.readdirSync(reportsRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const ent of children) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const candidate = path.join(reportsRoot, ent.name, "report.sarif");
    if (!fs.existsSync(candidate)) continue;
    let mtime = 0;
    try {
      mtime = fs.statSync(candidate).mtimeMs;
    } catch {
      continue;
    }
    if (!best || mtime > best.mtime) {
      best = { path: candidate, mtime };
    }
  }
  return best?.path;
}

/**
 * Resolve SARIF for Desk dry-run:
 * 1. explicit sarifPath (sandboxed)
 * 2. newest zeroday-reports child report.sarif
 * 3. fixture sample when fixture=true or as last resort for empty body
 */
export function resolveDeskSarifPath(opts: {
  sarifPath?: string;
  fixture?: boolean;
  cwd?: string;
  repoRoot?: string;
}): { resolved: string; source: UploadSarifDeskResult["source"] } {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const repoRoot = opts.repoRoot ?? UPLOAD_SARIF_DESK_REPO_ROOT;

  if (opts.sarifPath?.trim()) {
    try {
      const resolved = assertPathAllowed(opts.sarifPath.trim(), {
        cwd,
        mustExist: true,
        kind: "file",
        label: "sarifPath",
      });
      return { resolved, source: "sarifPath" };
    } catch (e) {
      if (e instanceof PathPolicyError) {
        throw new UploadSarifDeskError(e.message, "PATH_POLICY");
      }
      throw e;
    }
  }

  if (opts.fixture === true) {
    const fixtureAbs = path.join(repoRoot, UPLOAD_SARIF_DESK_DEFAULT_FIXTURE);
    if (!fs.existsSync(fixtureAbs)) {
      throw new UploadSarifDeskError(
        `Fixture SARIF missing: ${fixtureAbs}`,
        "missing_sarif",
      );
    }
    return { resolved: fixtureAbs, source: "fixture" };
  }

  const last = findLastReportSarif(cwd);
  if (last) {
    try {
      const resolved = assertPathAllowed(last, {
        cwd,
        mustExist: true,
        kind: "file",
        label: "sarifPath",
      });
      return { resolved, source: "last-report" };
    } catch (e) {
      if (e instanceof PathPolicyError) {
        throw new UploadSarifDeskError(e.message, "PATH_POLICY");
      }
      throw e;
    }
  }

  // Default Desk smoke: checked-in fixture (same as omit + no reports).
  const fixtureAbs = path.join(repoRoot, UPLOAD_SARIF_DESK_DEFAULT_FIXTURE);
  if (!fs.existsSync(fixtureAbs)) {
    throw new UploadSarifDeskError(
      "No sarifPath, no zeroday-reports/*/report.sarif, and fixture SARIF missing",
      "missing_sarif",
    );
  }
  return { resolved: fixtureAbs, source: "fixture" };
}

/**
 * Always dry-run. Builds upload request JSON; never invokes transport / GitHub.
 */
export function runUploadSarifDryRun(
  opts: UploadSarifDeskOptions = {},
): UploadSarifDeskResult {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : UPLOAD_SARIF_DESK_REPO_ROOT;
  const { resolved, source } = resolveDeskSarifPath({
    sarifPath: opts.sarifPath,
    fixture: opts.fixture,
    cwd,
    repoRoot: UPLOAD_SARIF_DESK_REPO_ROOT,
  });

  let transportCalls = 0;
  const guardTransport = (
    payload: UploadSarifPayload,
  ): UploadSarifResult => {
    transportCalls += 1;
    if (opts.transport) {
      return opts.transport(payload);
    }
    throw new UploadSarifDeskError(
      "Internal error: transport invoked during Desk dry-run",
      "dry_run_transport",
    );
  };

  let result: UploadSarifResult;
  try {
    result = uploadSarif({
      sarifPath: resolved,
      repository: opts.repository,
      ref: opts.ref,
      commit: opts.commit,
      toolName: opts.toolName,
      dryRun: true,
      transport: guardTransport,
    });
  } catch (e) {
    if (e instanceof UploadSarifError) {
      throw new UploadSarifDeskError(e.message, e.code);
    }
    throw e;
  }

  if (transportCalls !== 0) {
    throw new UploadSarifDeskError(
      "Internal error: network transport was invoked during Desk dry-run",
      "dry_run_transport",
    );
  }

  if (!result.dryRun || !result.ok) {
    throw new UploadSarifDeskError(
      "Desk upload-sarif must remain dry-run",
      "LIVE_REFUSED",
    );
  }

  return {
    schemaVersion: UPLOAD_SARIF_DESK_SCHEMA,
    ok: true,
    dryRun: true,
    sarifPath: resolved,
    source,
    message: result.message,
    payload: result.payload,
    posture: UPLOAD_SARIF_POSTURE,
    nonClaims: NON_CLAIMS,
    command:
      "npm run upload-sarif -- --sarif <path> --dry-run  # live: omit --dry-run + security_events: write (CLI only)",
  };
}

export function uploadSarifDeskCatalog() {
  return {
    kind: "upload-sarif-desk-catalog" as const,
    schemaVersion: UPLOAD_SARIF_DESK_SCHEMA,
    endpoint: "POST /api/upload-sarif",
    command: "npm run upload-sarif -- --sarif <path> --dry-run",
    deskDryRunOnly: true as const,
    liveUpload: "CLI only — never from Desk; needs security_events: write",
    defaults: {
      sarifPath: UPLOAD_SARIF_DESK_DEFAULT_FIXTURE,
      dryRun: true,
    },
    body: {
      sarifPath: {
        optional: true,
        description:
          "SARIF 2.1 path (sandboxed). Omit → last zeroday-reports/*/report.sarif or fixture.",
      },
      fixture: {
        optional: true,
        description: "When true, use fixtures/locate/ingest-sample/sample.sarif",
      },
      repository: { optional: true, description: "owner/repo for dry-run payload" },
      ref: { optional: true, description: "Git ref (e.g. refs/heads/main)" },
      commit: { optional: true, description: "40-char commit SHA" },
      toolName: { optional: true, description: "Optional tool_name override" },
    },
    refused: [
      "dryRun: false",
      "live / upload without dry-run",
      "tokens / secrets",
    ],
    honesty: [
      "Desk is dry-run only — never calls GitHub from Desk",
      "live upload stays CLI with security_events: write",
      "needs_human · localization ≠ exploitability · not exploit proof",
      "fail-closed on missing / invalid SARIF",
      "no GPU / RunPod",
    ],
  };
}
