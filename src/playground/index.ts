/**
 * Local fixture playground — locate / classify / demo with no live network
 * and no gated weight downloads. Used by /api/playground and War Room UI.
 */

import fs from "node:fs";
import path from "node:path";
import { locate, defaultFixtureRepo } from "../locate/index";
import { toSarif } from "../locate/sarif";
import { toSplunkCim } from "../locate/export/splunk";
import {
  runClassify,
  listClassifyScenarios,
  runMixedPack,
} from "../classify/index";
import type { CisoObject } from "../classify/types";
import type { LocalizationResult } from "../locate/types";
import type { SarifLog } from "../locate/sarif";
import type { SplunkCimEvent } from "../locate/export/splunk";

export const PLAYGROUND_ACTIONS = [
  "catalog",
  "locate",
  "classify",
  "demo",
] as const;

export type PlaygroundAction = (typeof PLAYGROUND_ACTIONS)[number];

export interface SarifSummary {
  version: string;
  toolName: string;
  resultCount: number;
  ruleCount: number;
  level: string;
  topResults: Array<{
    ruleId: string;
    level: string;
    message: string;
    uri?: string;
  }>;
  posture: string;
}

export interface PlaygroundLocateResult {
  kind: "locate";
  mode: "fixture";
  advisory: string;
  cweId: string;
  findingCount: number;
  rankedFiles: Array<{ rank: number; filePath: string; title: string; cweIds: string[] }>;
  outputDir: string;
  paths: {
    json: string;
    sarif: string;
    report: string;
    splunk: string;
  };
  sarifSummary: SarifSummary;
  splunkSnippet: SplunkCimEvent[];
  cisoMarkdown: string;
  honesty: string;
}

export interface PlaygroundClassifyResult {
  kind: "classify";
  mode: "fixture";
  scenario: string;
  classification: CisoObject["classification"];
  confidence: number;
  needs_human: true;
  east_west_suspected: boolean;
  outputDir: string;
  paths: { json: string; markdown: string };
  ciso: CisoObject;
  cisoMarkdown: string;
  sarifSummary: SarifSummary | null;
  splunkSnippet: SplunkCimEvent[];
  honesty: string;
}

export interface PlaygroundDemoResult {
  kind: "demo";
  mode: "fixture";
  outputDir: string;
  paths: {
    sarif: string;
    splunk: string;
    asff: string;
    packMarkdown: string;
    packJson: string;
    packSplunk: string;
  };
  cases: Array<{
    scenario: string;
    classification: string;
    east_west_suspected: boolean;
  }>;
  sarifSummary: SarifSummary;
  splunkSnippet: SplunkCimEvent[];
  cisoMarkdown: string;
  honesty: string;
}

export interface PlaygroundCatalog {
  kind: "catalog";
  mode: "fixture";
  actions: Array<{
    id: PlaygroundAction;
    label: string;
    description: string;
  }>;
  classifyScenarios: string[];
  locateDefault: { cwe: string; repo: string };
  honesty: string[];
}

const HONESTY =
  "Fixture-only · no live network · no weight download · localization ≠ exploitability · human review required · no auto-merge · no PoCs";

function summarizeSarif(sarif: SarifLog): SarifSummary {
  const run = sarif.runs[0];
  const results = run?.results || [];
  return {
    version: sarif.version,
    toolName: run?.tool.driver.name || "ZERODAY",
    resultCount: results.length,
    ruleCount: run?.tool.driver.rules?.length || 0,
    level: "note",
    topResults: results.slice(0, 5).map((r) => ({
      ruleId: r.ruleId,
      level: r.level,
      message: r.message.text,
      uri: r.locations?.[0]?.physicalLocation?.artifactLocation?.uri,
    })),
    posture:
      "SARIF note severity · detector-lane candidate · not exploit proof",
  };
}

function loadJsonIfExists<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function humanReportFromLocate(result: LocalizationResult): string {
  const lines: string[] = [];
  lines.push(`# ZERODAY locate — CISO skim`);
  lines.push(``);
  lines.push(`> Localization only. Not exploitability. Human review required.`);
  lines.push(``);
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Advisory | \`${result.advisory.id}\` → \`${result.advisory.cweId}\` |`);
  lines.push(`| Mode | \`${result.mode}\` |`);
  lines.push(`| Findings | ${result.summary.findingCount} |`);
  lines.push(``);
  if (result.rankedFiles.length) {
    lines.push(`## Ranked files`);
    lines.push(``);
    for (const f of result.rankedFiles) {
      lines.push(
        `${f.rank}. \`${f.filePath}\` — ${f.title} (${f.cweIds.join(", ")})`,
      );
    }
    lines.push(``);
  }
  lines.push(`## Next human action`);
  lines.push(``);
  lines.push(
    `1. Triage ranked files. 2. Ingest SARIF in Code Scanning. 3. Never auto-merge.`,
  );
  lines.push(``);
  return lines.join("\n");
}

export function playgroundCatalog(): PlaygroundCatalog {
  return {
    kind: "catalog",
    mode: "fixture",
    actions: [
      {
        id: "locate",
        label: "Locate CWE-89 (fixture)",
        description:
          "Runs zeroday locate --cwe CWE-89 --fixture on fixtures/locate/demo-app",
      },
      {
        id: "classify",
        label: "Classify scenario",
        description:
          "Runs fixture classify for one of possible_breach | infra_failure | software_defect | agent_misfire | needs_human",
      },
      {
        id: "demo",
        label: "Mixed demo pack",
        description:
          "Runs zeroday demo — all four classes + SARIF + Splunk CIM + CISO markdown",
      },
    ],
    classifyScenarios: listClassifyScenarios().filter((s) => s !== "mixed"),
    locateDefault: {
      cwe: "CWE-89",
      repo: defaultFixtureRepo(),
    },
    honesty: [
      "Fixtures only — no live telemetry, no simulated attacks, no exploits",
      "Four-class classifier is fixture-driven; ambiguous → needs_human",
      "Do not claim live agent-misfire SOC",
      "SOC / Splunk / Cisco buyers ingest local files with their credentials — we do not push",
      "Never auto-merge; draft-fix only with --i-asked-for-a-fix",
    ],
  };
}

export async function runPlaygroundLocate(options?: {
  outputDir?: string;
}): Promise<PlaygroundLocateResult> {
  const artifacts = await locate({
    repo: defaultFixtureRepo(),
    advisory: "CWE-89",
    fixture: true,
    offline: true,
    outputDir:
      options?.outputDir ||
      path.join("zeroday-reports", "playground-locate"),
  });

  const sarif = toSarif(artifacts.result);
  const splunk = toSplunkCim(artifacts.result);
  const reportText = fs.existsSync(artifacts.reportPath)
    ? fs.readFileSync(artifacts.reportPath, "utf8")
    : humanReportFromLocate(artifacts.result);

  const splunkPath =
    artifacts.exportPaths.find((p) => p.includes("splunk-cim")) ||
    path.join(artifacts.outputDir, "splunk-cim-vulnerabilities.json");

  return {
    kind: "locate",
    mode: "fixture",
    advisory: artifacts.result.advisory.id,
    cweId: artifacts.result.advisory.cweId,
    findingCount: artifacts.result.summary.findingCount,
    rankedFiles: artifacts.result.rankedFiles.map((f) => ({
      rank: f.rank,
      filePath: f.filePath,
      title: f.title,
      cweIds: f.cweIds,
    })),
    outputDir: artifacts.outputDir,
    paths: {
      json: artifacts.jsonPath,
      sarif: artifacts.sarifPath,
      report: artifacts.reportPath,
      splunk: splunkPath,
    },
    sarifSummary: summarizeSarif(sarif),
    splunkSnippet: splunk.events.slice(0, 2),
    cisoMarkdown: reportText,
    honesty: HONESTY,
  };
}

export async function runPlaygroundClassify(options: {
  scenario: string;
  outputDir?: string;
}): Promise<PlaygroundClassifyResult> {
  const allowed = playgroundCatalog().classifyScenarios;
  if (!allowed.includes(options.scenario)) {
    throw new Error(
      `Unknown classify scenario '${options.scenario}'. Use: ${allowed.join("|")}`,
    );
  }

  const artifacts = runClassify({
    scenario: options.scenario,
    outputDir:
      options.outputDir ||
      path.join("zeroday-reports", `playground-classify-${options.scenario}`),
  });

  // Prefer locate SARIF/splunk when the scenario includes a locate report
  let sarifSummary: SarifSummary | null = null;
  let splunkSnippet: SplunkCimEvent[] = [];
  const locateReport = artifacts.ciso.inputs.locateReport;
  if (locateReport && fs.existsSync(locateReport)) {
    const result = JSON.parse(
      fs.readFileSync(locateReport, "utf8"),
    ) as LocalizationResult;
    sarifSummary = summarizeSarif(toSarif(result));
    splunkSnippet = toSplunkCim(result).events.slice(0, 2);
  }

  return {
    kind: "classify",
    mode: "fixture",
    scenario: options.scenario,
    classification: artifacts.ciso.classification,
    confidence: artifacts.ciso.confidence,
    needs_human: true,
    east_west_suspected: artifacts.ciso.east_west_suspected,
    outputDir: artifacts.outputDir,
    paths: { json: artifacts.jsonPath, markdown: artifacts.markdownPath },
    ciso: artifacts.ciso,
    cisoMarkdown: fs.readFileSync(artifacts.markdownPath, "utf8"),
    sarifSummary,
    splunkSnippet,
    honesty: HONESTY,
  };
}

export async function runPlaygroundDemo(options?: {
  outputDir?: string;
}): Promise<PlaygroundDemoResult> {
  const pack = await runMixedPack(
    options?.outputDir || path.join("zeroday-reports", "playground-mixed-pack"),
  );

  const locateJson = path.join(pack.locateDir, "report.json");
  const result = loadJsonIfExists<LocalizationResult>(locateJson);
  if (!result) {
    throw new Error(`Mixed pack locate report missing at ${locateJson}`);
  }

  const sarif = toSarif(result);
  const splunk = toSplunkCim(result);
  const packMd = fs.readFileSync(pack.packMarkdownPath, "utf8");

  // Append first CISO markdown for on-screen skim
  const firstCisoMd =
    pack.cases[0] && fs.existsSync(pack.cases[0].markdownPath)
      ? fs.readFileSync(pack.cases[0].markdownPath, "utf8")
      : "";
  const cisoMarkdown = firstCisoMd
    ? `${packMd}\n\n---\n\n## Sample CISO object (\`${pack.cases[0].scenario}\`)\n\n${firstCisoMd}`
    : packMd;

  return {
    kind: "demo",
    mode: "fixture",
    outputDir: pack.outputDir,
    paths: {
      sarif: pack.sarifPath,
      splunk: pack.splunkPath,
      asff: pack.asffPath,
      packMarkdown: pack.packMarkdownPath,
      packJson: pack.packJsonPath,
      packSplunk: pack.packSplunkPath,
    },
    cases: pack.cases.map((c) => ({
      scenario: c.scenario,
      classification: c.classification,
      east_west_suspected: c.east_west_suspected,
    })),
    sarifSummary: summarizeSarif(sarif),
    splunkSnippet: splunk.events.slice(0, 2),
    cisoMarkdown,
    honesty: HONESTY,
  };
}
