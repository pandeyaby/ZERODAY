#!/usr/bin/env node
/**
 * ZERODAY CLI — wraps cisco-antares-cli for daily-driver localization.
 *
 *   zeroday locate --cwe CWE-89 --fixture
 *   zeroday locate --cve CVE-… --repo /path --endpoint http://localhost:8000/v1
 *   zeroday export --format asff --from zeroday-reports/.../report.json
 *   zeroday draft-fix --i-asked-for-a-fix --from …/report.json
 */

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import {
  locate,
  defaultFixtureRepo,
  detectAntaresCli,
  runAntaresPlan,
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
import {
  runClassify,
  listClassifyScenarios,
  runMixedPack,
} from "../src/classify/index.ts";

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
    "ZERODAY — local-first Antares vulnerability localization daily driver",
  )
  .version("0.4.0");

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
  .option("--fixture", "Force recorded/fixture mode (CI — no GPU / no weights)", false)
  .option("--live", "Force live official Antares CLI path", false)
  .option("--offline", "Skip NVD/GHSA network resolve", false)
  .option("--output <dir>", "Report output directory")
  .option(
    "--endpoint <url>",
    "Local vLLM / OpenAI-compatible endpoint (implies live unless --fixture). Completions only.",
  )
  .option("--model <id>", "Served model id (live)")
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
        model: opts.model || process.env.ANTARES_MODEL,
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
        console.log("");
        if (r.rankedFiles.length) {
          console.log("Ranked files:");
          for (const f of r.rankedFiles) {
            console.log(
              `  ${f.rank}. ${f.filePath}  [${f.cweIds.join(",")}]  ${f.title}`,
            );
          }
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
        console.log("");
        console.log(
          "Posture: localization only · detector-lane candidate · not exploit proof · no PoC · no auto-merge",
        );
        if (r.mode === "fixture") {
          const live = detectAntaresCli();
          console.log("");
          console.log(
            live.binary
              ? `Tip: Antares CLI at ${live.binary} — rerun with --endpoint http://127.0.0.1:8000/v1`
              : `Tip: ${live.sourceHint}`,
          );
        }
      }

      if (opts.failOnFindings && artifacts.result.rankedFiles.length > 0) {
        process.exitCode = 1;
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
    // Commander maps --i-asked-for-a-fix to iAskedForAFix
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
  .description("Check War Room API health")
  .action(async () => {
    await api("/api/health");
  });

program
  .command("missions")
  .description("List missions")
  .action(async () => {
    await api("/api/missions");
  });

program
  .command("launch")
  .argument("<brief>", "Natural language mission brief")
  .description("Create a mission from a brief")
  .action(async (brief: string) => {
    await api("/api/missions", { method: "POST", body: JSON.stringify({ brief }) });
  });

program
  .command("authorize")
  .argument("<missionId>")
  .option("--by <name>", "Authorizing person", "CLI Operator")
  .action(async (missionId: string, opts: { by: string }) => {
    await api("/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "authorize", missionId, authorizedBy: opts.by }),
    });
  });

program
  .command("start")
  .argument("<missionId>")
  .action(async (missionId: string) => {
    await api("/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "start", missionId }),
    });
  });

program
  .command("status")
  .argument("<missionId>")
  .action(async (missionId: string) => {
    await api(`/api/missions/${missionId}`);
  });

program
  .command("findings")
  .argument("[missionId]")
  .action(async (missionId?: string) => {
    const q = missionId ? `?missionId=${missionId}` : "";
    await api(`/api/findings${q}`);
  });

program
  .command("stego")
  .argument("<action>")
  .option("--id <transformId>", "Transform id", "base64")
  .option("--text <text>", "Input text", "")
  .action(async (action: string, opts: { id: string; text: string }) => {
    await api("/api/stego", {
      method: "POST",
      body: JSON.stringify({
        action,
        transformId: opts.id,
        text: opts.text,
        prompt: opts.text,
      }),
    });
  });

program
  .command("plinius")
  .argument("[action]", "status|research|t3mp3st|st3gg", "status")
  .description("Plinius bridge status / research gates / adapters")
  .action(async (action: string) => {
    await api(`/api/plinius?action=${encodeURIComponent(action || "status")}`);
  });

program.parseAsync(process.argv);
