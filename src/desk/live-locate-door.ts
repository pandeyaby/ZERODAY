/**
 * Desk Prove Door F — fail-closed live-locate against a local OpenAI-compatible
 * /v1 URL (tool-calls → ranked files → SARIF).
 *
 * Completions-only. No RunPod create / HF weight pull. No invented AUROC/F1.
 * Missing or unreachable endpoint → clear failure (never silent fixture fallback).
 * Contract path: mock completions server + mockAntares (no GPU).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  locate,
  defaultFixtureRepo,
} from "../locate/index";
import {
  normalizeCompletionsEndpoint,
  assertNotChatCompletions,
} from "../locate/completions";
import { loadAndValidateSarif } from "../locate/upload-sarif";

function sarifResultCountFromDoc(doc: unknown): number {
  if (!doc || typeof doc !== "object") return 0;
  const runs = (doc as { runs?: unknown }).runs;
  if (!Array.isArray(runs) || runs.length < 1) return 0;
  const results = (runs[0] as { results?: unknown })?.results;
  return Array.isArray(results) ? results.length : 0;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LIVE_LOCATE_DOOR_REPO_ROOT = path.resolve(HERE, "../..");

export const LIVE_LOCATE_DOOR_SCHEMA = "zeroday-live-locate-door/v1" as const;

export interface LiveLocateDoorNonClaims {
  localizationNotExploitability: true;
  needsHuman: true;
  noAurocFileF1OrgLatencySla: true;
  noRunPodCreateFromLiveLocateDoor: true;
  notMeasuredA40ReProof: true;
  mockPathNotLiveGpu: true;
  ciBadgeNotVulnProof: true;
  failClosedOnMissingOrBadUrl: true;
}

export interface LiveLocateDoorResult {
  schemaVersion: typeof LIVE_LOCATE_DOOR_SCHEMA;
  ok: true;
  mode: "live";
  endpoint: string;
  model: string;
  provisioned: false;
  spendUsd: null;
  mockAntares: boolean;
  toolCallsExercised: true;
  rankedFileCount: number;
  rankedFiles: string[];
  findingCount: number;
  cweId: string;
  outputDir: string;
  reportPath: string;
  jsonPath: string;
  sarifPath: string;
  sarifResultCount: number;
  command: string;
  nonClaims: LiveLocateDoorNonClaims;
}

export interface LiveLocateDoorOptions {
  /**
   * Required OpenAI-compatible /v1 base (or …/v1/completions).
   * Missing / blank → LiveLocateDoorError LIVE_URL_REQUIRED (fail-closed).
   */
  endpoint: string;
  /** Served model id (default: mock/antares-tool-calls when mockAntares). */
  model?: string;
  /** Advisory / CWE (default: CWE-89). */
  cwe?: string;
  /**
   * Repo to localize (default: fixtures/locate/demo-app).
   * Relative paths resolve under cwd.
   */
  repo?: string;
  /** Locate output directory (default: zeroday-reports/live-locate-door). */
  outputDir?: string;
  /**
   * Use in-process mock Antares tool-call loop against the endpoint.
   * Default true — CI / contract door without GPU/HF weights.
   * Set false only when YOU host a real completions brain that speaks Antares tools.
   */
  mockAntares?: boolean;
  /** Working directory / package root. */
  cwd?: string;
  /** Non-loopback hosts still need remoteInference ACK (same as live locate). */
  remoteInference?: boolean;
}

export class LiveLocateDoorError extends Error {
  code: string;
  constructor(message: string, code = "LIVE_LOCATE_DOOR") {
    super(message);
    this.name = "LiveLocateDoorError";
    this.code = code;
  }
}

const NON_CLAIMS: LiveLocateDoorNonClaims = {
  localizationNotExploitability: true,
  needsHuman: true,
  noAurocFileF1OrgLatencySla: true,
  noRunPodCreateFromLiveLocateDoor: true,
  notMeasuredA40ReProof: true,
  mockPathNotLiveGpu: true,
  ciBadgeNotVulnProof: true,
  failClosedOnMissingOrBadUrl: true,
};

function resolveUnderCwd(cwd: string, raw: string, label: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new LiveLocateDoorError(`${label} is empty`, "PATH_EMPTY");
  }
  return path.isAbsolute(trimmed) ? trimmed : path.join(cwd, trimmed);
}

/**
 * Run Door F live-locate. Fail-closed: throws LiveLocateDoorError when
 * endpoint missing, chat-only URL, unreachable host, or locate produces no
 * tool-call submit / SARIF.
 */
export async function runLiveLocateDoor(
  opts: LiveLocateDoorOptions,
): Promise<LiveLocateDoorResult> {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : LIVE_LOCATE_DOOR_REPO_ROOT;
  const endpointRaw = opts.endpoint?.trim();
  if (!endpointRaw) {
    throw new LiveLocateDoorError(
      "endpoint is required — OpenAI-compatible /v1 base for live locate (tool-calls → SARIF). " +
        "Fail-closed: missing URL is not a silent fixture/rules fallback.",
      "LIVE_URL_REQUIRED",
    );
  }

  let endpoint: string;
  try {
    assertNotChatCompletions(endpointRaw);
    endpoint = normalizeCompletionsEndpoint(endpointRaw);
  } catch (e) {
    throw new LiveLocateDoorError(
      (e as Error).message,
      "ENDPOINT_SHAPE",
    );
  }

  const mockAntares = opts.mockAntares !== false;
  const model =
    opts.model?.trim() ||
    (mockAntares ? "mock/antares-tool-calls" : "fdtn-ai/antares-1b");
  const cweId = (opts.cwe?.trim() || "CWE-89").toUpperCase();
  const repo = opts.repo?.trim()
    ? resolveUnderCwd(cwd, opts.repo, "repo")
    : defaultFixtureRepo();
  if (!fs.existsSync(repo)) {
    throw new LiveLocateDoorError(
      `repo does not exist: ${repo}`,
      "REPO_MISSING",
    );
  }
  const outputDir = resolveUnderCwd(
    cwd,
    opts.outputDir?.trim() || "zeroday-reports/live-locate-door",
    "outputDir",
  );

  let artifacts;
  try {
    artifacts = await locate({
      repo,
      advisory: cweId,
      endpoint,
      model,
      mockAntares,
      live: !mockAntares,
      remoteInference: opts.remoteInference === true,
      outputDir,
      liveRecovery: false,
      failOnIncomplete: false,
    });
  } catch (e) {
    const msg = (e as Error).message;
    const unreachable =
      /ECONNREFUSED|ENOTFOUND|fetch failed|unreachable|probe|timeout|AbortError/i.test(
        msg,
      );
    throw new LiveLocateDoorError(
      `live-locate-door locate failed: ${msg}`,
      unreachable ? "ENDPOINT_UNREACHABLE" : "LOCATE_FAILED",
    );
  }

  if (artifacts.result.mode !== "live") {
    throw new LiveLocateDoorError(
      `live-locate-door: locate mode want=live got=${String(artifacts.result.mode)} — fail-closed (no silent fixture fallback)`,
      "MODE_MISMATCH",
    );
  }

  const toolCallsExercised =
    artifacts.result.explorationTrace.some((t) => t.tool === "submit") ||
    artifacts.result.explorationTrace.some((t) =>
      /submit_vulnerable_files/i.test(t.command),
    );
  if (!toolCallsExercised) {
    throw new LiveLocateDoorError(
      "live-locate-door: no submit_vulnerable_files tool-call exercised — fail-closed",
      "TOOL_CALLS_MISSING",
    );
  }

  const rankedFiles = artifacts.result.rankedFiles.map((f) => f.filePath);
  if (rankedFiles.length < 1) {
    throw new LiveLocateDoorError(
      "live-locate-door: expected ranked files from submit — fail-closed",
      "RANKED_EMPTY",
    );
  }

  if (!fs.existsSync(artifacts.sarifPath)) {
    throw new LiveLocateDoorError(
      `live-locate-door: SARIF missing at ${artifacts.sarifPath}`,
      "SARIF_MISSING",
    );
  }

  let sarifResultCount: number;
  try {
    const loaded = loadAndValidateSarif(artifacts.sarifPath);
    sarifResultCount = sarifResultCountFromDoc(loaded.doc);
  } catch (e) {
    throw new LiveLocateDoorError(
      `live-locate-door: SARIF invalid: ${(e as Error).message}`,
      "SARIF_INVALID",
    );
  }
  if (sarifResultCount < 1) {
    throw new LiveLocateDoorError(
      "live-locate-door: SARIF has zero results — fail-closed",
      "SARIF_EMPTY",
    );
  }

  return {
    schemaVersion: LIVE_LOCATE_DOOR_SCHEMA,
    ok: true,
    mode: "live",
    endpoint,
    model,
    provisioned: false,
    spendUsd: null,
    mockAntares,
    toolCallsExercised: true,
    rankedFileCount: rankedFiles.length,
    rankedFiles,
    findingCount: artifacts.result.rankedFiles.length,
    cweId: artifacts.result.advisory.cweId || cweId,
    outputDir: artifacts.outputDir,
    reportPath: artifacts.reportPath,
    jsonPath: artifacts.jsonPath,
    sarifPath: artifacts.sarifPath,
    sarifResultCount,
    command: "zeroday live-locate-door",
    nonClaims: NON_CLAIMS,
  };
}

export function liveLocateDoorCatalog() {
  return {
    kind: "live-locate-door-catalog" as const,
    schemaVersion: LIVE_LOCATE_DOOR_SCHEMA,
    endpoint: "POST /api/live-locate-door",
    cli: "zeroday live-locate-door --endpoint <url> [--mock-antares]",
    proveDoors: "zeroday prove-doors --live-locate-url <url> (Door F; omit → skipped)",
    body: {
      endpoint: {
        required: true,
        description:
          "OpenAI-compatible /v1 base — POST /v1/completions (chat refused)",
      },
      model: { optional: true },
      cwe: { optional: true, default: "CWE-89" },
      repo: { optional: true, default: "fixtures/locate/demo-app" },
      outputDir: { optional: true },
      mockAntares: {
        optional: true,
        default: true,
        description: "CI/contract path without GPU/HF weights",
      },
    },
    honesty: [
      "needs_human · localization ≠ exploitability",
      "fail-closed on missing / bad / chat-only URL",
      "tool-calls + SARIF · no RunPod create · no invented AUROC",
      "mock path ≠ measured A40 / live GPU proof",
      "Door F skipped (not failed) in prove-doors when liveLocateUrl omitted",
    ],
  };
}
