#!/usr/bin/env node
/**
 * ZERODAY CLI — Antares localization daily driver + War Room headless parity.
 *
 * Primary (Increment 1):
 *   npx tsx cli/index.ts locate --cve CVE-2024-89001 --repo fixtures/locate/demo-app
 *   npx tsx cli/index.ts locate --cwe CWE-89 --fixture
 *   npx tsx cli/index.ts locate --ghsa GHSA-demo-0000-sql1 --repo /path --live
 *
 * War Room (existing):
 *   npx tsx cli/index.ts health|missions|launch|…
 */

import { Command } from "commander";
import path from "node:path";
import {
  locate,
  defaultFixtureRepo,
  detectAntaresCli,
  runAntaresPlan,
} from "../src/locate/index.ts";

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

const program = new Command();
program
  .name("zeroday")
  .description(
    "ZERODAY — local-first Antares vulnerability localization + security workstation",
  )
  .version("0.3.0");

program
  .command("plan")
  .description(
    "Preview CWE portfolio for a repo via official `antares plan` (local, no inference)",
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
    "Localize vulnerability candidates with Antares (fixture or live). Defensive only.",
  )
  .option("--cwe <id>", "CWE id (e.g. CWE-89)")
  .option("--cve <id>", "CVE id (mapped to CWE for Antares)")
  .option("--ghsa <id>", "GHSA id (mapped to CWE for Antares)")
  .option(
    "--repo <path>",
    "Local repository path (default: fixture demo-app)",
    "",
  )
  .option("--fixture", "Force recorded/fixture mode (no GPU / no HF weights)", false)
  .option("--live", "Force live official Antares CLI path", false)
  .option("--output <dir>", "Report output directory")
  .option(
    "--endpoint <url>",
    "OpenAI-compatible endpoint base or full /v1/completions URL (live)",
  )
  .option("--model <id>", "Served model id (live)")
  .option("--fail-on-findings", "Exit 1 when ranked files are non-empty", false)
  .option("--json", "Print LocalizationResult JSON to stdout", false)
  .action(async (opts: {
    cwe?: string;
    cve?: string;
    ghsa?: string;
    repo: string;
    fixture: boolean;
    live: boolean;
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

    // Default to fixture when not explicitly live — shippable UX without weights
    const fixture = opts.live ? false : opts.fixture || !opts.live;

    try {
      const artifacts = await locate({
        repo,
        advisory,
        fixture: fixture && !opts.live,
        live: opts.live,
        outputDir: opts.output,
        endpoint: opts.endpoint || process.env.ANTARES_ENDPOINT,
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
            console.log(`  ${f.rank}. ${f.filePath}  [${f.cweIds.join(",")}]  ${f.title}`);
          }
          console.log("");
        } else {
          console.log("No vulnerable files submitted.");
          console.log("");
        }
        console.log("Artifacts:");
        console.log(`  JSON    ${artifacts.jsonPath}`);
        console.log(`  SARIF   ${artifacts.sarifPath}`);
        console.log(`  Report  ${artifacts.reportPath}`);
        console.log(`  Comment ${artifacts.commentPath}`);
        console.log("");
        console.log(
          "Posture: localization only · not exploit proof · no PoC · no auto-merge",
        );
        if (r.mode === "fixture") {
          const live = detectAntaresCli();
          console.log("");
          console.log(
            live.binary
              ? `Tip: Antares CLI found at ${live.binary} — rerun with --live`
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
