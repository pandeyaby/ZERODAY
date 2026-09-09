#!/usr/bin/env node
/**
 * ZERODAY CLI — defensive security operator harness.
 *
 *   zeroday operate --cwe CWE-89 --fixture          # keyless agent path (default)
 *   zeroday locate  --cwe CWE-89 --fixture          # Antares fixture / optional --live
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

const BASE = process.env.ZERODAY_URL || "http://127.0.0.1:3333";

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

const program = new Command();
program
  .name("zeroday")
  .description(
    "ZERODAY — keyless agent operator + optional local Antares localization (defensive only)",
  )
  .version("0.5.0");

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
  .option("--live", "Force live official Antares CLI path (requires --endpoint)", false)
  .option("--offline", "Skip NVD/GHSA network resolve", false)
  .option("--output <dir>", "Report output directory")
  .option(
    "--endpoint <url>",
    "Local vLLM completions endpoint (implies live; refuses --fixture). Completions only.",
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
    live: boolean;
    offline: boolean;
    output?: string;
    endpoint?: string;
    model?: string;
    toolBudget?: string;
    failOnIncomplete?: boolean;
    noFailOnIncomplete: boolean;
    noLiveRecovery: boolean;
    failOnFindings: boolean;
    json: boolean;
  }) => {
    const advisory = opts.cwe || opts.cve || opts.ghsa;
    if (!advisory) {
      console.error(
        "Provide one of --cwe, --cve, or --ghsa.\n" +
          "Example: zeroday locate --cwe CWE-89 --fixture",
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

    const endpoint =
      opts.endpoint || process.env.ANTARES_ENDPOINT || undefined;

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
        advisory,
        fixture: opts.fixture,
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
            "Keyless (no weights): prefer `zeroday operate --fixture` for coding-agent handoff.",
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
    "Fixture-driven CISO rollup (locate + optional local telemetry). Human review required. Not a live SOC.",
  )
  .option(
    "--scenario <name>",
    `Bundled fixtures/classify/<name> (${listClassifyScenarios().join("|") || "see fixtures/classify"})`,
  )
  .option("--from <report.json>", "Locate LocalizationResult report.json")
  .option(
    "--telemetry <file.json>",
    "Local zeroday-telemetry-v1 fixture (no live Cisco/Splunk feeds)",
  )
  .option("--output <dir>", "Output directory for ciso.json + ciso.md")
  .option("--json", "Print CISO object JSON to stdout", false)
  .action((opts: {
    scenario?: string;
    from?: string;
    telemetry?: string;
    output?: string;
    json: boolean;
  }) => {
    try {
      const artifacts = runClassify({
        scenario: opts.scenario,
        fromLocate: opts.from,
        telemetry: opts.telemetry,
        outputDir: opts.output,
      });
      if (opts.json) {
        console.log(JSON.stringify(artifacts.ciso, null, 2));
      } else {
        console.log("");
        console.log("ZERODAY classify");
        console.log("───────────────");
        console.log(`Classification : ${artifacts.ciso.classification}`);
        console.log(`Confidence     : ${artifacts.ciso.confidence}`);
        console.log(`Needs human    : yes (always)`);
        console.log(`CISO JSON      : ${artifacts.jsonPath}`);
        console.log(`CISO report    : ${artifacts.markdownPath}`);
        console.log("");
        console.log(
          "Honesty: fixture-driven classifier · not production SOC · not live agent-misfire detection · not exploit proof · no auto-merge",
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
      console.log("  # alias:  npm run war-room");
      console.log("");
      console.log("Then open:");
      console.log("  http://localhost:3333/play");
      console.log("  http://localhost:3333/          (How orgs use + playground)");
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
