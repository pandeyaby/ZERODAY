/**
 * ZERODAY locate — wraps official cisco-antares-cli (`antares query` / `plan`).
 * Does not reimplement Antares. Does not download weights.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveAdvisory } from "./resolve";
import { createSnapshot, destroySnapshot } from "./snapshot";
import { runFixtureLocalization, defaultFixtureRepo } from "./fixture";
import { runLiveAntaresCli, detectAntaresCli, runAntaresPlan, runAntaresSweep } from "./live";
import { normalizeCompletionsEndpoint } from "./completions";
import {
  assertLiveEndpointHealthy,
  resolveLocateMode,
} from "./live-guard";
import { resolveLiveModel, DEFAULT_ANTARES_MODEL } from "./model";
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
import { tryOpenLiveSandbox, type SandboxSession } from "./sandbox";
import { EvidenceVault } from "../evidence/vault";

export {
  parseAdvisorySafe as parseAdvisory,
  toSarif,
  toHumanReport,
  toPullRequestComment,
  defaultFixtureRepo,
  detectAntaresCli,
  runAntaresPlan,
  runAntaresSweep,
  resolveAdvisory,
  resolveLocateMode,
  assertLiveEndpointHealthy,
  resolveLiveModel,
  DEFAULT_ANTARES_MODEL,
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
  evidenceDir?: string;
  manifestPath?: string;
}

export async function locate(options: LocateOptions): Promise<LocateArtifacts> {
  const endpointRaw =
    options.endpoint || process.env.ANTARES_ENDPOINT || undefined;

  // Live when --live / --endpoint; fixture when --fixture or default (CI-safe).
  // Mixed --fixture + --live/--endpoint is refused — never silent mock fallback.
  const mode = resolveLocateMode({
    fixture: options.fixture,
    live: options.live,
    endpoint: endpointRaw,
  });
  const preferLive = mode === "live";

  const resolved = await resolveAdvisory(options.advisory, {
    offline: !preferLive || options.offline === true,
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
  let sandbox: SandboxSession | null = null;

  try {
    if (preferLive) {
      // Fail closed on unhealthy endpoint BEFORE touching Antares CLI / snapshots.
      // Never degrade to fixture recordings.
      const endpoint = normalizeCompletionsEndpoint(endpointRaw!);
      const probe = await assertLiveEndpointHealthy({
        endpoint,
        fetchImpl: options.probeFetch,
        probeResult: options.probeResult,
      });
      const probeDetail = `Local completions probe ok: ${probe.detail}`;

      if (!antares.binary) {
        throw new Error(
          `Live locate needs the official Antares CLI on PATH. ${antares.sourceHint} ` +
            `Use --fixture only for the separate CI / no-GPU smoke — never as a silent fallback.`,
        );
      }

      const snap = createSnapshot(repo);
      snapshotPath = snap.snapshotPath;

      // Isolated container for exploration surface (network=none). Inference stays on host.
      // Fixture / CI never enter this branch with --fixture.
      const sb = tryOpenLiveSandbox(snap.snapshotPath);
      sandbox = sb.session;
      if (sb.session && sb.preflight) {
        // Tiny allowlisted exploration sample inside the sandbox (destroy after run).
        sb.session.exec(["find", "/snapshot", "-type", "f"]);
      }

      result = runLiveAntaresCli({
        advisory,
        repo,
        snapshotPath: snap.snapshotPath,
        outputDir: path.join(outputDir, "antares-raw"),
        endpoint,
        model: resolveLiveModel(options.model),
        toolBudget: options.toolBudget,
        antaresCliSource: options.antaresCliSource,
      });
      if (result.mode !== "live") {
        throw new Error(
          `Live locate invariant broken: expected mode=live, got mode=${result.mode}. ` +
            `Refusing to treat fixture/mock output as a live Antares run.`,
        );
      }
      result.snapshotPath = snap.snapshotPath;
      result.warnings.push(
        `Read-only snapshot: ${snap.fileCount} files at ${snap.snapshotPath}`,
      );
      result.warnings.push(...snap.warnings);
      result.warnings.push(sb.detail);
      result.warnings.push(probeDetail);
      result.warnings.push(
        `Resolved ${resolved.id} → ${resolved.cweId} (${resolved.category}) via ${resolved.source}`,
      );
      result.warnings.push(
        "Sandbox network=none isolates inspection; vLLM /v1/completions remains on the host (HF-gated weights).",
      );
    } else {
      // Fixture path: container-free by design (GitHub Action / ubuntu-latest).
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
      result.warnings.push(
        "Fixture mode is container-free (no Docker) — CI-safe.",
      );
      if (!antares.binary) {
        result.warnings.push(
          `Live Antares CLI not on PATH. ${antares.sourceHint}`,
        );
      }
    }

    const runId = path.basename(outputDir);
    const vault = new EvidenceVault(outputDir, runId);
    vault.putBlob(
      "input",
      "inputs/advisory.json",
      JSON.stringify(
        {
          advisory,
          repo,
          mode: result.mode,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
      {
        title: "Locate inputs",
        summary: `${advisory.id} → ${advisory.cweId} (${result.mode})`,
        tags: ["input", "locate"],
      },
    );

    const claimIds: string[] = [];
    for (const f of result.rankedFiles) {
      const claim = vault.putClaim(
        `Candidate: ${f.filePath}`,
        `${f.title} (rank ${f.rank})`,
        [],
      );
      claimIds.push(claim.id);
    }

    assertNoExploitInvariant([
      ...collectResultTexts(result),
      toHumanReport(result, { evidenceClaimIds: claimIds }),
      toPullRequestComment(result),
    ]);

    const jsonPath = path.join(outputDir, "report.json");
    const sarifPath = path.join(outputDir, "report.sarif");
    const reportPath = path.join(outputDir, "report.md");
    const commentPath = path.join(outputDir, "comment.md");

    const resultWithEvidence = {
      ...result,
      evidence: {
        runId,
        claimIds,
        vaultRelative: "evidence/",
      },
    };

    fs.writeFileSync(jsonPath, JSON.stringify(resultWithEvidence, null, 2));
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2));
    fs.writeFileSync(
      reportPath,
      toHumanReport(result, { evidenceClaimIds: claimIds }),
    );
    fs.writeFileSync(commentPath, toPullRequestComment(result));

    const exports = writeAllExports(result, outputDir, {
      awsAccountId: options.awsAccountId,
      region: options.awsRegion,
    });

    for (const p of [
      jsonPath,
      sarifPath,
      reportPath,
      commentPath,
      ...exports.map((e) => e.path),
    ]) {
      vault.registerArtifact(p);
    }
    const manifestPath = vault.flush();

    return {
      result,
      outputDir,
      jsonPath,
      sarifPath,
      reportPath,
      commentPath,
      exportPaths: exports.map((e) => e.path),
      evidenceDir: vault.evidenceDir,
      manifestPath,
    };
  } finally {
    if (sandbox) {
      try {
        sandbox.destroy();
      } catch {
        /* best-effort destroy */
      }
    }
    if (snapshotPath) {
      destroySnapshot(snapshotPath);
    }
  }
}

/** Sync fixture helper for tests that still use parseAdvisorySafe */
export { parseAdvisorySafe };
