/**
 * Stable outcome asserts for org cassette replay (Keyless K3).
 *
 * CI path: locate --recording <cassette> → assert report.json + report.sarif.
 * Record remains opt-in/local (`zeroday record`); this module is replay-only.
 */

import fs from "node:fs";
import path from "node:path";
import type { LocalizationResult } from "../types";

/** Pinned expectations for the committed rules-sample org cassette. */
export const RULES_CWE_89_CASSETTE = {
  recording: "fixtures/locate/org-recordings/rules-cwe-89.cassette.json",
  findingCount: 1,
  rankedFile: "src/search.js",
  cweId: "CWE-89",
  sarifResultCount: 1,
} as const;

export interface CassetteReplayExpectation {
  /** Expected report.json mode (always recording for cassette replay). */
  mode?: "recording";
  /** Expected summary.findingCount / rankedFiles.length */
  findingCount: number;
  /** Expected top-1 rankedFiles[0].filePath (repo-relative) */
  rankedFile: string;
  /** Expected advisory.cweId */
  cweId?: string;
  /** Expected SARIF runs[0].results.length (defaults to findingCount) */
  sarifResultCount?: number;
}

export interface CassetteReplayAssertResult {
  mode: string;
  findingCount: number;
  rankedFile: string;
  cweId: string;
  sarifResultCount: number;
  reportPath: string;
  sarifPath: string;
}

export class CassetteReplayAssertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CassetteReplayAssertError";
  }
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: missing artifact ${filePath}`,
    );
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (e) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: cannot parse ${filePath}: ${(e as Error).message}`,
    );
  }
}

/**
 * Assert a locate --recording output dir has stable, pinned outcomes.
 * Fail-closed on mismatch (CI-safe; no GPU / no network).
 */
export function assertRecordingReplayArtifacts(
  outputDir: string,
  expect: CassetteReplayExpectation,
): CassetteReplayAssertResult {
  const dir = path.resolve(outputDir);
  const reportPath = path.join(dir, "report.json");
  const sarifPath = path.join(dir, "report.sarif");

  const report = readJson<LocalizationResult>(reportPath);
  const sarif = readJson<{
    runs?: Array<{
      results?: unknown[];
      properties?: { mode?: string };
    }>;
  }>(sarifPath);

  const modeWant = expect.mode ?? "recording";
  if (report.mode !== modeWant) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: mode want=${modeWant} got=${String(report.mode)}`,
    );
  }

  const findingCount = report.summary?.findingCount ?? report.rankedFiles?.length ?? -1;
  if (findingCount !== expect.findingCount) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: findingCount want=${expect.findingCount} got=${findingCount}`,
    );
  }
  if (!Array.isArray(report.rankedFiles) || report.rankedFiles.length !== expect.findingCount) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: rankedFiles.length want=${expect.findingCount} got=${report.rankedFiles?.length ?? 0}`,
    );
  }

  const rankedFile = report.rankedFiles[0]?.filePath ?? "";
  if (rankedFile !== expect.rankedFile) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: rankedFile[0] want=${expect.rankedFile} got=${rankedFile}`,
    );
  }
  if (path.isAbsolute(rankedFile)) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: rankedFile must be repo-relative, got absolute ${rankedFile}`,
    );
  }

  const cweId = report.advisory?.cweId ?? "";
  if (expect.cweId && cweId !== expect.cweId) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: cweId want=${expect.cweId} got=${cweId}`,
    );
  }

  const sarifWant = expect.sarifResultCount ?? expect.findingCount;
  const run0 = sarif.runs?.[0];
  const sarifResultCount = run0?.results?.length ?? -1;
  if (sarifResultCount !== sarifWant) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: SARIF results want=${sarifWant} got=${sarifResultCount}`,
    );
  }
  if (run0?.properties?.mode !== modeWant) {
    throw new CassetteReplayAssertError(
      `cassette replay assert: SARIF properties.mode want=${modeWant} got=${String(run0?.properties?.mode)}`,
    );
  }

  if (!report.posture?.localizationOnly || !report.posture?.noPoC) {
    throw new CassetteReplayAssertError(
      "cassette replay assert: posture must keep localizationOnly + noPoC",
    );
  }

  const warn = (report.warnings ?? []).join(" ");
  if (!/recording|cassette/i.test(warn)) {
    throw new CassetteReplayAssertError(
      "cassette replay assert: warnings must mention recording/cassette",
    );
  }

  return {
    mode: report.mode,
    findingCount,
    rankedFile,
    cweId,
    sarifResultCount,
    reportPath,
    sarifPath,
  };
}
