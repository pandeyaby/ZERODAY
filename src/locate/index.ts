/**
 * ZERODAY locate — wraps official cisco-antares-cli (`antares query` / `plan`).
 * Does not reimplement Antares. Does not download weights.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveAdvisory } from "./resolve";
import { createSnapshot, destroySnapshot } from "./snapshot";
import { runFixtureLocalization, defaultFixtureRepo } from "./fixture";
import { runRulesLocalization } from "./rules/index";
import { runIngestLocalization, parseSarifFile, mapRuleToCwe } from "./ingest/index";
import {
  loadOrgCassette,
  runRecordingLocalization,
  recordCassette,
} from "./record/index";
import {
  detectAntaresCli,
  runAntaresPlan,
  runAntaresSweep,
  runLiveAntaresCliWithRecovery,
} from "./live";
import { normalizeCompletionsEndpoint } from "./completions";
import {
  assertLiveEndpointHealthy,
  resolveLocateMode,
} from "./live-guard";
import { resolveLiveModel, DEFAULT_ANTARES_MODEL } from "./model";
import {
  shouldFailOnIncomplete,
  formatIncompleteCliBlock,
  resolveLiveToolBudget,
  DEFAULT_LIVE_TOOL_BUDGET,
  classifyIncomplete,
} from "./incomplete";
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
  shouldFailOnIncomplete,
  formatIncompleteCliBlock,
  resolveLiveToolBudget,
  DEFAULT_LIVE_TOOL_BUDGET,
  classifyIncomplete,
  runRulesLocalization,
  runIngestLocalization,
  parseSarifFile,
  mapRuleToCwe,
  loadOrgCassette,
  runRecordingLocalization,
  recordCassette,
};
export type { LocateOptions, LocalizationResult };
export type { OrgCassette, RecordOptions } from "./record/index";
export { ORG_CASSETTE_SCHEMA, HUMAN_REVIEW_NOTE } from "./record/index";

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
  /** True when caller should exit non-zero for incomplete live */
  failIncomplete?: boolean;
}

export async function locate(options: LocateOptions): Promise<LocateArtifacts> {
  const endpointRaw =
    options.endpoint ||
    process.env.ZERODAY_ANTARES_BASE_URL ||
    process.env.ANTARES_ENDPOINT ||
    undefined;

  // Live when --live / --endpoint; rules when --rules; ingest when --from-sarif;
  // recording when --recording; fixture when --fixture or default. Mixed doors refuse closed.
  const mode = resolveLocateMode({
    fixture: options.fixture,
    live: options.live,
    rules: options.rules,
    fromSarif: options.fromSarif,
    recording: options.recording,
    endpoint: endpointRaw,
    remoteInference: options.remoteInference,
  });
  const preferLive = mode === "live";
  const preferRules = mode === "rules";
  const preferIngest = mode === "ingest";
  const preferRecording = mode === "recording";

  let advisory: {
    kind: "cwe" | "cve" | "ghsa";
    id: string;
    cweId: string;
    title?: string;
  };
  let resolvedSource = "cwe-direct";
  let resolvedCategory = "unknown";
  let loadedCassette: ReturnType<typeof loadOrgCassette> | null = null;

  if (preferRecording) {
    // Recording replay: advisory + findings come from the cassette.
    loadedCassette = loadOrgCassette(options.recording!.trim());
    advisory = loadedCassette.advisory;
    resolvedSource = "recording";
    resolvedCategory = loadedCassette.sourceMode;
  } else if (preferIngest && (!options.advisory || options.advisory.trim() === "")) {
    // Unfiltered ingest: synthesize a neutral advisory; CWE filter optional later.
    advisory = {
      kind: "cwe",
      id: "INGEST",
      cweId: "CWE-000",
      title: "SARIF ingest (unfiltered)",
    };
    resolvedSource = "ingest";
    resolvedCategory = "ingest";
  } else {
    const resolved = await resolveAdvisory(options.advisory, {
      offline: !preferLive || options.offline === true,
      explicitCwe: options.explicitCwe,
    });
    advisory = {
      kind: resolved.kind,
      id: resolved.id,
      cweId: resolved.cweId,
      title: resolved.title,
    };
    resolvedSource = resolved.source;
    resolvedCategory = resolved.category;
  }

  let repo = options.repo;
  if (preferRecording) {
    // Replay labels targetRepo; default to cwd / cassette label when --repo omitted.
    if (!repo || repo === "." || repo === "fixture") {
      repo = process.cwd();
    }
    repo = path.resolve(repo);
  } else if (preferIngest) {
    // Ingest labels targetRepo; default to cwd when --repo omitted.
    if (!repo || repo === "." || repo === "fixture") {
      repo = process.cwd();
    }
    repo = path.resolve(repo);
  } else {
    if (!repo || repo === "." || repo === "fixture") {
      if (options.fixture || repo === "fixture" || !options.repo) {
        repo = defaultFixtureRepo();
      }
    }
    repo = path.resolve(repo);

    if (!fs.existsSync(repo)) {
      throw new Error(`Repo not found: ${repo}`);
    }
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
    if (preferRecording) {
      const cassette = loadedCassette!;
      result = runRecordingLocalization(cassette, repo);
      if (result.mode !== "recording") {
        throw new Error(
          `Recording locate invariant broken: expected mode=recording, got mode=${result.mode}.`,
        );
      }
      result.warnings.push(
        `Resolved advisory label ${advisory.id} → ${advisory.cweId} (sourceMode=${cassette.sourceMode}) via recording cassette`,
      );
      result.warnings.push(
        "Recording mode is offline (no Docker / no Antares / no network) — redacted org CI cassette replay.",
      );
    } else if (preferIngest) {
      const sarifPath = options.fromSarif!.trim();
      result = runIngestLocalization({
        sarifPath,
        cweFilter:
          advisory.cweId && advisory.cweId !== "CWE-000"
            ? advisory.cweId
            : options.explicitCwe ?? null,
        targetRepo: repo,
        advisory,
      });
      if (result.mode !== "ingest") {
        throw new Error(
          `Ingest locate invariant broken: expected mode=ingest, got mode=${result.mode}.`,
        );
      }
      // If unfiltered ingest found a dominant CWE, prefer it on the advisory label.
      if (advisory.cweId === "CWE-000" && result.rankedFiles.length > 0) {
        const counts = new Map<string, number>();
        for (const f of result.rankedFiles) {
          for (const c of f.cweIds) {
            counts.set(c, (counts.get(c) ?? 0) + 1);
          }
        }
        let best: string | null = null;
        let bestN = 0;
        for (const [c, n] of counts) {
          if (n > bestN) {
            best = c;
            bestN = n;
          }
        }
        if (best) {
          result.advisory = {
            ...result.advisory,
            id: best,
            cweId: best,
            title: `SARIF ingest (primary ${best})`,
          };
          advisory = result.advisory;
        }
      }
      result.warnings.push(
        `Resolved advisory label ${advisory.id} → ${advisory.cweId} (${resolvedCategory}) via ${resolvedSource}`,
      );
      result.warnings.push(
        "Ingest mode is container-free (no Docker / no Antares / no Semgrep binary) — local SARIF file only.",
      );
    } else if (preferLive) {
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

      result = runLiveAntaresCliWithRecovery(
        {
          advisory,
          repo,
          snapshotPath: snap.snapshotPath,
          outputDir: path.join(outputDir, "antares-raw"),
          endpoint,
          model: resolveLiveModel(options.model),
          toolBudget: resolveLiveToolBudget(options.toolBudget),
          antaresCliSource: options.antaresCliSource,
        },
        { recovery: options.liveRecovery !== false },
      );
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
        `Resolved ${advisory.id} → ${advisory.cweId} (${resolvedCategory}) via ${resolvedSource}`,
      );
      result.warnings.push(
        "Sandbox network=none isolates inspection; vLLM /v1/completions remains on the host (HF-gated weights).",
      );
    } else if (preferRules) {
      // Rules path: thin in-repo heuristics on real --repo (Keyless K1).
      // Container-free; no Semgrep; no Antares weights.
      const snap = createSnapshot(repo);
      snapshotPath = snap.snapshotPath;
      result = runRulesLocalization(advisory, snap.snapshotPath);
      result.targetRepo = repo;
      result.snapshotPath = snap.snapshotPath;
      if (result.mode !== "rules") {
        throw new Error(
          `Rules locate invariant broken: expected mode=rules, got mode=${result.mode}.`,
        );
      }
      result.warnings.push(
        `Read-only snapshot: ${snap.fileCount} files (destroyed after run)`,
      );
      result.warnings.push(...snap.warnings);
      result.warnings.push(
        `Resolved ${advisory.id} → ${advisory.cweId} (${resolvedCategory}) via ${resolvedSource}`,
      );
      result.warnings.push(
        "Rules mode is container-free (no Docker / no Semgrep) — CI-safe keyless localize.",
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
        `Resolved ${advisory.id} → ${advisory.cweId} (${resolvedCategory}) via ${resolvedSource}`,
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
      failIncomplete: shouldFailOnIncomplete({
        mode: result.mode,
        failOnIncomplete: options.failOnIncomplete,
        incomplete: Boolean(result.summary.incompleteReason),
      }),
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
