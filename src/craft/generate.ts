/**
 * Desk slice D — build defensive skill/plugin scaffolds from Desk B→A→C→E reports.
 * Generate-only; refuses offensive patterns; never auto-installs or publishes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactInventoryText } from "../factory/inventory-evidence";
import { assertNoExploitInvariant } from "../locate/invariant";
import {
  distillCraftPatterns,
  loadCraftSources,
  relativeReportsLabel,
  toCraftSourceRefs,
} from "./patterns";
import {
  CraftRefuseError,
  refuseOffensiveCraft,
} from "./refuse";
import { toCraftMarkdown, toCraftReadme } from "./summary";
import {
  craftScaffoldSlug,
  renderPluginJson,
  renderPluginReadme,
  renderSkillMarkdown,
} from "./templates";
import type {
  CraftKindOption,
  CraftReport,
  CraftScaffoldFile,
  CraftWriteResult,
} from "./types";

const CRAFT_SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_FROM_SRC = path.resolve(CRAFT_SRC_DIR, "../..");

const DEFAULT_CRAFT_NAME = "zeroday-defensive-operator";

export interface BuildCraftOptions {
  name?: string;
  kind?: CraftKindOption;
  /** Free-text intent (also scanned for offensive refusal) */
  intent?: string;
  reportsDirLabel?: string;
}

function normalizeKind(kind?: CraftKindOption): CraftKindOption {
  if (kind === "skill" || kind === "plugin" || kind === "both") return kind;
  return "both";
}

function sanitizeDefensiveName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_CRAFT_NAME;
  // Refuse is handled separately; here only normalize display/slug seed.
  return trimmed.slice(0, 80);
}

/**
 * Build craft report (in-memory). Throws CraftRefuseError on offensive requests.
 */
export function buildCraftReport(
  reportsDir: string,
  opts?: BuildCraftOptions,
): CraftReport {
  const name = sanitizeDefensiveName(opts?.name ?? DEFAULT_CRAFT_NAME);
  const kind = normalizeKind(opts?.kind);
  const intent = opts?.intent?.trim() ?? "";

  const refuse = refuseOffensiveCraft([name, intent, kind]);
  if (refuse) {
    throw new CraftRefuseError(refuse);
  }

  const loaded = loadCraftSources(reportsDir);
  const patterns = distillCraftPatterns(loaded);
  const displayDir =
    opts?.reportsDirLabel?.trim() ||
    relativeReportsLabel(loaded.reportsDir);
  const generatedAt = new Date().toISOString();
  const slug = craftScaffoldSlug(name);

  const scaffolds: CraftScaffoldFile[] = [];
  if (kind === "skill" || kind === "both") {
    scaffolds.push({
      kind: "skill",
      name: slug,
      relativePath: `skills/${slug}/SKILL.md`,
      title: `${name} (SKILL.md)`,
    });
  }
  if (kind === "plugin" || kind === "both") {
    scaffolds.push({
      kind: "plugin",
      name: slug,
      relativePath: `plugins/${slug}/plugin.json`,
      title: `${name} (plugin stub)`,
    });
    scaffolds.push({
      kind: "plugin",
      name: slug,
      relativePath: `plugins/${slug}/README.md`,
      title: `${name} (plugin README)`,
    });
  }

  const report: CraftReport = {
    schemaVersion: "zeroday-craft-scaffold/v1",
    desk: "D",
    generatedAt,
    name: slug,
    kind,
    source: toCraftSourceRefs(loaded, displayDir),
    patterns,
    scaffolds,
    refused: false,
    posture: {
      generateOnly: true,
      noAutoInstall: true,
      noMarketplacePublish: true,
      noPoC: true,
      refusesOffensive: true,
      secretsRedacted: true,
      needsHuman: true,
      localizationOnly: true,
      habitsEncoded: true,
    },
  };

  const blob = redactInventoryText(JSON.stringify(report), [
    loaded.reportsDir,
  ]);
  return JSON.parse(blob) as CraftReport;
}

/**
 * Write craft output directory: craft.md/json + skill and/or plugin scaffolds.
 */
export function writeCraftReport(
  reportsDir: string,
  outputDir: string,
  opts?: BuildCraftOptions,
): CraftWriteResult {
  const absOut = path.resolve(outputDir);
  fs.mkdirSync(absOut, { recursive: true });

  const loaded = loadCraftSources(reportsDir);
  const report = buildCraftReport(reportsDir, opts);
  const templateInput = {
    name: report.name,
    patterns: report.patterns,
    generatedAt: report.generatedAt,
    sourceLabel: report.source.reportsDir,
  };

  const craftMd = toCraftMarkdown(report);
  const readme = toCraftReadme();
  const craftJson = JSON.stringify(report, null, 2);

  const skillBodies: string[] = [];
  const pluginBodies: string[] = [];
  if (report.kind === "skill" || report.kind === "both") {
    skillBodies.push(renderSkillMarkdown(templateInput));
  }
  if (report.kind === "plugin" || report.kind === "both") {
    pluginBodies.push(renderPluginJson(templateInput));
    pluginBodies.push(renderPluginReadme(templateInput));
  }

  assertNoExploitInvariant([
    craftMd,
    readme,
    craftJson,
    ...skillBodies,
    ...pluginBodies,
  ]);

  const craftJsonPath = path.join(absOut, "craft.json");
  const craftMdPath = path.join(absOut, "craft.md");
  const readmePath = path.join(absOut, "README.md");

  fs.writeFileSync(
    craftJsonPath,
    redactInventoryText(craftJson, [loaded.reportsDir]),
  );
  fs.writeFileSync(
    craftMdPath,
    redactInventoryText(craftMd, [loaded.reportsDir]),
  );
  fs.writeFileSync(readmePath, readme);

  const skillPaths: string[] = [];
  const pluginPaths: string[] = [];
  const slug = report.name;

  if (report.kind === "skill" || report.kind === "both") {
    const rel = `skills/${slug}/SKILL.md`;
    const dest = path.join(absOut, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const body = renderSkillMarkdown(templateInput);
    assertNoExploitInvariant([body]);
    fs.writeFileSync(
      dest,
      redactInventoryText(body, [loaded.reportsDir]),
    );
    skillPaths.push(dest);
  }

  if (report.kind === "plugin" || report.kind === "both") {
    const pluginDir = path.join(absOut, "plugins", slug);
    fs.mkdirSync(pluginDir, { recursive: true });
    const pluginJsonPath = path.join(pluginDir, "plugin.json");
    const pluginReadmePath = path.join(pluginDir, "README.md");
    const pj = renderPluginJson(templateInput);
    const pr = renderPluginReadme(templateInput);
    assertNoExploitInvariant([pj, pr]);
    fs.writeFileSync(
      pluginJsonPath,
      redactInventoryText(pj, [loaded.reportsDir]),
    );
    fs.writeFileSync(
      pluginReadmePath,
      redactInventoryText(pr, [loaded.reportsDir]),
    );
    pluginPaths.push(pluginJsonPath, pluginReadmePath);
  }

  fs.writeFileSync(
    path.join(absOut, "SOURCE.md"),
    [
      "# Craft source provenance",
      "",
      `- Reports dir: \`${report.source.reportsDir}\``,
      `- Inventory JSON: \`${report.source.inventoryJson ?? "—"}\``,
      `- Packet JSON: \`${report.source.packetJson ?? "—"}\``,
      `- Harden JSON: \`${report.source.hardenJson ?? "—"}\``,
      `- Classify JSON: \`${report.source.classifyJson ?? "—"}\``,
      `- Findings JSON: \`${report.source.findingsJson ?? "—"}\``,
      `- Case note: \`${report.source.caseNote ?? "—"}\``,
      `- SARIF: ${report.source.sarifPaths.map((p) => `\`${p}\``).join(", ") || "—"}`,
      `- Kind: \`${report.kind}\``,
      "",
      "Desk D consumes Desk B→A→C→E artifacts; it does not re-scan repos.",
      "Generate-only — no auto-install · no marketplace publish.",
      "Refuses exploits, PoCs, and offensive skill patterns.",
      "",
    ].join("\n"),
  );

  return {
    report,
    outputDir: absOut,
    craftJsonPath,
    craftMdPath,
    readmePath,
    skillPaths,
    pluginPaths,
  };
}

/** Default fixture reports path (checked-in Desk B/A/C/E artifacts) — use with --fixture. */
export function defaultCraftReportsDir(repoRoot?: string): string {
  return path.join(repoRoot ?? REPO_ROOT_FROM_SRC, "docs", "reports");
}

export { DEFAULT_CRAFT_NAME };
