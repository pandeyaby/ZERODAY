/**
 * ZERODAY classify — fixture-driven CISO rollup over locate + local telemetry.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LocalizationResult } from "../locate/types";
import { classify, isValidCisoObject } from "./classifier";
import { toCisoMarkdown } from "./ciso-report";
import {
  isTelemetryFixture,
  type TelemetryFixture,
  TELEMETRY_SCHEMA,
} from "./telemetry";
import type { CisoObject } from "./types";
import {
  assertNoExploitInvariant,
  collectResultTexts,
} from "../locate/invariant";

const here = path.dirname(fileURLToPath(import.meta.url));

export function classifyFixturesRoot(): string {
  return path.resolve(here, "../../fixtures/classify");
}

export interface ClassifyRunOptions {
  /** Path to locate report.json (LocalizationResult) */
  fromLocate?: string;
  /** Path to telemetry fixture JSON */
  telemetry?: string;
  /** Bundled scenario name under fixtures/classify/<name>/ */
  scenario?: string;
  outputDir?: string;
}

export interface ClassifyArtifacts {
  ciso: CisoObject;
  outputDir: string;
  jsonPath: string;
  markdownPath: string;
}

function loadLocate(p: string): LocalizationResult {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) throw new Error(`Locate report not found: ${abs}`);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as LocalizationResult;
}

function loadTelemetry(p: string): TelemetryFixture {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) throw new Error(`Telemetry fixture not found: ${abs}`);
  const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!isTelemetryFixture(doc)) {
    throw new Error(
      `Telemetry must be schema ${TELEMETRY_SCHEMA} with source=fixture and events[]`,
    );
  }
  return doc;
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

export function runClassify(options: ClassifyRunOptions): ClassifyArtifacts {
  let locatePath = options.fromLocate
    ? path.resolve(options.fromLocate)
    : undefined;
  let telemetryPath = options.telemetry
    ? path.resolve(options.telemetry)
    : undefined;

  if (options.scenario) {
    const s = resolveScenario(options.scenario);
    locatePath = locatePath ?? s.locatePath;
    telemetryPath = telemetryPath ?? s.telemetryPath;
  }

  if (!locatePath && !telemetryPath) {
    throw new Error(
      "classify requires --scenario <name> and/or --from <report.json> and/or --telemetry <file.json>",
    );
  }

  const locate = locatePath ? loadLocate(locatePath) : null;
  const telemetry = telemetryPath ? loadTelemetry(telemetryPath) : null;

  if (locate) {
    assertNoExploitInvariant(collectResultTexts(locate));
  }

  const { ciso } = classify({
    locate,
    telemetry,
    locateReportPath: locatePath,
    telemetryPath,
  });

  const md = toCisoMarkdown(ciso);
  assertNoExploitInvariant([md, JSON.stringify(ciso), ciso.next_human_action, ...ciso.rationale]);

  const outputDir = path.resolve(
    options.outputDir ??
      path.join(
        process.cwd(),
        "zeroday-reports",
        `classify-${options.scenario ?? "adhoc"}-${Date.now()}`,
      ),
  );
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "ciso.json");
  const markdownPath = path.join(outputDir, "ciso.md");
  fs.writeFileSync(jsonPath, JSON.stringify(ciso, null, 2));
  fs.writeFileSync(markdownPath, md);

  if (!isValidCisoObject(ciso)) {
    throw new Error("Internal error: invalid CISO object shape");
  }

  return { ciso, outputDir, jsonPath, markdownPath };
}

export {
  classify,
  isValidCisoObject,
  toCisoMarkdown,
  isTelemetryFixture,
  TELEMETRY_SCHEMA,
};
export type { CisoObject, ClassificationLabel } from "./types";
export type { TelemetryFixture } from "./telemetry";
