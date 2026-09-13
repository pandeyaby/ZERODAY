/**
 * Defense Factory loop — inventory → locate → classify → own → (optional draft) → verify.
 * Durable hashed evidence via EvidenceVault + zeroday verify.
 */

import fs from "node:fs";
import path from "node:path";
import { locate } from "../locate/index";
import { draftFix } from "../locate/draft-fix";
import { runClassify } from "../classify/index";
import { EvidenceVault, verifyRunDir } from "../evidence/vault";
import { writeInventory } from "./inventory";
import { writeOwnership } from "./ownership";
import { writeDefendArtifact } from "./defend";
import { resolveInferenceProvider } from "./provider";
import type {
  FactoryRunOptions,
  FactoryRunSummary,
  FactoryStagePaths,
} from "./types";

function summaryMarkdown(s: FactoryRunSummary): string {
  const lines: string[] = [];
  lines.push("# ZERODAY Localization & Evidence Defense Factory");
  lines.push("");
  lines.push(
    "> Continuous defensive loop. Localization is **not** proof of exploitability. " +
      "No PoCs. No auto-merge. `needs_human: true` always.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Run | \`${s.runId}\` |`);
  lines.push(`| Repo | \`${s.repo}\` |`);
  lines.push(`| Advisory | \`${s.advisory}\` |`);
  lines.push(`| Findings | **${s.findingCount}** |`);
  lines.push(`| Locate mode | \`${s.locateMode ?? "—"}\` |`);
  lines.push(`| Classification | \`${s.classification ?? "—"}\` |`);
  lines.push(`| Verify | ${s.verifyOk ? "PASS" : "FAIL"} |`);
  lines.push(
    `| Defend | ${s.defendOk == null ? "skipped" : s.defendOk ? "PASS" : "FAIL"} |`,
  );
  lines.push(
    `| Inference | \`${s.inferenceProvider}\` (remote=${s.remoteInference}) |`,
  );
  lines.push(`| Needs human | **yes** |`);
  lines.push("");
  lines.push("## Stages");
  lines.push("");
  lines.push(
    "1. **Inventory** — repos/paths + config surfaces (Actions, Docker, manifests, agent/skills) → locate hints",
  );
  lines.push("2. **Locate** — Antares fixture / live / agent candidates");
  lines.push("3. **Classify** — optional CISO rollup (fixture telemetry)");
  lines.push("4. **Own** — CODEOWNERS / blame → review markdown + GitHub comment");
  lines.push(
    "5. **Draft** — CodeGuard patch draft only after `--i-asked-for-a-fix`",
  );
  lines.push("6. **Defend** — existing tests / fail-closed (never exploit repro)");
  lines.push("7. **Verify** — offline evidence hash check");
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  for (const [k, v] of Object.entries(s.paths)) {
    if (v) lines.push(`- **${k}:** \`${v}\``);
  }
  lines.push("");
  lines.push("## Hard limits");
  lines.push("");
  lines.push("- No exploit / PoC / payload / attack procedure");
  lines.push("- Localization ≠ exploitability");
  lines.push("- Never auto-merge");
  lines.push(
    "- Local-first / keyless default; remote inference requires explicit ACK",
  );
  lines.push("");
  return lines.join("\n");
}

export interface FactoryArtifacts {
  summary: FactoryRunSummary;
  outputDir: string;
  paths: FactoryStagePaths;
  manifestPath: string;
  evidenceDir: string;
}

function registerIfExists(
  vault: EvidenceVault,
  abs: string,
  name: string,
): void {
  if (fs.existsSync(abs)) vault.registerArtifact(abs, name);
}

export async function runFactory(
  options: FactoryRunOptions,
): Promise<FactoryArtifacts> {
  const repo = path.resolve(options.repo);
  if (!fs.existsSync(repo)) {
    throw new Error(`Factory repo not found: ${repo}`);
  }

  const inference = resolveInferenceProvider({
    provider: options.inferenceProvider,
    endpoint: options.endpoint,
    remoteInference: options.remoteInference,
  });

  const runId = `factory-${Date.now()}`;
  const outputDir = path.resolve(
    options.outputDir ?? path.join(process.cwd(), "zeroday-reports", runId),
  );
  fs.mkdirSync(outputDir, { recursive: true });

  // 1) Inventory — config surfaces + ranked locate hints (feeds locate planning)
  const inventoryPath = path.join(outputDir, "inventory.json");
  const inventoryMdPath = path.join(outputDir, "inventory.md");
  const inventory = writeInventory(repo, inventoryPath, {
    markdownPath: inventoryMdPath,
  });

  // 2) Locate — fixture by default; live only when explicitly requested
  const useLive = Boolean(
    options.live || (inference.endpoint && options.fixture === false),
  );
  const locateOut = path.join(outputDir, "locate");
  const locateArtifacts = await locate({
    repo,
    advisory: options.advisory,
    fixture: useLive ? false : true,
    live: useLive,
    offline: options.offline ?? true,
    explicitCwe: options.explicitCwe,
    outputDir: locateOut,
    endpoint: useLive ? inference.endpoint : undefined,
    model: options.model,
  });

  const locateReportPath = locateArtifacts.jsonPath;

  for (const name of [
    "report.json",
    "report.md",
    "report.sarif",
    "comment.md",
  ] as const) {
    const src = path.join(locateOut, name);
    const dst = path.join(outputDir, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, dst);
  }

  // 3) Classify (optional)
  let classifyJson: string | undefined;
  let classification: FactoryRunSummary["classification"];
  if (options.classifyScenario) {
    const classifyOut = path.join(outputDir, "classify");
    const c = runClassify({
      scenario: options.classifyScenario,
      fromLocate: locateReportPath,
      outputDir: classifyOut,
    });
    classifyJson = c.jsonPath;
    classification = c.ciso.classification;
  }

  // 4) Ownership
  const ownershipJson = path.join(outputDir, "ownership.json");
  const ownershipMd = path.join(outputDir, "ownership.md");
  const ownershipComment = path.join(outputDir, "ownership-comment.md");
  writeOwnership(
    {
      result: locateArtifacts.result,
      inventory,
      includeBlame: true,
    },
    { json: ownershipJson, md: ownershipMd, comment: ownershipComment },
  );

  // 5) Optional CodeGuard draft (human gate)
  let draftPath: string | undefined;
  if (options.iAskedForAFix) {
    const draft = draftFix({
      iAskedForAFix: true,
      result: locateArtifacts.result,
      repoPath: repo,
      outputDir: path.join(outputDir, "drafts"),
    });
    draftPath = draft.path;
  }

  // 6) Defend-only (optional)
  let defendPath: string | undefined;
  let defendOk: boolean | undefined;
  if (options.defend) {
    defendPath = path.join(outputDir, "defend.json");
    const defend = writeDefendArtifact(repo, defendPath, {
      runTests: options.runTests === true,
    });
    defendOk = defend.ok;
  }

  const paths: FactoryStagePaths = {
    inventory: inventoryPath,
    inventoryMd: inventoryMdPath,
    locateReport: locateReportPath,
    classifyJson,
    ownership: ownershipJson,
    ownershipMd,
    ownershipComment,
    defend: defendPath,
    draft: draftPath,
    verifyJson: path.join(outputDir, "verify.json"),
    summaryJson: path.join(outputDir, "factory.json"),
    summaryMd: path.join(outputDir, "factory.md"),
  };

  // Evidence vault — hashed stage artifacts (factory/verify summaries written after)
  const vault = new EvidenceVault(outputDir, runId);
  vault.putBlob(
    "input",
    "inputs/inventory.json",
    JSON.stringify(inventory, null, 2),
    {
      title: "Repo inventory",
      summary:
        `${inventory.fileCount} file(s); hotspots=${inventory.configHotspots.length}; ` +
        `CODEOWNERS=${inventory.codeownersPath ?? "none"}`,
      tags: ["factory", "inventory"],
    },
  );
  registerIfExists(vault, inventoryPath, "inventory.json");
  registerIfExists(vault, inventoryMdPath, "inventory.md");
  registerIfExists(vault, path.join(outputDir, "report.json"), "report.json");
  registerIfExists(vault, path.join(outputDir, "report.md"), "report.md");
  registerIfExists(vault, path.join(outputDir, "report.sarif"), "report.sarif");
  registerIfExists(vault, path.join(outputDir, "comment.md"), "comment.md");
  registerIfExists(vault, ownershipJson, "ownership.json");
  registerIfExists(vault, ownershipMd, "ownership.md");
  registerIfExists(vault, ownershipComment, "ownership-comment.md");
  if (classifyJson) {
    registerIfExists(vault, classifyJson, "classify/ciso.json");
    registerIfExists(
      vault,
      path.join(path.dirname(classifyJson), "ciso.md"),
      "classify/ciso.md",
    );
  }
  if (draftPath) registerIfExists(vault, draftPath, "drafts/patch-draft.md");
  if (defendPath) registerIfExists(vault, defendPath, "defend.json");

  const manifestPath = vault.flush();

  const verifyResult = verifyRunDir(outputDir);
  fs.writeFileSync(paths.verifyJson, JSON.stringify(verifyResult, null, 2));

  const summary: FactoryRunSummary = {
    schemaVersion: "zeroday-factory-run/v1",
    runId,
    generatedAt: new Date().toISOString(),
    repo,
    advisory: options.advisory,
    stages: {
      inventory: true,
      locate: true,
      classify: Boolean(options.classifyScenario),
      ownership: true,
      draftFix: Boolean(options.iAskedForAFix),
      defend: Boolean(options.defend),
      verify: true,
    },
    locateMode: locateArtifacts.result.mode,
    findingCount: locateArtifacts.result.summary.findingCount,
    classification,
    verifyOk: verifyResult.ok,
    defendOk,
    needsHuman: true,
    inferenceProvider: inference.provider,
    remoteInference: inference.remote,
    paths,
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
      keylessDefault: true,
      draftOnlyAfterExplicitAsk: true,
    },
  };

  fs.writeFileSync(paths.summaryJson, JSON.stringify(summary, null, 2));
  fs.writeFileSync(paths.summaryMd, summaryMarkdown(summary));

  return {
    summary,
    outputDir,
    paths,
    manifestPath,
    evidenceDir: path.join(outputDir, "evidence"),
  };
}
