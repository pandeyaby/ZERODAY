/**
 * ZERODAY classify — fixture-driven CISO rollup + Desk E evidence pack.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify, isValidCisoObject } from "./classifier";
import { toCisoMarkdown } from "./ciso-report";
import {
  buildClassifyEvidencePack,
  defaultClassifyFixtureDir,
  defaultClassifyReportsDir,
  resolveClassifyFrom,
  writeClassifyEvidencePack,
} from "./evidence";
import { toClassifyMarkdown, toClassifyReadme } from "./summary";
import {
  isTelemetryFixture,
  TELEMETRY_SCHEMA,
} from "./telemetry";
import type { CisoObject, ClassifyEvidencePack } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));

export function classifyFixturesRoot(): string {
  return path.resolve(here, "../../fixtures/classify");
}

export interface ClassifyRunOptions {
  /** Path to locate report.json (LocalizationResult) — legacy alias */
  fromLocate?: string;
  /** Desk E --from: report.json file OR fixture/reports directory */
  from?: string;
  /** Path to telemetry fixture JSON */
  telemetry?: string;
  /** Bundled scenario name under fixtures/classify/<name>/ */
  scenario?: string;
  outputDir?: string;
}

export interface ClassifyArtifacts {
  ciso: CisoObject;
  pack: ClassifyEvidencePack;
  outputDir: string;
  /** @deprecated alias of cisoJsonPath — factory/tests may still use this */
  jsonPath: string;
  /** @deprecated alias of cisoMdPath */
  markdownPath: string;
  classifyJsonPath: string;
  classifyMdPath: string;
  cisoJsonPath: string;
  cisoMdPath: string;
  readmePath: string;
}

export function resolveScenario(name: string): {
  locatePath?: string;
  telemetryPath?: string;
  dir: string;
} {
  const dir = path.join(classifyFixturesRoot(), name);
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Unknown classify scenario '${name}'. Expected directory under fixtures/classify/.`,
    );
  }
  const locatePath = path.join(dir, "report.json");
  const telemetryPath = path.join(dir, "telemetry.json");
  return {
    dir,
    locatePath: fs.existsSync(locatePath) ? locatePath : undefined,
    telemetryPath: fs.existsSync(telemetryPath) ? telemetryPath : undefined,
  };
}

export function listClassifyScenarios(): string[] {
  const root = classifyFixturesRoot();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/**
 * Run Desk E classify: emit classify.md + classify.json evidence pack
 * (and backward-compatible ciso.json / ciso.md).
 */
export function runClassify(options: ClassifyRunOptions): ClassifyArtifacts {
  const outputDir =
    options.outputDir ??
    path.join(
      process.cwd(),
      "zeroday-reports",
      `classify-${options.scenario ?? "adhoc"}-${Date.now()}`,
    );

  // Prefer explicit --from; fall back to legacy fromLocate (file path).
  const from = options.from ?? options.fromLocate;

  const result = writeClassifyEvidencePack({
    from,
    scenario: options.scenario,
    telemetry: options.telemetry,
    outputDir,
  });

  return {
    ciso: result.ciso,
    pack: result.pack,
    outputDir: result.outputDir,
    jsonPath: result.cisoJsonPath,
    markdownPath: result.cisoMdPath,
    classifyJsonPath: result.classifyJsonPath,
    classifyMdPath: result.classifyMdPath,
    cisoJsonPath: result.cisoJsonPath,
    cisoMdPath: result.cisoMdPath,
    readmePath: result.readmePath,
  };
}

export {
  classify,
  isValidCisoObject,
  toCisoMarkdown,
  isTelemetryFixture,
  TELEMETRY_SCHEMA,
  buildClassifyEvidencePack,
  writeClassifyEvidencePack,
  resolveClassifyFrom,
  defaultClassifyFixtureDir,
  defaultClassifyReportsDir,
  toClassifyMarkdown,
  toClassifyReadme,
};
export {
  runMixedPack,
  FOUR_FINDING_CLASSES,
  MIXED_SCENARIOS,
  TELEMETRY_EXPORTER_HOOK,
  toPackSplunkEvents,
} from "./pack";
export type { MixedPackResult, PackCase } from "./pack";
export type {
  CisoObject,
  ClassificationLabel,
  ClassifyEvidencePack,
  ClassifyEvidenceWriteResult,
} from "./types";
export type { TelemetryFixture } from "./telemetry";
