/**
 * Desk cassette:replay runner — in-process Keyless K3 prove door.
 *
 * Mirrors `npm run cassette:replay` / `zeroday cassette:replay`:
 * locate --recording → assertRecordingReplayArtifacts (fail-closed).
 * No GPU / RunPod / HF / record. Defaults to committed rules-cwe-89 cassette.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  locate,
  assertRecordingReplayArtifacts,
  CassetteReplayAssertError,
  RULES_CWE_89_CASSETTE,
} from "../locate/index";
import {
  assertAllowedReadPath,
  PathPolicyError,
} from "../lib/path-policy";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CASSETTE_REPLAY_REPO_ROOT = path.resolve(HERE, "../..");

export const CASSETTE_REPLAY_SCHEMA = "zeroday-cassette-replay/v1" as const;

export interface CassetteReplayNonClaims {
  localizationNotExploitability: true;
  needsHuman: true;
  cassetteNotExploitProof: true;
  replayOnlyNoRecord: true;
  noGpuNoRunPod: true;
  ciBadgeNotVulnProof: true;
}

export interface CassetteReplayResult {
  schemaVersion: typeof CASSETTE_REPLAY_SCHEMA;
  ok: true;
  exit: 0;
  mode: "recording";
  findingCount: number;
  rankedFile: string;
  cweId: string;
  sarifResultCount: number;
  recording: string;
  outputDir: string;
  reportPath: string;
  sarifPath: string;
  command: string;
  nonClaims: CassetteReplayNonClaims;
}

export interface CassetteReplayOptions {
  /** Org cassette path (default: committed rules-cwe-89). */
  recording?: string;
  /** Locate output directory (default: zeroday-reports/cassette-replay). */
  outputDir?: string;
  /** Pinned finding count (default: RULES_CWE_89_CASSETTE.findingCount). */
  expectFindings?: number;
  /** Pinned top-1 ranked file (default: RULES_CWE_89_CASSETTE.rankedFile). */
  expectFile?: string;
  /** Pinned advisory CWE (default: RULES_CWE_89_CASSETTE.cweId). */
  expectCwe?: string;
  /** Working directory / repo root (default: package root). */
  cwd?: string;
}

export class CassetteReplayError extends Error {
  code: string;
  exit: number;
  constructor(message: string, code = "CASSETTE_REPLAY", exit = 2) {
    super(message);
    this.name = "CassetteReplayError";
    this.code = code;
    this.exit = exit;
  }
}

const NON_CLAIMS: CassetteReplayNonClaims = {
  localizationNotExploitability: true,
  needsHuman: true,
  cassetteNotExploitProof: true,
  replayOnlyNoRecord: true,
  noGpuNoRunPod: true,
  ciBadgeNotVulnProof: true,
};

function resolveDeskReadPath(cwd: string, raw: string, label: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new CassetteReplayError(`${label} is empty`, "PATH_EMPTY");
  }
  try {
    return assertAllowedReadPath(cwd, trimmed, { label });
  } catch (e) {
    if (e instanceof PathPolicyError) {
      throw new CassetteReplayError(e.message, "PATH_POLICY", 2);
    }
    throw e;
  }
}

function resolveUnderCwd(cwd: string, raw: string, label: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new CassetteReplayError(`${label} is empty`, "PATH_EMPTY");
  }
  return path.isAbsolute(trimmed) ? trimmed : path.join(cwd, trimmed);
}

/**
 * Run cassette:replay in-process (Desk API / tests).
 * Same pinned outcomes as `npm run cassette:replay`. Fail-closed on assert mismatch.
 */
export async function runCassetteReplay(
  opts: CassetteReplayOptions = {},
): Promise<CassetteReplayResult> {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : CASSETTE_REPLAY_REPO_ROOT;
  const recordingRel = opts.recording?.trim() || RULES_CWE_89_CASSETTE.recording;
  const outputRel = opts.outputDir?.trim() || "zeroday-reports/cassette-replay";
  const findingCount =
    opts.expectFindings ?? RULES_CWE_89_CASSETTE.findingCount;
  const rankedFileWant =
    opts.expectFile?.trim() || RULES_CWE_89_CASSETTE.rankedFile;
  const cweWant = opts.expectCwe?.trim() || RULES_CWE_89_CASSETTE.cweId;

  if (!Number.isFinite(findingCount) || findingCount < 1) {
    throw new CassetteReplayError(
      `expectFindings must be a positive integer (got ${String(opts.expectFindings)})`,
      "EXPECT_FINDINGS_INVALID",
    );
  }

  // Read input: fail-closed Desk allowlist. Output dir may be tmp (Desk/API tests).
  const recording = resolveDeskReadPath(cwd, recordingRel, "recording");
  const outputDir = resolveUnderCwd(cwd, outputRel, "outputDir");

  let located;
  try {
    located = await locate({
      repo: cwd,
      advisory: "",
      recording,
      outputDir,
    });
  } catch (e) {
    const msg = (e as Error).message;
    throw new CassetteReplayError(
      `cassette:replay locate failed: ${msg}`,
      "LOCATE_FAILED",
    );
  }

  if (located.result.mode !== "recording") {
    throw new CassetteReplayError(
      `cassette:replay: locate mode want=recording got=${String(located.result.mode)}`,
      "MODE_MISMATCH",
    );
  }

  let asserted;
  try {
    asserted = assertRecordingReplayArtifacts(outputDir, {
      mode: "recording",
      findingCount,
      rankedFile: rankedFileWant,
      cweId: cweWant,
      sarifResultCount: findingCount,
    });
  } catch (e) {
    if (e instanceof CassetteReplayAssertError) {
      throw new CassetteReplayError(e.message, "ASSERT_MISMATCH", 2);
    }
    throw e;
  }

  const recordingDisplay = path.isAbsolute(recordingRel)
    ? recording
    : recordingRel.split(path.sep).join("/");

  return {
    schemaVersion: CASSETTE_REPLAY_SCHEMA,
    ok: true,
    exit: 0,
    mode: "recording",
    findingCount: asserted.findingCount,
    rankedFile: asserted.rankedFile,
    cweId: asserted.cweId,
    sarifResultCount: asserted.sarifResultCount,
    recording: recordingDisplay,
    outputDir: asserted.reportPath
      ? path.dirname(asserted.reportPath)
      : outputDir,
    reportPath: asserted.reportPath,
    sarifPath: asserted.sarifPath,
    command: "npm run cassette:replay",
    nonClaims: NON_CLAIMS,
  };
}

export function cassetteReplayCatalog() {
  return {
    kind: "cassette-replay-catalog" as const,
    schemaVersion: CASSETTE_REPLAY_SCHEMA,
    endpoint: "POST /api/cassette-replay",
    command: "npm run cassette:replay",
    defaults: {
      recording: RULES_CWE_89_CASSETTE.recording,
      findingCount: RULES_CWE_89_CASSETTE.findingCount,
      rankedFile: RULES_CWE_89_CASSETTE.rankedFile,
      cweId: RULES_CWE_89_CASSETTE.cweId,
      sarifResultCount: RULES_CWE_89_CASSETTE.sarifResultCount,
    },
    body: {
      recording: {
        optional: true,
        description: "Org cassette path (default: committed rules-cwe-89)",
      },
      outputDir: {
        optional: true,
        description: "Locate output dir (default: zeroday-reports/cassette-replay)",
      },
      expectFindings: { optional: true, description: "Pinned finding count" },
      expectFile: { optional: true, description: "Pinned top-1 ranked file" },
      expectCwe: { optional: true, description: "Pinned advisory CWE" },
    },
    honesty: [
      "needs_human · localization ≠ exploitability",
      "cassette ≠ exploit proof · replay-only (no record)",
      "no GPU / RunPod / HF · Keyless K3",
      "fail-closed on assert mismatch (exit 2)",
      "CI badge ≠ vuln proof",
    ],
  };
}
