/**
 * ZERODAY locate — Antares vulnerability localization daily driver.
 */

import fs from "node:fs";
import path from "node:path";
import { parseAdvisorySafe } from "./parse";
import { createSnapshot, destroySnapshot } from "./snapshot";
import { runFixtureLocalization, defaultFixtureRepo } from "./fixture";
import { runLiveAntaresCli, detectAntaresCli, runAntaresPlan } from "./live";
import { toSarif } from "./sarif";
import { toHumanReport } from "./report";
import {
  assertNoExploitInvariant,
  collectResultTexts,
} from "./invariant";
import type { LocateOptions, LocalizationResult } from "./types";

export {
  parseAdvisorySafe as parseAdvisory,
  toSarif,
  toHumanReport,
  defaultFixtureRepo,
  detectAntaresCli,
  runAntaresPlan,
};
export interface LocateArtifacts {
  result: LocalizationResult;
  outputDir: string;
  jsonPath: string;
  sarifPath: string;
  reportPath: string;
}

export async function locate(options: LocateOptions): Promise<LocateArtifacts> {
  const advisory = parseAdvisorySafe(
    options.advisory.startsWith("CWE") ||
      options.advisory.startsWith("cwe") ||
      options.advisory.startsWith("CVE") ||
      options.advisory.startsWith("cve") ||
      options.advisory.toLowerCase().startsWith("ghsa")
      ? options.advisory
      : options.advisory,
  );

  let repo = options.repo;
  if (!repo || repo === "." || repo === "fixture") {
    // Allow bare fixture demos
    if (options.fixture || repo === "fixture" || !options.repo) {
      repo = defaultFixtureRepo();
    }
  }
  repo = path.resolve(repo);

  if (!fs.existsSync(repo)) {
    throw new Error(`Repo not found: ${repo}`);
  }

  const outputDir = path.resolve(
    options.outputDir ??
      path.join(
        process.cwd(),
        "zeroday-reports",
        `${advisory.id.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}`,
      ),
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const preferLive = Boolean(options.live);
  const preferFixture = Boolean(options.fixture) || !preferLive;
  const antares = detectAntaresCli();

  let result: LocalizationResult;
  let snapshotPath: string | undefined;

  try {
    if (preferLive || (!preferFixture && antares.binary)) {
      const snap = createSnapshot(repo);
      snapshotPath = snap.snapshotPath;
      result = runLiveAntaresCli({
        advisory,
        repo,
        snapshotPath: snap.snapshotPath,
        outputDir: path.join(outputDir, "antares-raw"),
        endpoint: options.endpoint,
        model: options.model,
        antaresCliSource: options.antaresCliSource,
      });
      result.snapshotPath = snap.snapshotPath;
      result.warnings.push(
        `Read-only snapshot: ${snap.fileCount} files at ${snap.snapshotPath}`,
      );
      result.warnings.push(...snap.warnings);
    } else {
      // Fixture path still creates a snapshot for UX parity / future sandbox wiring
      const snap = createSnapshot(repo);
      snapshotPath = snap.snapshotPath;
      result = runFixtureLocalization(advisory, repo);
      result.snapshotPath = snap.snapshotPath;
      result.warnings.push(
        `Read-only snapshot: ${snap.fileCount} files (destroyed after run)`,
      );
      result.warnings.push(...snap.warnings);
      if (!antares.binary) {
        result.warnings.push(
          `Live Antares CLI not on PATH. ${antares.sourceHint}`,
        );
      }
    }

    assertNoExploitInvariant(collectResultTexts(result));

    const jsonPath = path.join(outputDir, "report.json");
    const sarifPath = path.join(outputDir, "report.sarif");
    const reportPath = path.join(outputDir, "report.md");

    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2));
    fs.writeFileSync(reportPath, toHumanReport(result));

    return { result, outputDir, jsonPath, sarifPath, reportPath };
  } finally {
    if (snapshotPath) {
      destroySnapshot(snapshotPath);
    }
  }
}
