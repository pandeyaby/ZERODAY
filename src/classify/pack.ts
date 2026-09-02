/**
 * Mixed fixture pack — all four finding classes + locate SARIF/Splunk + CISO rollups.
 * No live network. No gated weights. No packet crafts / movement simulation.
 */

import fs from "node:fs";
import path from "node:path";
import { locate } from "../locate/index";
import { defaultFixtureRepo } from "../locate/fixture";
import { assertNoExploitInvariant } from "../locate/invariant";
import type { ClassificationLabel, CisoObject } from "./types";
import { runClassify } from "./index";
import { toCisoMarkdown } from "./ciso-report";

/** The four finding classes a mixed pack must demonstrate (needs_human is ambiguity only). */
export const FOUR_FINDING_CLASSES: ClassificationLabel[] = [
  "software_defect",
  "possible_breach",
  "infra_failure",
  "agent_misfire",
];

export const MIXED_SCENARIOS = [
  { scenario: "software_defect", expect: "software_defect" as const },
  { scenario: "possible_breach", expect: "possible_breach" as const },
  { scenario: "infra_failure", expect: "infra_failure" as const },
  { scenario: "agent_misfire", expect: "agent_misfire" as const },
  { scenario: "needs_human", expect: "needs_human" as const },
] as const;

export interface PackCase {
  scenario: string;
  expect: ClassificationLabel;
  classification: ClassificationLabel;
  cisoPath: string;
  markdownPath: string;
  east_west_suspected: boolean;
}

export interface MixedPackResult {
  outputDir: string;
  locateDir: string;
  sarifPath: string;
  splunkPath: string;
  asffPath: string;
  cases: PackCase[];
  packJsonPath: string;
  packMarkdownPath: string;
  packSplunkPath: string;
}

function packMarkdown(result: MixedPackResult): string {
  const lines: string[] = [];
  lines.push(`# ZERODAY mixed fixture pack — CISO one-pager`);
  lines.push(``);
  lines.push(
    `> Fixture-driven only. **No live network. No gated weights.** Human review required before any label is truth.`,
  );
  lines.push(
    `> Telemetry is **INPUT** (NetFlow/syslog-shaped fixtures). We do not simulate, generate, or demonstrate movement.`,
  );
  lines.push(``);
  lines.push(`## Locate (software_defect evidence → SARIF + Splunk CIM)`);
  lines.push(``);
  lines.push(`| Artifact | Path |`);
  lines.push(`|----------|------|`);
  lines.push(`| SARIF | \`${result.sarifPath}\` |`);
  lines.push(`| Splunk CIM | \`${result.splunkPath}\` |`);
  lines.push(`| ASFF | \`${result.asffPath}\` |`);
  lines.push(``);
  lines.push(`## Four finding classes (+ ambiguous needs_human)`);
  lines.push(``);
  lines.push(`| Scenario | Classification | East-west suspected | CISO JSON |`);
  lines.push(`|----------|----------------|---------------------|-----------|`);
  for (const c of result.cases) {
    lines.push(
      `| \`${c.scenario}\` | \`${c.classification}\` | ${c.east_west_suspected ? "yes" : "no"} | \`${c.cisoPath}\` |`,
    );
  }
  lines.push(``);
  lines.push(`## Next human action`);
  lines.push(``);
  lines.push(
    `1. Open each \`ciso.md\` and confirm or dismiss the label.`,
  );
  lines.push(
    `2. For \`possible_breach\` / east-west: review telemetry **ids** in the fixture — do not treat as a live adversary.`,
  );
  lines.push(
    `3. Ingest SARIF into GitHub Code Scanning; point your Splunk TA at \`splunk-cim-vulnerabilities.json\` and optionally \`pack-splunk-classifications.json\`.`,
  );
  lines.push(`4. Never auto-merge. Localization is not exploitability.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(
    `_Agentic-era question is the problem; this pack is a fixture answer — not a production SOC watching the live network._`,
  );
  lines.push(``);
  return lines.join("\n");
}

/**
 * Splunk-shaped classification events for customer TA ingest (local file only).
 * sourcetype suggestion: zeroday:antares:classify
 */
export function toPackSplunkEvents(cases: PackCase[]): {
  sourcetype_recommendation: string;
  note: string;
  events: Array<Record<string, unknown>>;
} {
  return {
    sourcetype_recommendation: "zeroday:antares:classify",
    note:
      "CIM-friendly classification events for a customer TA. Not ES Notable JSON. ZERODAY does not push to Splunk.",
    events: cases.map((c) => ({
      sourcetype: "zeroday:antares:classify",
      vendor_product: "ZERODAY Antares",
      severity: "informational",
      category: c.classification,
      signature: `zeroday_classify_${c.classification}`,
      signature_id: c.scenario,
      xref: c.classification,
      finding_class: c.classification,
      east_west_suspected: c.east_west_suspected,
      needs_human: true,
      dest: "zeroday-local",
      dvc: "zeroday-classify",
      ciso_json: c.cisoPath,
    })),
  };
}

export async function runMixedPack(outputDir: string): Promise<MixedPackResult> {
  const abs = path.resolve(outputDir);
  fs.mkdirSync(abs, { recursive: true });
  const locateDir = path.join(abs, "locate");

  const locateArtifacts = await locate({
    repo: defaultFixtureRepo(),
    advisory: "CWE-89",
    fixture: true,
    outputDir: locateDir,
  });

  const cases: PackCase[] = [];
  for (const spec of MIXED_SCENARIOS) {
    const caseDir = path.join(abs, "classify", spec.scenario);
    const artifacts = runClassify({
      scenario: spec.scenario,
      outputDir: caseDir,
    });
    if (artifacts.ciso.classification !== spec.expect) {
      throw new Error(
        `Mixed pack scenario '${spec.scenario}' expected ${spec.expect}, got ${artifacts.ciso.classification}`,
      );
    }
    cases.push({
      scenario: spec.scenario,
      expect: spec.expect,
      classification: artifacts.ciso.classification,
      cisoPath: artifacts.jsonPath,
      markdownPath: artifacts.markdownPath,
      east_west_suspected: artifacts.ciso.east_west_suspected,
    });
  }

  const four = new Set(
    cases
      .filter((c) => c.classification !== "needs_human")
      .map((c) => c.classification),
  );
  for (const label of FOUR_FINDING_CLASSES) {
    if (!four.has(label)) {
      throw new Error(`Mixed pack missing finding class: ${label}`);
    }
  }

  const result: MixedPackResult = {
    outputDir: abs,
    locateDir,
    sarifPath: locateArtifacts.sarifPath,
    splunkPath: path.join(locateDir, "splunk-cim-vulnerabilities.json"),
    asffPath: path.join(locateDir, "asff-findings.json"),
    cases,
    packJsonPath: path.join(abs, "pack-summary.json"),
    packMarkdownPath: path.join(abs, "pack-summary.md"),
    packSplunkPath: path.join(abs, "pack-splunk-classifications.json"),
  };

  if (!fs.existsSync(result.splunkPath)) {
    throw new Error(`Expected Splunk CIM export at ${result.splunkPath}`);
  }

  const summary = {
    schema: "zeroday-mixed-pack-v1",
    generatedAt: new Date().toISOString(),
    posture: {
      fixtureDriven: true,
      noLiveNetwork: true,
      noGatedWeights: true,
      humanReviewRequired: true,
      notProductionSoc: true,
      telemetryInputOnly: true,
    },
    locate: {
      sarif: result.sarifPath,
      splunk_cim: result.splunkPath,
      asff: result.asffPath,
      report_json: locateArtifacts.jsonPath,
    },
    classes_demonstrated: FOUR_FINDING_CLASSES,
    cases: result.cases,
  };

  const md = packMarkdown(result);
  const splunk = toPackSplunkEvents(result.cases);
  assertNoExploitInvariant([md, JSON.stringify(summary), JSON.stringify(splunk)]);

  fs.writeFileSync(result.packJsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(result.packMarkdownPath, md);
  fs.writeFileSync(result.packSplunkPath, JSON.stringify(splunk, null, 2));

  // Convenience: copy aggregate CISO markdown at pack root
  const allCisoMd = result.cases
    .map((c) => fs.readFileSync(c.markdownPath, "utf8"))
    .join("\n\n---\n\n");
  fs.writeFileSync(path.join(abs, "ciso-all.md"), `${md}\n\n---\n\n${allCisoMd}`);

  return result;
}

/** Documented hook: how customer TAs consume telemetry + classification. */
export const TELEMETRY_EXPORTER_HOOK = {
  telemetry_schema: "zeroday-telemetry-v1",
  locate_exporters: [
    "report.sarif",
    "splunk-cim-vulnerabilities.json",
    "asff-findings.json",
  ],
  classification_exporter: "pack-splunk-classifications.json",
  ciso_object: ["ciso.json", "ciso.md", "pack-summary.md"],
  no_live_pull: true,
  no_push: true,
  ingest_note:
    "Customer ships NetFlow/syslog-shaped JSON matching zeroday-telemetry-v1 into classify --telemetry. Existing locate exporters unchanged. ZERODAY never pulls live Cisco/Splunk feeds and never pushes.",
} as const;
