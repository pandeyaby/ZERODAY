/**
 * ZERODAY locate — wraps official cisco-antares-cli (`antares query` / `plan`).
 * Does not reimplement Antares. Does not download weights.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveAdvisory } from "./resolve";
import { createSnapshot, destroySnapshot } from "./snapshot";
import { runFixtureLocalization, defaultFixtureRepo } from "./fixture";
import { runLiveAntaresCli, detectAntaresCli, runAntaresPlan } from "./live";
import {
  assertNotChatCompletions,
  normalizeCompletionsEndpoint,
  probeCompletionsEndpoint,
} from "./completions";
import { toSarif } from "./sarif";
import { toHumanReport } from "./report";
import { toPullRequestComment } from "./comment";
import { writeAllExports } from "./export/index";
import {
  assertNoExploitInvariant,
  collectResultTexts,
} from "./invariant";
import type { LocateOptions, LocalizationResult } from "./types";
import { parseAdvisorySafe } from "./parse";

export {
  parseAdvisorySafe as parseAdvisory,
  toSarif,
  toHumanReport,
  toPullRequestComment,
  defaultFixtureRepo,
  detectAntaresCli,
  runAntaresPlan,
  resolveAdvisory,
};
export type { LocateOptions, LocalizationResult };

export interface LocateArtifacts {
  result: LocalizationResult;
  outputDir: string;
  jsonPath: string;
  sarifPath: string;
  reportPath: string;
  commentPath: string;
  exportPaths: string[];
}

export async function locate(options: LocateOptions): Promise<LocateArtifacts> {
  const endpointRaw =
    options.endpoint || process.env.ANTARES_ENDPOINT || undefined;
  if (endpointRaw) {
    assertNotChatCompletions(endpointRaw);
  }

  // Live by default when --endpoint is set; fixture remains explicit / CI path
  const preferLive =
    Boolean(options.live) ||
    (Boolean(endpointRaw) && !options.fixture);
  const preferFixture = Boolean(options.fixture) || !preferLive;

  const resolved = await resolveAdvisory(options.advisory, {
    offline: preferFixture || options.offline === true,
    explicitCwe: options.explicitCwe,
  });

  // Keep AdvisoryRef shape used across reporters
  const advisory = {
    kind: resolved.kind,
    id: resolved.id,
    cweId: resolved.cweId,
    title: resolved.title,
  };

  let repo = options.repo;
  if (!repo || repo === "." || repo === "fixture") {
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

  const antares = detectAntaresCli();

  let result: LocalizationResult;
  let snapshotPath: string | undefined;

  try {
    if (preferLive) {
      if (!antares.binary) {
        throw new Error(
          `Live locate needs the official Antares CLI on PATH. ${antares.sourceHint} ` +
            `Or use --fixture for offline recorded localizations.`,
        );
      }
      if (endpointRaw) {
        const endpoint = normalizeCompletionsEndpoint(endpointRaw);
        const probe = await probeCompletionsEndpoint(endpoint);
        if (!probe.ok) {
          // Soft warning — antares CLI may still succeed with profiles.toml
          // We still proceed; probe detail is recorded.
        }
        const snap = createSnapshot(repo);
        snapshotPath = snap.snapshotPath;
        result = runLiveAntaresCli({
          advisory,
          repo,
          snapshotPath: snap.snapshotPath,
          outputDir: path.join(outputDir, "antares-raw"),
          endpoint,
          model: options.model,
          antaresCliSource: options.antaresCliSource,
        });
        result.snapshotPath = snap.snapshotPath;
        result.warnings.push(
          `Read-only snapshot: ${snap.fileCount} files at ${snap.snapshotPath}`,
        );
        result.warnings.push(...snap.warnings);
        result.warnings.push(
          probe.ok
            ? `Local completions probe ok: ${probe.detail}`
            : `Local completions probe: ${probe.detail} (antares may still use profile endpoint)`,
        );
        result.warnings.push(
          `Resolved ${resolved.id} → ${resolved.cweId} (${resolved.category}) via ${resolved.source}`,
        );
      } else {
        const snap = createSnapshot(repo);
        snapshotPath = snap.snapshotPath;
        result = runLiveAntaresCli({
          advisory,
          repo,
          snapshotPath: snap.snapshotPath,
          outputDir: path.join(outputDir, "antares-raw"),
          endpoint: undefined,
          model: options.model,
          antaresCliSource: options.antaresCliSource,
        });
        result.snapshotPath = snap.snapshotPath;
        result.warnings.push(
          `Read-only snapshot: ${snap.fileCount} files at ${snap.snapshotPath}`,
        );
        result.warnings.push(...snap.warnings);
        result.warnings.push(
          `Resolved ${resolved.id} → ${resolved.cweId} (${resolved.category}) via ${resolved.source}`,
        );
      }
    } else {
      const snap = createSnapshot(repo);
      snapshotPath = snap.snapshotPath;
      result = runFixtureLocalization(advisory, repo);
      result.snapshotPath = snap.snapshotPath;
      result.warnings.push(
        `Read-only snapshot: ${snap.fileCount} files (destroyed after run)`,
      );
      result.warnings.push(...snap.warnings);
      result.warnings.push(
        `Resolved ${resolved.id} → ${resolved.cweId} (${resolved.category}) via ${resolved.source}`,
      );
      if (!antares.binary) {
        result.warnings.push(
          `Live Antares CLI not on PATH. ${antares.sourceHint}`,
        );
      }
    }

    assertNoExploitInvariant([
      ...collectResultTexts(result),
      toHumanReport(result),
      toPullRequestComment(result),
    ]);

    const jsonPath = path.join(outputDir, "report.json");
    const sarifPath = path.join(outputDir, "report.sarif");
    const reportPath = path.join(outputDir, "report.md");
    const commentPath = path.join(outputDir, "comment.md");

    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2));
    fs.writeFileSync(reportPath, toHumanReport(result));
    fs.writeFileSync(commentPath, toPullRequestComment(result));

    const exports = writeAllExports(result, outputDir, {
      awsAccountId: options.awsAccountId,
      region: options.awsRegion,
    });

    return {
      result,
      outputDir,
      jsonPath,
      sarifPath,
      reportPath,
      commentPath,
      exportPaths: exports.map((e) => e.path),
    };
  } finally {
    if (snapshotPath) {
      destroySnapshot(snapshotPath);
    }
  }
}

/** Sync fixture helper for tests that still use parseAdvisorySafe */
export { parseAdvisorySafe };
