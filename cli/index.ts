#!/usr/bin/env node
/**
 * ZERODAY CLI — Localization & Evidence Defense Factory.
 *
 *   zeroday mvp                        # keyless fixture smoke → SARIF PASS/FAIL
 *   zeroday inventory                  # Desk B on cwd / --repo (real tree; --fixture for smoke)
 *   zeroday packet                     # Desk A from zeroday-reports/ or --from (--fixture smoke)
 *   zeroday harden                     # Desk C from real reports dir (--fixture smoke)
 *   zeroday craft                      # Desk D from real reports dir (--fixture smoke)
 *   zeroday classify                   # Desk E from real reports / --from (--fixture smoke)
 *   zeroday antares doctor             # print-only live checklist (no spend)
 *   zeroday factory run …              # inventory→locate→classify→own→verify
 *   zeroday operate --cwe CWE-89 --fixture
 *   zeroday locate  --cwe CWE-89 --fixture
 *   zeroday verify  --from zeroday-reports/<run>
 *   zeroday export / draft-fix / classify / demo / play
 */

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import {
  locate,
  defaultFixtureRepo,
  detectAntaresCli,
  runAntaresPlan,
  runAntaresSweep,
} from "../src/locate/index.ts";
import {
  EXPORT_FORMATS,
  writeExport,
  defaultExportFilename,
  type ExportFormat,
} from "../src/locate/export/index.ts";
import {
  draftFix,
  DRAFT_FIX_FLAG,
  EXPLOIT_REFUSAL,
  requestLooksLikeExploit,
} from "../src/locate/draft-fix.ts";
import type { LocalizationResult } from "../src/locate/types.ts";
import { normalizeCompletionsEndpoint } from "../src/locate/completions.ts";
import { resolveLiveModel, DEFAULT_ANTARES_MODEL } from "../src/locate/model.ts";
import {
  formatIncompleteCliBlock,
  DEFAULT_LIVE_TOOL_BUDGET,
} from "../src/locate/incomplete.ts";
import {
  runClassify,
  listClassifyScenarios,
  runMixedPack,
} from "../src/classify/index.ts";
import { operate } from "../src/operate/index.ts";
import { verifyRunDir } from "../src/evidence/vault.ts";
import {
  runFactory,
  resolveInferenceProvider,
} from "../src/factory/index.ts";
import { runMvp, formatMvpBanner } from "../src/mvp/index.ts";
import {
  resolveClassifyFromPath,
  resolveDeskReportsFrom,
  resolveInventoryTarget,
} from "../src/desk/index.ts";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BASE = process.env.ZERODAY_URL || "http://127.0.0.1:3333";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function api(pathName: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${pathName}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exitCode = 1;
    return json;
  }
  console.log(JSON.stringify(json, null, 2));
  return json;
}

function loadResult(fromPath: string): LocalizationResult {
  const abs = path.resolve(fromPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Report not found: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8")) as LocalizationResult;
}

function collectRepoOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function runInventoryCli(opts: {
  repo: string[];
  from?: string;
  output?: string;
  json: boolean;
  fixture: boolean;
}): Promise<void> {
  const {
    writeInventory,
    writeMultiRepoInventory,
    loadInventoryManifest,
  } = await import("../src/factory/index.ts");

  const target = resolveInventoryTarget({
    fixture: opts.fixture,
    from: opts.from,
    repo: opts.repo,
    cwd: process.cwd(),
    repoRoot: REPO_ROOT,
  });

  const entries: Array<{ path: string; id?: string; optional?: boolean }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  if (target.from) {
    const manifestAbs = path.resolve(target.from);
    const manifest = loadInventoryManifest(manifestAbs);
    const baseDir = path.dirname(manifestAbs);
    for (const r of manifest.repos) {
      entries.push({
        path: path.isAbsolute(r.path) ? r.path : path.resolve(baseDir, r.path),
        id: r.id,
        optional: r.optional === true,
      });
    }
    skipped.push(...(manifest.skip ?? []));
  }

  for (const r of target.repos) {
    if (r && r.length > 0) entries.push({ path: path.resolve(r) });
  }

  if (entries.length === 0) {
    throw new Error(
      "inventory: no target — pass --repo, --from <manifest>, or --fixture (smoke).",
    );
  }

  const outRaw =
    opts.output ||
    path.join(process.cwd(), "zeroday-reports", `inventory-${Date.now()}`);
  const outLooksLikeFile = /\.json$/i.test(outRaw);
  const outDir = outLooksLikeFile ? path.dirname(path.resolve(outRaw)) : path.resolve(outRaw);
  const jsonName = outLooksLikeFile ? path.basename(outRaw) : "inventory.json";

  if (entries.length === 1 && skipped.length === 0) {
    const only = entries[0]!;
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, jsonName);
    const inv = writeInventory(only.path, jsonPath, {
      repoId: only.id,
      markdownPath: path.join(outDir, "inventory.md"),
      writeReports: true,
    });
    if (opts.json) {
      console.log(JSON.stringify(inv, null, 2));
    } else {
      const findingCount = inv.findings.filter(
        (f) => f.kind !== "config_surface",
      ).length;
      console.log("");
      console.log("ZERODAY inventory");
      console.log("────────────────");
      console.log(`Source    : ${target.source}`);
      console.log(`Repo      : ${inv.repoRoot}`);
      console.log(`Files     : ${inv.fileCount}`);
      console.log(
        `Languages : ${inv.languages.map((l) => l.language).join(", ") || "—"}`,
      );
      console.log(`Hotspots  : ${inv.configHotspots.length}`);
      console.log(`Findings  : ${findingCount}`);
      console.log(`CODEOWNERS: ${inv.codeownersPath ?? "none"}`);
      console.log("");
      console.log(`JSON      : ${jsonPath}`);
      console.log(`Markdown  : ${path.join(outDir, "inventory.md")}`);
      console.log(`SARIF     : ${path.join(outDir, "inventory.sarif")}`);
      console.log(`Case note : ${path.join(outDir, "case-note.md")}`);
      console.log("");
      console.log(
        "Next: npm run zeroday -- packet   # or packet --from <inventory-out>",
      );
      console.log(
        "Posture: inventory only · feeds locate · not vuln discovery · no PoC · secrets redacted",
      );
    }
    return;
  }

  const { multi, jsonPath, mdPath, sarifPath, caseNotePath } =
    writeMultiRepoInventory(entries, outDir, {
      skipped,
      writeReports: true,
    });
  if (opts.json) {
    console.log(JSON.stringify(multi, null, 2));
  } else {
    const findingCount = multi.findings.filter(
      (f) => f.kind !== "config_surface",
    ).length;
    console.log("");
    console.log("ZERODAY multi-repo inventory");
    console.log("───────────────────────────");
    console.log(`Source    : ${target.source}`);
    console.log(`Repos     : ${multi.repoCount}`);
    console.log(`Skipped   : ${multi.skipped.map((s) => s.id).join(", ") || "—"}`);
    console.log(`Hotspots  : ${multi.rankedHotspots.length}`);
    console.log(`Findings  : ${findingCount}`);
    console.log("");
    for (const hint of multi.locateHints) {
      const preview = hint.paths.slice(0, 3).join(", ");
      console.log(
        `  ${hint.repoId}: ${preview}${hint.paths.length > 3 ? ", …" : ""}`,
      );
    }
    console.log("");
    console.log(`JSON      : ${jsonPath}`);
    console.log(`Markdown  : ${mdPath}`);
    if (sarifPath) console.log(`SARIF     : ${sarifPath}`);
    if (caseNotePath) console.log(`Case note : ${caseNotePath}`);
    console.log("");
    console.log(
      "Compose: inventory → packet → harden → classify → craft (Desk; locate/Antares separate)",
    );
    console.log(
      "Posture: inventory only · feeds locate · not vuln discovery · no PoC · secrets redacted",
    );
  }
}

const program = new Command();
program
  .name("zeroday")
  .description(
    "ZERODAY — Localization & Evidence Defense Factory (keyless default; optional Antares)",
  )
  .version("0.6.0");

program
  .command("mvp")
  .description(
    "Keyless MVP smoke: fixture locate + operate→verify → SARIF PASS/FAIL (no GPU / no HF / no spend)",
  )
  .option("--cwe <id>", "CWE id", "CWE-89")
  .option(
    "--output <dir>",
    "MVP output directory",
    "zeroday-reports/mvp",
  )
  .option("--json", "Print MvpResult JSON", false)
  .action(async (opts: { cwe: string; output: string; json: boolean }) => {
    try {
      const result = await runMvp({
        cwe: opts.cwe,
        outputDir: opts.output,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        process.stdout.write(formatMvpBanner(result));
      }
      if (!result.ok) process.exitCode = 1;
    } catch (e) {
      console.error(`mvp failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("inventory")
  .description(
    "Desk B: multi-repo + config inventory on cwd / --repo (real tree). Fixtures via --fixture only.",
  )
  .option(
    "--repo <path>",
    "Local repo path (repeatable); default when omitted: current working directory",
    collectRepoOption,
    [] as string[],
  )
  .option(
    "--from <file>",
    "Inventory manifest (JSON or YAML) listing repos/paths",
  )
  .option(
    "--output <dir>",
    "Output directory for inventory.json + inventory.md",
  )
  .option(
    "--fixture",
    "Use fixtures/inventory/desk-b manifest (CI / mvp smoke — not the real-tree default)",
    false,
  )
  .option("--json", "Print inventory JSON to stdout", false)
  .action(
    async (opts: {
      repo: string[];
      from?: string;
      output?: string;
      json: boolean;
      fixture: boolean;
    }) => {
      try {
        await runInventoryCli(opts);
      } catch (e) {
        console.error(`inventory failed: ${(e as Error).message}`);
        process.exitCode = 2;
      }
    },
  );

program
  .command("harden")
  .description(
    "Desk C: agent/package harden from real reports dir / --from (recommend-only; --fixture for smoke)",
  )
  .option(
    "--from <dir>",
    "Reports directory with inventory.json / packet.json / findings.json (default: zeroday-reports/ then docs/reports)",
  )
  .option(
    "--output <dir>",
    "Harden output directory",
    "zeroday-reports/harden",
  )
  .option(
    "--draft",
    "Emit CodeGuard-aligned draft notes (human-gated; no auto-apply / auto-PR / auto-merge)",
    false,
  )
  .option("--json", "Print harden.json to stdout", false)
  .option(
    "--fixture",
    "Use checked-in docs/reports Desk artifacts as --from (CI smoke)",
    false,
  )
  .action(
    async (opts: {
      from?: string;
      output: string;
      draft: boolean;
      json: boolean;
      fixture: boolean;
    }) => {
      try {
        const { writeHardenReport } = await import("../src/harden/index.ts");

        const resolved = resolveDeskReportsFrom({
          fixture: opts.fixture,
          from: opts.from,
          cwd: process.cwd(),
          repoRoot: REPO_ROOT,
          command: "harden",
        });
        const fromDir = resolved.path;

        const result = writeHardenReport(fromDir, opts.output, {
          draft: opts.draft,
        });

        if (opts.json) {
          console.log(JSON.stringify(result.report, null, 2));
        } else {
          const c = result.report.categoryCounts;
          console.log("");
          console.log("ZERODAY harden (Desk C)");
          console.log("──────────────────────");
          console.log(`From      : ${fromDir}`);
          console.log(`Source    : ${resolved.source}`);
          console.log(
            `Recs      : ${result.report.recommendations.length}`,
          );
          console.log(
            `Categories: agent-harness ${c["agent-harness"]} · package-scripts ${c["package-scripts"]} · secrets-hygiene ${c["secrets-hygiene"]} · config-surface ${c["config-surface"]}`,
          );
          console.log(
            `Draft     : ${opts.draft ? `${result.draftPaths.length} note(s) (human-gated)` : "off (recommendations only)"}`,
          );
          console.log("");
          console.log(`JSON      : ${result.hardenJsonPath}`);
          console.log(`Markdown  : ${result.hardenMdPath}`);
          if (result.draftDir) {
            console.log(`Drafts    : ${result.draftDir}`);
          }
          console.log(`README    : ${result.readmePath}`);
          console.log("");
          console.log(
            "Recommend-only — no auto-apply · no auto-PR · no auto-merge.",
          );
          console.log(
            "Posture: Desk harden · not vuln discovery · no PoC · secrets redacted · needs human",
          );
        }
      } catch (e) {
        console.error(`harden failed: ${(e as Error).message}`);
        process.exitCode = 2;
      }
    },
  );

async function runCraftCli(opts: {
  from?: string;
  output: string;
  name: string;
  kind: string;
  intent?: string;
  json: boolean;
  fixture: boolean;
  defaultKind: "skill" | "plugin" | "both";
}): Promise<void> {
  const { writeCraftReport } = await import("../src/craft/index.ts");

  const kindRaw = (opts.kind || opts.defaultKind || "both").toLowerCase();
  const kind =
    kindRaw === "skill" || kindRaw === "plugin" || kindRaw === "both"
      ? kindRaw
      : opts.defaultKind;

  const resolved = resolveDeskReportsFrom({
    fixture: opts.fixture,
    from: opts.from,
    cwd: process.cwd(),
    repoRoot: REPO_ROOT,
    command: "craft",
  });
  const fromDir = resolved.path;

  try {
    const result = writeCraftReport(fromDir, opts.output, {
      name: opts.name,
      kind,
      intent: opts.intent,
    });

    if (opts.json) {
      console.log(JSON.stringify(result.report, null, 2));
    } else {
      console.log("");
      console.log("ZERODAY craft (Desk D)");
      console.log("─────────────────────");
      console.log(`From      : ${fromDir}`);
      console.log(`Source    : ${resolved.source}`);
      console.log(`Name      : ${result.report.name}`);
      console.log(`Kind      : ${result.report.kind}`);
      console.log(`Patterns  : ${result.report.patterns.length}`);
      console.log(`Scaffolds : ${result.report.scaffolds.length}`);
      console.log("");
      console.log(`JSON      : ${result.craftJsonPath}`);
      console.log(`Markdown  : ${result.craftMdPath}`);
      for (const p of result.skillPaths) {
        console.log(`Skill     : ${p}`);
      }
      for (const p of result.pluginPaths) {
        console.log(`Plugin    : ${p}`);
      }
      console.log(`README    : ${result.readmePath}`);
      console.log("");
      console.log(
        "Generate-only — no auto-install · no marketplace publish.",
      );
      console.log(
        "Posture: defensive habits · refuses exploits, PoCs · needs human",
      );
    }
  } catch (e) {
    const refuse =
      e &&
      typeof e === "object" &&
      "refuse" in e &&
      (e as { refuse?: { message?: string } }).refuse;
    if (refuse?.message) {
      console.error(refuse.message);
      process.exitCode = 3;
      return;
    }
    throw e;
  }
}

function registerCraftCommand(
  name: string,
  description: string,
  defaultKind: "skill" | "plugin" | "both",
  defaultOutput: string,
): void {
  program
    .command(name)
    .description(description)
    .option(
      "--from <dir>",
      "Reports directory with Desk B/A/C/E artifacts (default: zeroday-reports/ then docs/reports)",
    )
    .option("--output <dir>", "Craft output directory", defaultOutput)
    .option(
      "--name <slug>",
      "Scaffold name (defensive only — offensive names are refused)",
      "zeroday-defensive-operator",
    )
    .option(
      "--kind <skill|plugin|both>",
      `Emit skill, plugin stub, or both (default: ${defaultKind})`,
      defaultKind,
    )
    .option(
      "--intent <text>",
      "Optional free-text intent (scanned; offensive/PoC/attack patterns refused)",
    )
    .option("--json", "Print craft.json to stdout", false)
    .option(
      "--fixture",
      "Use checked-in docs/reports Desk artifacts as --from (CI smoke)",
      false,
    )
    .action(
      async (opts: {
        from?: string;
        output: string;
        name: string;
        kind: string;
        intent?: string;
        json: boolean;
        fixture: boolean;
      }) => {
        try {
          await runCraftCli({ ...opts, defaultKind });
        } catch (e) {
          console.error(`${name} failed: ${(e as Error).message}`);
          process.exitCode = 2;
        }
      },
    );
}

registerCraftCommand(
  "craft",
  "Desk D: generate defensive Cursor/Grok SKILL.md + plugin stub from Desk B→A→C→E patterns (generate-only)",
  "both",
  "zeroday-reports/craft",
);
registerCraftCommand(
  "skill",
  "Desk D alias: generate defensive SKILL.md scaffold (same as craft --kind skill)",
  "skill",
  "zeroday-reports/craft-skill",
);
registerCraftCommand(
  "plugin",
  "Desk D alias: generate defensive plugin stub (same as craft --kind plugin)",
  "plugin",
  "zeroday-reports/craft-plugin",
);

program
  .command("packet")
  .description(
    "Desk A: offline security packet from real inventory reports / --from (no auto-send; --fixture for smoke)",
  )
  .option(
    "--from <dir>",
    "Reports directory with inventory.json / desk-b-inventory.json + SARIF (default: zeroday-reports/ then docs/reports)",
  )
  .option(
    "--output <dir>",
    "Packet output directory",
    "zeroday-reports/security-packet",
  )
  .option("--module-link <url>", "Optional module/product link placeholder")
  .option("--pr-link <url>", "Optional PR link placeholder")
  .option("--ticket-link <url>", "Optional ticket link placeholder")
  .option("--json", "Print packet.json to stdout", false)
  .option(
    "--fixture",
    "Use checked-in docs/reports Desk artifacts as --from (CI smoke)",
    false,
  )
  .action(
    async (opts: {
      from?: string;
      output: string;
      moduleLink?: string;
      prLink?: string;
      ticketLink?: string;
      json: boolean;
      fixture: boolean;
    }) => {
      try {
        const { writeSecurityPacket } = await import("../src/packet/index.ts");

        const resolved = resolveDeskReportsFrom({
          fixture: opts.fixture,
          from: opts.from,
          cwd: process.cwd(),
          repoRoot: REPO_ROOT,
          command: "packet",
        });
        const fromDir = resolved.path;

        const result = writeSecurityPacket(fromDir, opts.output, {
          moduleLink: opts.moduleLink,
          prLink: opts.prLink,
          ticketLink: opts.ticketLink,
        });

        if (opts.json) {
          console.log(JSON.stringify(result.packet, null, 2));
        } else {
          const c = result.packet.classificationCounts;
          console.log("");
          console.log("ZERODAY security packet (Desk A)");
          console.log("────────────────────────────────");
          console.log(`From      : ${fromDir}`);
          console.log(`Source    : ${resolved.source}`);
          console.log(`Findings  : ${result.packet.findings.length}`);
          console.log(
            `Labels    : agent-misfire ${c["agent-misfire"]} · config ${c.config} · dependency ${c.dependency} · unknown ${c.unknown}`,
          );
          console.log("");
          console.log(`Packet    : ${result.packetJsonPath}`);
          console.log(`Summary   : ${result.summaryPath}`);
          console.log(`Findings  : ${result.findingsJsonPath}`);
          for (const s of result.sarifPaths) {
            console.log(`SARIF     : ${s}`);
          }
          console.log(`README    : ${result.readmePath}`);
          console.log("");
          console.log(
            "Share manually with security — ZERODAY does not auto-post.",
          );
          console.log(
            "Posture: Desk packet · not vuln discovery · no PoC · secrets redacted · no auto-send",
          );
        }
      } catch (e) {
        console.error(`packet failed: ${(e as Error).message}`);
        process.exitCode = 2;
      }
    },
  );

const antares = program
  .command("antares")
  .description(
    "Opt-in live Antares helpers (print-only by default — never auto-provisions GPUs)",
  );

antares
  .command("doctor")
  .description(
    "Print Secure A40 / HF / terminate-after-use checklist (wraps scripts/runpod-vllm-antares.sh --print-only; no spend)",
  )
  .option(
    "--smoke-env",
    "Also validate ZERODAY_* remote env names locally (still no RunPod API)",
    false,
  )
  .action((opts: { smokeEnv: boolean }) => {
    const script = path.join(REPO_ROOT, "scripts", "runpod-vllm-antares.sh");
    if (!fs.existsSync(script)) {
      console.error(`Missing ${script}`);
      process.exitCode = 2;
      return;
    }
    console.log("");
    console.log("ZERODAY antares doctor");
    console.log("──────────────────────");
    console.log(
      "Print-only checklist. Does NOT create RunPod pods, download weights, or spend money.",
    );
    console.log(
      "HF gated terms are human-only. After live locate → SARIF, terminate the pod.",
    );
    console.log("Full recipe: docs/runpod-antares.md");
    console.log("");

    const print = spawnSync("bash", [script, "--print-only"], {
      encoding: "utf8",
      cwd: REPO_ROOT,
    });
    if (print.stdout) process.stdout.write(print.stdout);
    if (print.stderr) process.stderr.write(print.stderr);
    if (print.status !== 0) {
      process.exitCode = print.status ?? 2;
      return;
    }

    if (opts.smokeEnv) {
      console.log("");
      const smoke = spawnSync("bash", [script, "--smoke-env"], {
        encoding: "utf8",
        cwd: REPO_ROOT,
        env: process.env,
      });
      if (smoke.stdout) process.stdout.write(smoke.stdout);
      if (smoke.stderr) process.stderr.write(smoke.stderr);
      if (smoke.status !== 0) process.exitCode = smoke.status ?? 2;
    }
  });

const factory = program
  .command("factory")
  .description(
    "Localization & Evidence Defense Factory loop (inventory→locate→classify→own→verify)",
  );

factory
  .command("run")
  .description(
    "Walk inventory → locate → classify → ownership → optional draft → defend → verify",
  )
  .option("--cwe <id>", "CWE id (e.g. CWE-89)")
  .option("--cve <id>", "CVE id")
  .option("--ghsa <id>", "GHSA id")
  .option("--map-cwe <id>", "Explicit CWE override when CVE/GHSA cannot be resolved")
  .option("--repo <path>", "Local repository path (default: fixture demo-app)", "")
  .option("--fixture", "CI-safe fixture locate (default when no live endpoint)", true)
  .option("--no-fixture", "Allow live locate when --endpoint / provider is set")
  .option("--offline", "Skip NVD/GHSA network resolve", true)
  .option("--output <dir>", "Factory run output directory")
  .option(
    "--classify-scenario <name>",
    "Optional fixtures/classify scenario (e.g. software_defect)",
  )
  .option(
    "--defend",
    "Run defend-only harness (existing tests / fail-closed — never exploit repro)",
    false,
  )
  .option(
    "--run-tests",
    "With --defend: execute existing package test script (still defend-only)",
    false,
  )
  .option("--i-asked-for-a-fix", "Human gate: emit CodeGuard patch DRAFT", false)
  .option(
    "--remote-inference",
    "ACK: prompts/repo-derived context may leave the machine (remote CUDA/vLLM)",
    false,
  )
  .option(
    "--provider <name>",
    "Inference provider: local|remote (aliases: runpod, nebius → remote)",
  )
  .option(
    "--endpoint <url>",
    "Completions base URL (local loopback or remote with --remote-inference)",
  )
  .option("--model <id>", "Served model id for live locate")
  .option("--live", "Force live Antares path (requires --endpoint)", false)
  .option("--json", "Print FactoryRunSummary JSON", false)
  .action(async (opts: {
    cwe?: string;
    cve?: string;
    ghsa?: string;
    mapCwe?: string;
    repo: string;
    fixture: boolean;
    offline: boolean;
    output?: string;
    classifyScenario?: string;
    defend: boolean;
    runTests: boolean;
    iAskedForAFix: boolean;
    remoteInference: boolean;
    provider?: string;
    endpoint?: string;
    model?: string;
    live: boolean;
    json: boolean;
  }) => {
    const advisory = opts.cwe || opts.cve || opts.ghsa;
    if (!advisory) {
      console.error(
        "Provide one of --cwe, --cve, or --ghsa.\n" +
          "Example: zeroday factory run --cwe CWE-89 --fixture --defend",
      );
      process.exitCode = 2;
      return;
    }
    if ([opts.cwe, opts.cve, opts.ghsa].filter(Boolean).length > 1) {
      console.error("Pass only one of --cwe / --cve / --ghsa.");
      process.exitCode = 2;
      return;
    }

    const repo =
      opts.repo && opts.repo.length > 0
        ? path.resolve(opts.repo)
        : defaultFixtureRepo();

    try {
      const provider = opts.provider
        ? resolveInferenceProvider({
            provider: opts.provider,
            endpoint: opts.endpoint,
            remoteInference: opts.remoteInference,
          }).provider
        : undefined;

      const artifacts = await runFactory({
        repo,
        advisory,
        outputDir: opts.output,
        fixture: opts.fixture,
        offline: opts.offline,
        explicitCwe: opts.mapCwe,
        classifyScenario: opts.classifyScenario,
        defend: opts.defend,
        runTests: opts.runTests,
        iAskedForAFix: opts.iAskedForAFix,
        remoteInference: opts.remoteInference,
        inferenceProvider: provider,
        endpoint: opts.endpoint,
        model: opts.model,
        live: opts.live,
      });

      if (opts.json) {
        console.log(JSON.stringify(artifacts.summary, null, 2));
      } else {
        const s = artifacts.summary;
        console.log("");
        console.log("ZERODAY factory run");
        console.log("──────────────────");
        console.log(`Run       : ${s.runId}`);
        console.log(`Advisory  : ${s.advisory}`);
        console.log(`Findings  : ${s.findingCount}`);
        console.log(`Locate    : ${s.locateMode ?? "—"}`);
        console.log(
          `Classify  : ${s.stages.classify ? s.classification ?? "yes" : "skipped"}`,
        );
        console.log(`Verify    : ${s.verifyOk ? "PASS" : "FAIL"}`);
        console.log(
          `Defend    : ${s.defendOk == null ? "skipped" : s.defendOk ? "PASS" : "FAIL"}`,
        );
        console.log(`Draft     : ${s.stages.draftFix ? "emitted (human gate)" : "skipped"}`);
        console.log(`Needs human: yes`);
        console.log("");
        console.log("Artifacts:");
        console.log(`  Summary  ${artifacts.paths.summaryMd}`);
        console.log(`  JSON     ${artifacts.paths.summaryJson}`);
        console.log(`  Inventory ${artifacts.paths.inventory}`);
        console.log(`  Ownership ${artifacts.paths.ownershipMd}`);
        console.log(`  Evidence ${artifacts.evidenceDir}`);
        console.log(`  Manifest ${artifacts.manifestPath}`);
        console.log("");
        console.log(
          "Posture: factory loop · localization only · not exploit proof · no PoC · no auto-merge · local-first default",
        );
        console.log(
          `Re-verify: npm run zeroday -- verify --from ${artifacts.outputDir}`,
        );
      }
      if (!artifacts.summary.verifyOk) process.exitCode = 1;
    } catch (e) {
      console.error(`factory run failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

factory
  .command("inventory")
  .description(
    "Write durable inventory (+ config hotspots / locate hints); same as `zeroday inventory`",
  )
  .option(
    "--repo <path>",
    "Local repo path (repeatable)",
    collectRepoOption,
    [] as string[],
  )
  .option(
    "--from <file>",
    "Inventory manifest (JSON or YAML) listing repos/paths",
  )
  .option(
    "--output <dir>",
    "Output directory for inventory.json + inventory.md",
  )
  .option("--json", "Print inventory JSON to stdout", false)
  .action(
    async (opts: {
      repo: string[];
      from?: string;
      output?: string;
      json: boolean;
    }) => {
      try {
        await runInventoryCli(opts);
      } catch (e) {
        console.error(`factory inventory failed: ${(e as Error).message}`);
        process.exitCode = 2;
      }
    },
  );

program
  .command("operate")
  .description(
    "Keyless agent operator: emit brief/schema, accept submission (or --fixture), write artifact + evidence pack",
  )
  .option("--cwe <id>", "CWE id (e.g. CWE-89)")
  .option("--cve <id>", "CVE id")
  .option("--ghsa <id>", "GHSA id")
  .option("--map-cwe <id>", "Explicit CWE override when CVE/GHSA cannot be resolved")
  .option("--repo <path>", "Local repository path (default: fixture demo-app)", "")
  .option("--fixture", "Use recorded agent submission (CI — offline/keyless)", false)
  .option("--from <submission.json>", "Path to agent submission JSON")
  .option("--stdin", "Read submission JSON from stdin", false)
  .option("--brief-only", "Emit operator brief + schema only (alias of --emit-brief)", false)
  .option("--emit-brief", "Emit operator brief + schema + AGENT_PROMPT (await agent)", false)
  .option(
    "--agent <flavor>",
    "One-shot prompt flavor: cursor | stdout | claude (implies --emit-brief)",
  )
  .option("--offline", "Skip NVD/GHSA network resolve", false)
  .option("--output <dir>", "Report output directory")
  .option("--json", "Print LocalizationResult JSON to stdout", false)
  .action(async (opts: {
    cwe?: string;
    cve?: string;
    ghsa?: string;
    mapCwe?: string;
    repo: string;
    fixture: boolean;
    from?: string;
    stdin: boolean;
    briefOnly: boolean;
    emitBrief: boolean;
    agent?: string;
    offline: boolean;
    output?: string;
    json: boolean;
  }) => {
    const advisory = opts.cwe || opts.cve || opts.ghsa;
    if (!advisory) {
      console.error(
        "Provide one of --cwe, --cve, or --ghsa.\n" +
          "Example: zeroday operate --cwe CWE-89 --fixture",
      );
      process.exitCode = 2;
      return;
    }
    if ([opts.cwe, opts.cve, opts.ghsa].filter(Boolean).length > 1) {
      console.error("Pass only one of --cwe / --cve / --ghsa.");
      process.exitCode = 2;
      return;
    }

    const repo =
      opts.repo && opts.repo.length > 0
        ? path.resolve(opts.repo)
        : defaultFixtureRepo();

    const agentFlavor =
      opts.agent === "cursor" || opts.agent === "claude" || opts.agent === "stdout"
        ? opts.agent
        : opts.agent
          ? null
          : undefined;
    if (opts.agent && agentFlavor === null) {
      console.error("--agent must be one of: cursor | stdout | claude");
      process.exitCode = 2;
      return;
    }

    const emitBrief =
      opts.emitBrief || opts.briefOnly || Boolean(agentFlavor);

    try {
      const artifacts = await operate({
        repo,
        advisory,
        fixture: opts.fixture,
        from: opts.from,
        stdin: opts.stdin,
        briefOnly: emitBrief,
        emitBrief,
        agentPrompt: agentFlavor || (emitBrief ? "stdout" : undefined),
        offline: opts.offline,
        explicitCwe: opts.mapCwe,
        outputDir: opts.output,
      });

      if (opts.json) {
        console.log(JSON.stringify(artifacts.result, null, 2));
      } else {
        console.log("");
        console.log("ZERODAY operate (keyless agent operator)");
        console.log("───────────────────────────────────────");
        console.log(`Advisory : ${artifacts.result.advisory.id} → ${artifacts.result.advisory.cweId}`);
        console.log(`Mode     : ${artifacts.result.mode}`);
        console.log(`Run      : ${artifacts.runId}`);
        console.log(`Findings : ${artifacts.result.summary.findingCount}`);
        console.log("");
        console.log("Operator pack:");
        console.log(`  Brief    ${artifacts.briefPath}`);
        console.log(`  Spec     ${artifacts.instructionsPath}`);
        console.log(`  Schema   ${artifacts.schemaPath}`);
        console.log(`  Submit   ${artifacts.submissionPath}`);
        if (artifacts.agentPromptPath) {
          console.log(`  Prompt   ${artifacts.agentPromptPath}`);
        }
        if (emitBrief) {
          console.log("");
          console.log("Next (coding agent):");
          console.log(`  1. Follow ${artifacts.agentPromptPath || artifacts.instructionsPath}`);
          console.log(`  2. Explore readonly-snapshot/ (or repo) with list/grep/read only`);
          console.log(`  3. Write ${artifacts.submissionPath}`);
          console.log(
            `  4. npm run zeroday -- operate --cwe ${artifacts.result.advisory.cweId} --from ${artifacts.submissionPath} --repo ${repo} --output ${artifacts.outputDir}-packaged`,
          );
          console.log(`  5. npm run zeroday -- verify --from <packaged-run-dir>`);
        }
        if (artifacts.jsonPath) {
          console.log("");
          console.log("Artifacts:");
          console.log(`  JSON     ${artifacts.jsonPath}`);
          console.log(`  SARIF    ${artifacts.sarifPath}`);
          console.log(`  Report   ${artifacts.reportPath}`);
          console.log(`  Comment  ${artifacts.commentPath}`);
          for (const p of artifacts.exportPaths) {
            if (p !== artifacts.sarifPath) {
              console.log(`  Export   ${p}`);
            }
          }
          console.log(`  Evidence ${artifacts.evidenceDir}`);
          console.log(`  Manifest ${artifacts.manifestPath}`);
        }
        console.log("");
        console.log(
          "Posture: keyless default · localization only · not exploit proof · no PoC · needs_human · no auto-merge",
        );
        if (artifacts.jsonPath) {
          console.log(
            `Verify:  npm run zeroday -- verify --from ${artifacts.outputDir}`,
          );
        }
        if (agentFlavor && artifacts.agentPromptPath) {
          console.log("");
          console.log("——— agent one-shot prompt ———");
          process.stdout.write(fs.readFileSync(artifacts.agentPromptPath, "utf8"));
        }
      }
    } catch (e) {
      console.error(`operate failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("verify")
  .description(
    "Offline-verify evidence vault hashes + manifest schema for a run directory",
  )
  .requiredOption("--from <run-dir>", "Path to zeroday-reports/<run-id>")
  .option("--json", "Print VerifyResult JSON", false)
  .action((opts: { from: string; json: boolean }) => {
    try {
      const result = verifyRunDir(opts.from);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("");
        console.log("ZERODAY verify");
        console.log("─────────────");
        console.log(`Run dir  : ${result.runDir}`);
        console.log(`Checked  : ${result.checked}`);
        console.log(`Status   : ${result.ok ? "PASS" : "FAIL"}`);
        if (!result.ok) {
          for (const f of result.failures) {
            console.log(`  ✗ ${f.path}: ${f.reason}`);
          }
          process.exitCode = 1;
        } else {
          console.log("Hashes + schema OK (offline).");
        }
      }
      if (!result.ok) process.exitCode = 1;
    } catch (e) {
      console.error(`verify failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("plan")
  .description(
    "Preview CWE portfolio via official `antares plan` (local, no inference)",
  )
  .argument("[repo]", "Repository path", "")
  .option("--max-cwes <n>", "Max automatic CWE checks", "5")
  .option("--cwe <id>", "Exact CWE id(s), comma-separated (expert mode)")
  .option("--format <fmt>", "summary|json", "json")
  .action(
    async (
      repoArg: string,
      opts: { maxCwes: string; cwe?: string; format: string },
    ) => {
      const repo =
        repoArg && repoArg.length > 0
          ? path.resolve(repoArg)
          : defaultFixtureRepo();
      const result = runAntaresPlan(repo, {
        maxCwes: Number(opts.maxCwes) || 5,
        cwe: opts.cwe,
        format: opts.format === "summary" ? "summary" : "json",
      });
      if (!result.ok) {
        console.error(result.stderr || "antares plan failed");
        console.error(
          "Tip: install with `uv tool install cisco-antares-cli` (no weights needed for plan).",
        );
        process.exitCode = 2;
        return;
      }
      process.stdout.write(result.stdout);
    },
  );

program
  .command("locate")
  .description(
    "Localize vulnerability candidates (wraps `antares query` when live). Defensive only.",
  )
  .option("--cwe <id>", "CWE id (e.g. CWE-89)")
  .option("--cve <id>", "CVE id (resolved to CWE via vendored map / NVD)")
  .option("--ghsa <id>", "GHSA id (resolved to CWE via vendored map / GHSA API)")
  .option(
    "--map-cwe <id>",
    "Explicit CWE override when CVE/GHSA cannot be resolved",
  )
  .option(
    "--repo <path>",
    "Local repository path (default: fixture demo-app)",
    "",
  )
  .option("--fixture", "CI / no-GPU: recorded localization (not the live product path)", false)
  .option(
    "--rules",
    "Keyless real-repo heuristics (mode=rules). Incompatible with --fixture / --from-sarif / --live / --endpoint. Not Antares F1.",
    false,
  )
  .option(
    "--from-sarif <path>",
    "Ingest local SARIF 2.1 (CodeQL/Semgrep/generic) → mode=ingest. File path only — no alerts API. Incompatible with --fixture / --rules / --live / --endpoint.",
  )
  .option("--live", "Force live official Antares CLI path (requires --endpoint)", false)
  .option("--offline", "Skip NVD/GHSA network resolve", false)
  .option("--output <dir>", "Report output directory")
  .option(
    "--endpoint <url>",
    "Local or opt-in remote vLLM completions endpoint (implies live; refuses --fixture/--rules/--from-sarif). Completions only.",
  )
  .option(
    "--remote-inference",
    "ACK: non-loopback endpoint may receive prompts/repo-derived context (RunPod/remote)",
    false,
  )
  .option(
    "--model <id>",
    `Served model id (live; default ${DEFAULT_ANTARES_MODEL} or ANTARES_MODEL)`,
  )
  .option(
    "--tool-budget <n>",
    `Antares exploration budget 1–50 (live; default ${DEFAULT_LIVE_TOOL_BUDGET})`,
  )
  .option(
    "--fail-on-incomplete",
    "Exit 2 when live run is incomplete (default for live)",
  )
  .option(
    "--no-fail-on-incomplete",
    "Allow incomplete live runs to exit 0 (still writes report)",
    false,
  )
  .option(
    "--no-live-recovery",
    "Skip best-effort live re-query when model stops without submit",
    false,
  )
  .option("--fail-on-findings", "Exit 1 when ranked files are non-empty", false)
  .option("--json", "Print LocalizationResult JSON to stdout", false)
  .action(async (opts: {
    cwe?: string;
    cve?: string;
    ghsa?: string;
    mapCwe?: string;
    repo: string;
    fixture: boolean;
    rules: boolean;
    fromSarif?: string;
    live: boolean;
    offline: boolean;
    output?: string;
    endpoint?: string;
    remoteInference: boolean;
    model?: string;
    toolBudget?: string;
    failOnIncomplete?: boolean;
    noFailOnIncomplete: boolean;
    noLiveRecovery: boolean;
    failOnFindings: boolean;
    json: boolean;
  }) => {
    const fromSarif =
      opts.fromSarif && opts.fromSarif.trim().length > 0
        ? path.resolve(opts.fromSarif.trim())
        : undefined;
    const advisory = opts.cwe || opts.cve || opts.ghsa;
    if (!advisory && !fromSarif) {
      console.error(
        "Provide one of --cwe, --cve, or --ghsa (or --from-sarif for ingest).\n" +
          "Example: zeroday locate --cwe CWE-89 --fixture\n" +
          "Keyless real-repo: zeroday locate --cwe CWE-89 --repo <path> --rules\n" +
          "SARIF ingest: zeroday locate --from-sarif path/to/report.sarif",
      );
      process.exitCode = 2;
      return;
    }
    if ([opts.cwe, opts.cve, opts.ghsa].filter(Boolean).length > 1) {
      console.error("Pass only one of --cwe / --cve / --ghsa.");
      process.exitCode = 2;
      return;
    }

    const repo =
      opts.repo && opts.repo.length > 0
        ? path.resolve(opts.repo)
        : fromSarif
          ? process.cwd()
          : defaultFixtureRepo();

    const endpoint =
      opts.endpoint ||
      process.env.ZERODAY_ANTARES_BASE_URL ||
      process.env.ANTARES_ENDPOINT ||
      undefined;

    const liveRequested = Boolean(opts.live || endpoint);
    const model = liveRequested
      ? resolveLiveModel(opts.model)
      : opts.model || process.env.ANTARES_MODEL;

    const toolBudgetRaw = opts.toolBudget
      ? Number(opts.toolBudget)
      : undefined;
    const toolBudget =
      toolBudgetRaw != null && Number.isFinite(toolBudgetRaw)
        ? toolBudgetRaw
        : undefined;

    let failOnIncomplete: boolean | undefined;
    if (opts.noFailOnIncomplete) failOnIncomplete = false;
    else if (opts.failOnIncomplete === true) failOnIncomplete = true;

    try {
      const artifacts = await locate({
        repo,
        advisory: advisory || "",
        fixture: opts.fixture,
        rules: opts.rules,
        fromSarif,
        live: opts.live,
        offline: opts.offline,
        explicitCwe: opts.mapCwe || (opts.cwe && opts.cve ? opts.cwe : undefined),
        outputDir: opts.output,
        endpoint: endpoint
          ? normalizeCompletionsEndpoint(endpoint)
          : undefined,
        model,
        toolBudget,
        failOnIncomplete,
        liveRecovery: !opts.noLiveRecovery,
        failOnFindings: opts.failOnFindings,
        remoteInference: opts.remoteInference,
      });

      if (opts.json) {
        console.log(JSON.stringify(artifacts.result, null, 2));
      } else {
        const r = artifacts.result;
        console.log("");
        console.log("ZERODAY locate");
        console.log("──────────────");
        console.log(`Advisory : ${r.advisory.id} → ${r.advisory.cweId}`);
        console.log(`Mode     : ${r.mode}`);
        console.log(`Model    : ${r.model}`);
        console.log(`Target   : ${r.targetRepo}`);
        console.log(`Findings : ${r.summary.findingCount}`);
        if (r.summary.incompleteReason) {
          console.log(`Incomplete: yes [${r.summary.incompleteClass ?? "unknown"}]`);
        }
        console.log("");
        if (r.rankedFiles.length) {
          console.log("Ranked files:");
          for (const f of r.rankedFiles) {
            console.log(
              `  ${f.rank}. ${f.filePath}  [${f.cweIds.join(",")}]  ${f.title}`,
            );
          }
          console.log("");
        } else if (r.summary.incompleteReason) {
          console.log(
            "No submission — incomplete localization (not a clean negative; findings not invented).",
          );
          console.log("");
          console.log(
            formatIncompleteCliBlock({
              incomplete: true,
              class: r.summary.incompleteClass ?? "unknown",
              reason: r.summary.incompleteReason,
              tips: r.summary.incompleteTips ?? [],
            }),
          );
          console.log("");
        } else {
          console.log("No vulnerable files submitted.");
          console.log("");
        }
        console.log("Artifacts:");
        console.log(`  JSON     ${artifacts.jsonPath}`);
        console.log(`  SARIF    ${artifacts.sarifPath}`);
        console.log(`  Report   ${artifacts.reportPath}`);
        console.log(`  Comment  ${artifacts.commentPath}`);
        for (const p of artifacts.exportPaths) {
          if (p !== artifacts.sarifPath) {
            console.log(`  Export   ${p}`);
          }
        }
        if (artifacts.manifestPath) {
          console.log(`  Evidence ${artifacts.evidenceDir}`);
          console.log(`  Manifest ${artifacts.manifestPath}`);
        }
        console.log("");
        console.log(
          "Posture: localization only · detector-lane candidate · not exploit proof · no PoC · no auto-merge",
        );
        if (r.mode === "fixture") {
          const live = detectAntaresCli();
          console.log("");
          console.log(
            "Note: this was the CI / no-GPU fixture path — not live Antares inference.",
          );
          console.log(
            live.binary
              ? `Live path: npm run zeroday -- locate --cwe ${r.advisory.cweId} --repo <path> --endpoint http://127.0.0.1:8000/v1`
              : `Tip: ${live.sourceHint}`,
          );
          console.log(
            "Helper: bash scripts/quickstart-live.sh <repo> [CWE]  (refuses silent fixture fallback)",
          );
          console.log(
            "Keyless real-repo (no weights): npm run zeroday -- locate --cwe CWE-89 --repo <path> --rules",
          );
          console.log(
            "SARIF ingest (local file): npm run zeroday -- locate --from-sarif path/to/report.sarif",
          );
        } else if (r.mode === "rules") {
          console.log("");
          console.log(
            "Rules path complete — thin in-repo heuristics (not Antares F1; not exploitability).",
          );
          console.log(
            "Live Antares (opt-in): locate --endpoint … · Fixture smoke: locate --fixture / npm run mvp · Ingest: locate --from-sarif …",
          );
        } else if (r.mode === "ingest") {
          console.log("");
          console.log(
            "Ingest path complete — third-party SARIF (not Antares/rules discovery; not exploitability).",
          );
          console.log(
            "Fixture smoke: locate --fixture / npm run mvp · Rules: locate --rules · Live: locate --endpoint …",
          );
        } else if (r.mode === "live") {
          console.log("");
          console.log(
            "Live Antares path complete — report.sarif is from real inference (not fixture).",
          );
        }
      }

      if (opts.failOnFindings && artifacts.result.rankedFiles.length > 0) {
        process.exitCode = 1;
      }
      if (artifacts.failIncomplete) {
        process.exitCode = 2;
      }
    } catch (e) {
      console.error(`locate failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("export")
  .description(
    "Project report.json into defender schemas (local files only — no vendor cloud calls)",
  )
  .requiredOption(
    "--format <fmt>",
    `One of: ${EXPORT_FORMATS.join("|")}`,
  )
  .option(
    "--from <report.json>",
    "Path to LocalizationResult report.json",
  )
  .option("--output <path>", "Output file path")
  .option("--aws-account-id <id>", "ASFF AwsAccountId placeholder")
  .option("--region <region>", "ASFF region placeholder", "us-east-1")
  .action((opts: {
    format: string;
    from?: string;
    output?: string;
    awsAccountId?: string;
    region: string;
  }) => {
    const format = opts.format as ExportFormat;
    if (!EXPORT_FORMATS.includes(format)) {
      console.error(
        `Unknown format '${opts.format}'. Use: ${EXPORT_FORMATS.join("|")}`,
      );
      process.exitCode = 2;
      return;
    }
    if (!opts.from) {
      console.error("Provide --from path/to/report.json");
      process.exitCode = 2;
      return;
    }
    try {
      const result = loadResult(opts.from);
      const out =
        opts.output ||
        path.join(path.dirname(path.resolve(opts.from)), defaultExportFilename(format));
      const written = writeExport(result, format, out, {
        awsAccountId: opts.awsAccountId,
        region: opts.region,
      });
      console.log(`Wrote ${written.format} → ${written.path} (${written.bytes} bytes)`);
      console.log("Local file only — no vendor API push.");
    } catch (e) {
      console.error(`export failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("classify")
  .description(
    "Desk E: crash classify + evidence from real reports / --from (human review; --fixture for smoke). Classification ≠ exploitability.",
  )
  .option(
    "--from <path>",
    "Locate report.json OR reports directory (default: zeroday-reports/ then docs/reports)",
  )
  .option(
    "--scenario <name>",
    `Bundled fixtures/classify/<name> (${listClassifyScenarios().join("|") || "see fixtures/classify"})`,
  )
  .option(
    "--telemetry <file.json>",
    "Local zeroday-telemetry-v1 fixture (no live Cisco/Splunk feeds)",
  )
  .option(
    "--output <dir>",
    "Output directory for classify.md + classify.json (+ ciso.*)",
    "zeroday-reports/classify",
  )
  .option(
    "--fixture",
    "Use fixtures/classify/software_defect as --from (offline / CI smoke)",
    false,
  )
  .option("--json", "Print classify.json evidence pack to stdout", false)
  .action((opts: {
    from?: string;
    scenario?: string;
    telemetry?: string;
    output: string;
    fixture: boolean;
    json: boolean;
  }) => {
    try {
      let from = opts.from;
      let fromSource: string | undefined;

      if (opts.fixture || (!opts.from && !opts.scenario && !opts.telemetry)) {
        try {
          const resolved = resolveClassifyFromPath({
            fixture: opts.fixture,
            from: opts.from,
            cwd: process.cwd(),
            repoRoot: REPO_ROOT,
            command: "classify",
          });
          from = resolved.path;
          fromSource = resolved.source;
        } catch (e) {
          if (opts.fixture) throw e;
          // No real reports and no flags — keep prior helpful error
          console.error((e as Error).message);
          process.exitCode = 2;
          return;
        }
      }

      if (!from && !opts.scenario && !opts.telemetry) {
        console.error(
          "Provide --from <dir|report.json>, --fixture, --scenario <name>, and/or --telemetry <file.json>",
        );
        process.exitCode = 2;
        return;
      }

      const artifacts = runClassify({
        from,
        scenario: opts.scenario,
        telemetry: opts.telemetry,
        outputDir: opts.output,
      });
      if (opts.json) {
        console.log(JSON.stringify(artifacts.pack, null, 2));
      } else {
        console.log("");
        console.log("ZERODAY classify (Desk E)");
        console.log("────────────────────────");
        console.log(`From           : ${from ?? opts.scenario ?? "adhoc"}`);
        if (fromSource) console.log(`Source         : ${fromSource}`);
        console.log(`Classification : ${artifacts.pack.classification}`);
        console.log(`Confidence     : ${artifacts.pack.confidence}`);
        console.log(`Needs human    : yes (always)`);
        console.log(
          `≠ exploitability: yes (classification is not exploitability)`,
        );
        console.log(`Evidence JSON  : ${artifacts.classifyJsonPath}`);
        console.log(`Classify MD    : ${artifacts.classifyMdPath}`);
        console.log(`CISO JSON      : ${artifacts.cisoJsonPath}`);
        console.log(`CISO report    : ${artifacts.cisoMdPath}`);
        console.log("");
        console.log(
          "Honesty: Desk E crash classify · not vuln discovery · not production SOC · classification ≠ exploitability · no auto-remediate · no auto-merge",
        );
      }
    } catch (e) {
      console.error(`classify failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("demo")
  .description(
    "Exec mixed fixture pack: all four finding classes + SARIF + Splunk CIM + CISO markdown (no weights, no live network)",
  )
  .option(
    "--output <dir>",
    "Pack output directory",
    "zeroday-reports/mixed-pack",
  )
  .action(async (opts: { output: string }) => {
    try {
      const pack = await runMixedPack(opts.output);
      console.log("");
      console.log("ZERODAY mixed fixture pack");
      console.log("─────────────────────────");
      console.log(`Output     : ${pack.outputDir}`);
      console.log(`SARIF      : ${pack.sarifPath}`);
      console.log(`Splunk CIM : ${pack.splunkPath}`);
      console.log(`ASFF       : ${pack.asffPath}`);
      console.log(`Pack MD    : ${pack.packMarkdownPath}`);
      console.log(`Pack JSON  : ${pack.packJsonPath}`);
      console.log(`Class Splunk: ${pack.packSplunkPath}`);
      console.log("");
      console.log("Classes:");
      for (const c of pack.cases) {
        console.log(
          `  ${c.scenario.padEnd(18)} → ${c.classification}` +
            (c.east_west_suspected ? " (east-west suspected from telemetry INPUT)" : ""),
        );
      }
      console.log("");
      console.log(
        "Honesty: fixture-driven · telemetry INPUT only · not live SOC · not live agent-misfire detection · human review required · no auto-merge",
      );
    } catch (e) {
      console.error(`demo failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("play")
  .description(
    "Local fixture playground — print how-to URL, or run locate/classify/demo without the UI",
  )
  .option(
    "--action <name>",
    "Optional headless run: locate | classify | demo (default: print start instructions)",
  )
  .option(
    "--scenario <name>",
    "Classify scenario when --action classify",
    "software_defect",
  )
  .action(async (opts: { action?: string; scenario: string }) => {
    if (!opts.action) {
      console.log("");
      console.log("ZERODAY local playground");
      console.log("───────────────────────");
      console.log("Start the local UI (fixtures only, no gated weights):");
      console.log("");
      console.log("  npm run play");
      console.log("  # alias:  npm run operator");
      console.log("");
      console.log("Then open:");
      console.log("  http://localhost:3333/play");
      console.log("  http://localhost:3333/          (Operator desk + playground)");
      console.log("");
      console.log("Headless fixture runs (same engines, no UI):");
      console.log("  npm run zeroday -- play --action locate");
      console.log("  npm run zeroday -- play --action classify --scenario possible_breach");
      console.log("  npm run zeroday -- play --action demo");
      console.log("");
      console.log(
        "Honesty: fixtures only · no live network · no weight download · no PoCs · no auto-merge",
      );
      return;
    }

    const {
      runPlaygroundLocate,
      runPlaygroundClassify,
      runPlaygroundDemo,
    } = await import("../src/playground/index.ts");

    try {
      if (opts.action === "locate") {
        const r = await runPlaygroundLocate();
        console.log(JSON.stringify(r, null, 2));
      } else if (opts.action === "classify") {
        const r = await runPlaygroundClassify({ scenario: opts.scenario });
        console.log(JSON.stringify(r, null, 2));
      } else if (opts.action === "demo") {
        const r = await runPlaygroundDemo();
        console.log(JSON.stringify(r, null, 2));
      } else {
        console.error(
          `Unknown --action '${opts.action}'. Use locate | classify | demo (or omit for start instructions).`,
        );
        process.exitCode = 2;
      }
    } catch (e) {
      console.error(`play failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("draft-fix")
  .description(
    "CodeGuard-aligned patch DRAFT (requires --i-asked-for-a-fix). Never auto-merge.",
  )
  .option(DRAFT_FIX_FLAG, "Required human gate — I asked for a fix", false)
  .option("--from <report.json>", "Path to LocalizationResult report.json")
  .option("--repo <path>", "Repo path for source context snippets")
  .option("--output <dir>", "Output directory for patch-draft.md")
  .option("--also-poc", "If set, refuse PoC/exploit in one sentence; still emit draft", false)
  .action((opts: {
    iAskedForAFix: boolean;
    from?: string;
    repo?: string;
    output?: string;
    alsoPoc: boolean;
  }) => {
    if (!opts.iAskedForAFix) {
      console.error(
        `draft-fix requires the explicit human flag ${DRAFT_FIX_FLAG}.`,
      );
      process.exitCode = 2;
      return;
    }
    if (!opts.from) {
      console.error("Provide --from path/to/report.json");
      process.exitCode = 2;
      return;
    }
    try {
      const result = loadResult(opts.from);
      const outputDir =
        opts.output ||
        path.join(path.dirname(path.resolve(opts.from)), "drafts");
      const alsoAskedForPoC =
        opts.alsoPoc ||
        requestLooksLikeExploit(process.argv.join(" "));
      const artifact = draftFix({
        iAskedForAFix: true,
        alsoAskedForPoC,
        result,
        repoPath: opts.repo ? path.resolve(opts.repo) : result.targetRepo,
        outputDir,
      });
      if (artifact.refusedExploit) {
        console.error(EXPLOIT_REFUSAL);
      }
      console.log(`Wrote patch DRAFT → ${artifact.path}`);
      console.log("Human review required. Never auto-merge.");
    } catch (e) {
      console.error(`draft-fix failed: ${(e as Error).message}`);
      process.exitCode = 2;
    }
  });

program
  .command("health")
  .description("Check local UI API health")
  .action(async () => {
    await api("/api/health");
  });

program
  .command("sweep")
  .description(
    "Wrap official `antares sweep` for live multi-CWE (needs local completions endpoint). Offline/fixture: clear message, exit 0.",
  )
  .argument("[repo]", "Repository path", "")
  .option("--max-cwes <n>", "Max automatic CWE checks", "5")
  .option("--workers <n>", "Concurrent investigations", "2")
  .option("--cwe <id>", "Exact CWE id(s), comma-separated")
  .option(
    "--endpoint <url>",
    "Local vLLM / OpenAI-compatible completions URL (required for live)",
  )
  .option(
    "--model <id>",
    `Served model id (default ${DEFAULT_ANTARES_MODEL} or ANTARES_MODEL)`,
  )
  .option("--output <dir>", "Antares sweep output directory")
  .option("--fixture", "Explicit offline/no-op mode", false)
  .action((
    repoArg: string,
    opts: {
      maxCwes: string;
      workers: string;
      cwe?: string;
      endpoint?: string;
      model?: string;
      output?: string;
      fixture: boolean;
    },
  ) => {
    const endpoint =
      opts.endpoint || process.env.ANTARES_ENDPOINT || undefined;
    if (opts.fixture || !endpoint) {
      console.log("");
      console.log("zeroday sweep — offline / no live endpoint");
      console.log("─────────────────────────────────────────");
      console.log(
        "Live multi-CWE sweep needs a local completions endpoint (Antares CLI + vLLM 0.19.1+).",
      );
      console.log("ZERODAY does not download model weights. CI stays fixture-only.");
      console.log("");
      console.log("Keyless default today:");
      console.log("  npm run zeroday -- operate --cwe CWE-89 --fixture");
      console.log("  npm run zeroday -- operate --cwe CWE-89 --emit-brief --agent cursor");
      console.log("");
      console.log("When you host Antares locally:");
      console.log(
        "  npm run zeroday -- sweep ./repo --endpoint http://127.0.0.1:8000/v1 --max-cwes 5",
      );
      process.exitCode = 0;
      return;
    }

    const repo =
      repoArg && repoArg.length > 0
        ? path.resolve(repoArg)
        : defaultFixtureRepo();
    const detected = detectAntaresCli();
    if (!detected.binary) {
      console.error(detected.sourceHint);
      process.exitCode = 2;
      return;
    }

    const result = runAntaresSweep(repo, {
      maxCwes: Number(opts.maxCwes) || 5,
      workers: Number(opts.workers) || 2,
      cwe: opts.cwe,
      endpoint: normalizeCompletionsEndpoint(endpoint),
      model: resolveLiveModel(opts.model),
      output: opts.output,
      noTui: true,
    });
    if (!result.ok) {
      console.error(result.stderr || "antares sweep failed");
      process.exitCode = 2;
      return;
    }
    process.stdout.write(result.stdout);
  });

program.parseAsync(process.argv);
