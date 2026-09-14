/**
 * Desk slice E — crash classify + evidence pack.
 * Reuses fixture-driven classifier; packages classify.md + classify.json.
 * Human review required · no auto-remediate · classification ≠ exploitability.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactInventoryText } from "../factory/inventory-evidence";
import { assertNoExploitInvariant } from "../locate/invariant";
import { classify, isValidCisoObject } from "./classifier";
import { toCisoMarkdown } from "./ciso-report";
import { toClassifyMarkdown, toClassifyReadme } from "./summary";
import {
  isTelemetryFixture,
  type TelemetryFixture,
  TELEMETRY_SCHEMA,
} from "./telemetry";
import type {
  ClassifyEvidencePack,
  ClassifyEvidenceWriteResult,
  CisoObject,
} from "./types";
import type { LocalizationResult } from "../locate/types";

const EVIDENCE_SRC = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_FROM_SRC = path.resolve(EVIDENCE_SRC, "../..");

function classifyFixturesRoot(): string {
  return path.resolve(REPO_ROOT_FROM_SRC, "fixtures/classify");
}

function resolveScenario(name: string): {
  locatePath?: string;
  telemetryPath?: string;
  dir: string;
} {
  const dir = path.join(classifyFixturesRoot(), name);
  if (!existsDir(dir)) {
    throw new Error(
      `Unknown classify scenario '${name}'. Expected directory under fixtures/classify/.`,
    );
  }
  const locatePath = path.join(dir, "report.json");
  const telemetryPath = path.join(dir, "telemetry.json");
  return {
    dir,
    locatePath: existsFile(locatePath) ? locatePath : undefined,
    telemetryPath: existsFile(telemetryPath) ? telemetryPath : undefined,
  };
}

function existsFile(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function existsDir(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function loadLocate(p: string): LocalizationResult {
  const abs = path.resolve(p);
  if (!existsFile(abs)) throw new Error(`Locate report not found: ${abs}`);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as LocalizationResult;
}

function loadTelemetry(p: string): TelemetryFixture {
  const abs = path.resolve(p);
  if (!existsFile(abs)) throw new Error(`Telemetry fixture not found: ${abs}`);
  const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!isTelemetryFixture(doc)) {
    throw new Error(
      `Telemetry must be schema ${TELEMETRY_SCHEMA} with source=fixture and events[]`,
    );
  }
  return doc;
}

export interface ResolvedClassifyFrom {
  fromPath: string;
  kind: "file" | "directory" | "scenario";
  locatePath?: string;
  telemetryPath?: string;
  scenario?: string;
}

/**
 * Resolve --from path: report.json file, fixture/reports directory, or scenario name.
 */
export function resolveClassifyFrom(from: string): ResolvedClassifyFrom {
  const abs = path.resolve(from);

  if (existsFile(abs)) {
    return { fromPath: abs, kind: "file", locatePath: abs };
  }

  if (existsDir(abs)) {
    const locatePath = path.join(abs, "report.json");
    const telemetryPath = path.join(abs, "telemetry.json");
    const hasLocate = existsFile(locatePath);
    const hasTelemetry = existsFile(telemetryPath);
    if (!hasLocate && !hasTelemetry) {
      throw new Error(
        `Classify --from directory must contain report.json and/or telemetry.json: ${abs}`,
      );
    }
    const base = path.basename(abs);
    const scenarioDir = path.join(classifyFixturesRoot(), base);
    const scenario =
      existsDir(scenarioDir) && path.resolve(scenarioDir) === abs
        ? base
        : undefined;
    return {
      fromPath: abs,
      kind: "directory",
      locatePath: hasLocate ? locatePath : undefined,
      telemetryPath: hasTelemetry ? telemetryPath : undefined,
      scenario,
    };
  }

  // Bare scenario name under fixtures/classify/<name>
  try {
    const s = resolveScenario(from);
    return {
      fromPath: s.dir,
      kind: "scenario",
      locatePath: s.locatePath,
      telemetryPath: s.telemetryPath,
      scenario: from,
    };
  } catch {
    throw new Error(
      `Classify --from not found as file, directory, or fixtures/classify scenario: ${from}`,
    );
  }
}

/** Default offline fixture dir (Desk E stranger / CI path). */
export function defaultClassifyFixtureDir(repoRoot?: string): string {
  return path.join(
    repoRoot ?? REPO_ROOT_FROM_SRC,
    "fixtures",
    "classify",
    "software_defect",
  );
}

/** Checked-in Desk E sample reports dir. */
export function defaultClassifyReportsDir(repoRoot?: string): string {
  return path.join(
    repoRoot ?? REPO_ROOT_FROM_SRC,
    "docs",
    "reports",
    "desk-e-classify",
  );
}

function relativeLabel(absPath: string): string {
  const root = REPO_ROOT_FROM_SRC;
  const rel = path.relative(root, absPath);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join("/");
  }
  return path.basename(absPath);
}

function redactSnippet(text: string, roots: string[]): string {
  const viaInventory = redactInventoryText(text, roots);
  // Extra secret-shaped tokens in free-text evidence summaries
  return viaInventory
    .replace(
      /(api[_-]?key|token|password|secret|authorization)\s*[:=]\s*['"]?[^\s'"]+/gi,
      "$1=[REDACTED]",
    )
    .replace(
      /\b(sk|rk|ghp|gho|ghu|ghs|ghr|hf)_[A-Za-z0-9_]{6,}\b/g,
      "[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
}

function redactCiso(ciso: CisoObject, roots: string[]): CisoObject {
  const blob = redactSnippet(JSON.stringify(ciso), roots);
  return JSON.parse(blob) as CisoObject;
}

export interface BuildClassifyEvidenceOptions {
  from?: string;
  scenario?: string;
  fromLocate?: string;
  telemetry?: string;
  /** Display label override for source.from */
  fromLabel?: string;
}

/**
 * Build Desk E evidence pack from existing classify APIs (no reinvented rules).
 */
export function buildClassifyEvidencePack(
  options: BuildClassifyEvidenceOptions = {},
): { pack: ClassifyEvidencePack; ciso: CisoObject; redactRoots: string[] } {
  let locatePath = options.fromLocate
    ? path.resolve(options.fromLocate)
    : undefined;
  let telemetryPath = options.telemetry
    ? path.resolve(options.telemetry)
    : undefined;
  let scenario = options.scenario;
  let fromDir: string | null = null;

  if (options.from) {
    const resolved = resolveClassifyFrom(options.from);
    fromDir =
      resolved.kind === "file"
        ? path.dirname(resolved.fromPath)
        : resolved.fromPath;
    locatePath = locatePath ?? resolved.locatePath;
    telemetryPath = telemetryPath ?? resolved.telemetryPath;
    scenario = scenario ?? resolved.scenario;
  }

  if (scenario && !locatePath && !telemetryPath) {
    const s = resolveScenario(scenario);
    fromDir = fromDir ?? s.dir;
    locatePath = s.locatePath;
    telemetryPath = s.telemetryPath;
  }

  if (!locatePath && !telemetryPath) {
    throw new Error(
      "classify requires --scenario <name> and/or --from <report.json|dir> and/or --telemetry <file.json>",
    );
  }

  const locate = locatePath ? loadLocate(locatePath) : null;
  const telemetry = telemetryPath ? loadTelemetry(telemetryPath) : null;
  const redactRoots = [
    fromDir,
    locatePath ? path.dirname(locatePath) : null,
    telemetryPath ? path.dirname(telemetryPath) : null,
    REPO_ROOT_FROM_SRC,
  ].filter((x): x is string => Boolean(x));

  const { ciso: raw } = classify({
    locate,
    telemetry,
    locateReportPath: locatePath,
    telemetryPath,
  });

  if (!isValidCisoObject(raw)) {
    throw new Error("Internal error: invalid CISO object shape");
  }

  const displayFrom =
    options.fromLabel?.trim() ||
    (fromDir
      ? relativeLabel(fromDir)
      : locatePath
        ? relativeLabel(locatePath)
        : telemetryPath
          ? relativeLabel(telemetryPath)
          : null);

  const packRaw: ClassifyEvidencePack = {
    schemaVersion: "zeroday-classify-evidence/v1",
    desk: "E",
    generatedAt: raw.generatedAt,
    classification: raw.classification,
    finding_class: raw.finding_class,
    confidence: raw.confidence,
    needs_human: true,
    human_review_required: true,
    east_west_suspected: raw.east_west_suspected,
    classification_not_exploitability: true,
    source: {
      from: displayFrom,
      scenario: scenario ?? null,
      locateReport: locatePath ? relativeLabel(locatePath) : null,
      telemetryFixture: telemetryPath ? relativeLabel(telemetryPath) : null,
      advisoryId: raw.inputs.advisoryId ?? null,
      cweId: raw.inputs.cweId ?? null,
    },
    // Embed a redacted CISO for the on-disk evidence pack
    ciso: redactCiso(raw, redactRoots),
    evidence: raw.evidence,
    rationale: raw.rationale,
    next_human_action: raw.next_human_action,
    signals: raw.signals,
    posture: {
      deskE: true,
      crashClassify: true,
      classificationNotExploitability: true,
      needsHuman: true,
      humanReviewRequired: true,
      noAutoRemediate: true,
      noAutoMerge: true,
      noPoC: true,
      secretsRedacted: true,
      fixtureDrivenClassifier: true,
      localizationOnly: true,
      notLiveSoc: true,
      notExploitProof: true,
    },
  };

  const pack = JSON.parse(
    redactSnippet(JSON.stringify(packRaw), redactRoots),
  ) as ClassifyEvidencePack;

  // In-memory ciso keeps absolute paths for local follow-up (playground / factory).
  return { pack, ciso: raw, redactRoots };
}

/**
 * Write Desk E classify evidence directory (classify.md + classify.json + ciso.*).
 */
export function writeClassifyEvidencePack(
  options: BuildClassifyEvidenceOptions & { outputDir: string },
): ClassifyEvidenceWriteResult {
  const absOut = path.resolve(options.outputDir);
  fs.mkdirSync(absOut, { recursive: true });

  const { pack, ciso, redactRoots } = buildClassifyEvidencePack(options);

  const classifyMd = toClassifyMarkdown(pack);
  const cisoMd = toCisoMarkdown(ciso);
  const readme = toClassifyReadme();
  const classifyJson = JSON.stringify(pack, null, 2);
  const cisoJson = JSON.stringify(ciso, null, 2);

  assertNoExploitInvariant([
    classifyMd,
    cisoMd,
    readme,
    classifyJson,
    cisoJson,
    pack.next_human_action,
    ...pack.rationale,
  ]);

  const classifyJsonPath = path.join(absOut, "classify.json");
  const classifyMdPath = path.join(absOut, "classify.md");
  const cisoJsonPath = path.join(absOut, "ciso.json");
  const cisoMdPath = path.join(absOut, "ciso.md");
  const readmePath = path.join(absOut, "README.md");

  fs.writeFileSync(
    classifyJsonPath,
    redactSnippet(classifyJson, redactRoots),
  );
  fs.writeFileSync(classifyMdPath, redactSnippet(classifyMd, redactRoots));
  fs.writeFileSync(cisoJsonPath, redactSnippet(cisoJson, redactRoots));
  fs.writeFileSync(cisoMdPath, redactSnippet(cisoMd, redactRoots));
  fs.writeFileSync(readmePath, readme);

  fs.writeFileSync(
    path.join(absOut, "SOURCE.md"),
    [
      "# Classify source provenance (Desk E)",
      "",
      `- From: \`${pack.source.from ?? "—"}\``,
      `- Scenario: \`${pack.source.scenario ?? "—"}\``,
      `- Locate report: \`${pack.source.locateReport ?? "—"}\``,
      `- Telemetry fixture: \`${pack.source.telemetryFixture ?? "—"}\``,
      `- Classification: \`${pack.classification}\``,
      "",
      "**Classification ≠ exploitability.** Human review required. No auto-remediate.",
      "Reuses fixture-driven classify APIs — no live SOC / no PoC.",
      "",
    ].join("\n"),
  );

  return {
    pack,
    ciso,
    outputDir: absOut,
    classifyJsonPath,
    classifyMdPath,
    cisoJsonPath,
    cisoMdPath,
    readmePath,
  };
}
