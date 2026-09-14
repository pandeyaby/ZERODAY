/**
 * Desk slice C — build harden recommendations from Desk B / Desk A reports.
 * Consumes existing inventory / packet artifacts; does not re-scan repos.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactInventoryText } from "../factory/inventory-evidence";
import { assertNoExploitInvariant } from "../locate/invariant";
import { buildHardenDraftNotes } from "./draft";
import {
  emptyCategoryCounts,
  toHardenRecommendations,
  type HardenSourceFinding,
} from "./recommend";
import { toHardenMarkdown, toHardenReadme } from "./summary";
import type { HardenReport, HardenWriteResult } from "./types";

const HARDEN_SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_FROM_SRC = path.resolve(HARDEN_SRC_DIR, "../..");

interface LoadedHardenSources {
  reportsDir: string;
  inventoryJsonPath: string | null;
  packetJsonPath: string | null;
  findingsJsonPath: string | null;
  caseNotePath: string | null;
  sarifPaths: string[];
  findings: HardenSourceFinding[];
}

function existsFile(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function prefer(...candidates: string[]): string | null {
  for (const c of candidates) {
    if (existsFile(c)) return c;
  }
  return null;
}

function collectSarifPaths(dir: string): string[] {
  const preferred = [
    path.join(dir, "inventory.sarif"),
    path.join(dir, "desk-b-inventory.sarif"),
  ].filter(existsFile);

  if (preferred.length > 0) return preferred;

  try {
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".sarif"))
      .map((n) => path.join(dir, n))
      .sort();
  } catch {
    return [];
  }
}

function loadFindingsFromInventoryJson(
  jsonPath: string,
): HardenSourceFinding[] {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
    findings?: HardenSourceFinding[];
    repos?: Array<{ repoId?: string; findings?: HardenSourceFinding[] }>;
  };

  if (Array.isArray(raw.findings) && raw.findings.length > 0) {
    return raw.findings;
  }

  if (Array.isArray(raw.repos)) {
    const flat: HardenSourceFinding[] = [];
    for (const r of raw.repos) {
      for (const f of r.findings ?? []) {
        flat.push({
          ...f,
          repoId: f.repoId ?? r.repoId,
        });
      }
    }
    return flat;
  }

  return [];
}

function loadFindingsFromPacket(
  packetPath: string | null,
  findingsPath: string | null,
): HardenSourceFinding[] {
  const pathToRead = findingsPath ?? packetPath;
  if (!pathToRead) return [];

  const raw = JSON.parse(fs.readFileSync(pathToRead, "utf8")) as {
    findings?: HardenSourceFinding[];
  };

  if (!Array.isArray(raw.findings)) return [];
  return raw.findings;
}

/**
 * Resolve Desk B inventory and/or Desk A packet artifacts under a reports dir.
 * Accepts live output dirs or checked-in `docs/reports` / `docs/reports/desk-a-packet`.
 */
export function loadHardenSources(reportsDir: string): LoadedHardenSources {
  const abs = path.resolve(reportsDir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Reports directory not found: ${abs}`);
  }

  const inventoryJsonPath = prefer(
    path.join(abs, "inventory.json"),
    path.join(abs, "desk-b-inventory.json"),
  );
  const packetJsonPath = prefer(path.join(abs, "packet.json"));
  const findingsJsonPath = prefer(path.join(abs, "findings.json"));
  const caseNotePath = prefer(
    path.join(abs, "case-note.md"),
    path.join(abs, "desk-b-case-note.md"),
  );
  const sarifPaths = collectSarifPaths(abs);

  if (
    !inventoryJsonPath &&
    !packetJsonPath &&
    !findingsJsonPath &&
    sarifPaths.length === 0
  ) {
    throw new Error(
      `No inventory.json / desk-b-inventory.json / packet.json / findings.json under ${abs}. ` +
        `Run inventory or packet first, or pass docs/reports / docs/reports/desk-a-packet.`,
    );
  }

  // Prefer packet findings when present (already classified); else inventory.
  let findings: HardenSourceFinding[] = [];
  if (packetJsonPath || findingsJsonPath) {
    findings = loadFindingsFromPacket(packetJsonPath, findingsJsonPath);
  }
  if (findings.length === 0 && inventoryJsonPath) {
    findings = loadFindingsFromInventoryJson(inventoryJsonPath);
  }

  return {
    reportsDir: abs,
    inventoryJsonPath,
    packetJsonPath,
    findingsJsonPath,
    caseNotePath,
    sarifPaths,
    findings,
  };
}

/** Prefer a short relative label over absolute machine paths. */
function relativeReportsLabel(absDir: string): string {
  const abs = path.resolve(absDir);
  if (abs.endsWith(`${path.sep}docs${path.sep}reports`)) {
    return "docs/reports";
  }
  if (abs.endsWith(`${path.sep}desk-a-packet`)) {
    const parent = path.dirname(abs);
    if (parent.endsWith(`${path.sep}docs${path.sep}reports`)) {
      return "docs/reports/desk-a-packet";
    }
  }
  const cwdRel = path.relative(process.cwd(), abs);
  if (cwdRel && !cwdRel.startsWith("..") && !path.isAbsolute(cwdRel)) {
    return cwdRel.split(path.sep).join("/");
  }
  return path.basename(abs);
}

export function buildHardenReport(
  reportsDir: string,
  opts?: {
    draft?: boolean;
    reportsDirLabel?: string;
  },
): HardenReport {
  const loaded = loadHardenSources(reportsDir);
  const includeDraft = opts?.draft === true;
  const recommendations = toHardenRecommendations(loaded.findings, {
    includeDraftRefs: includeDraft,
  });
  const categoryCounts = emptyCategoryCounts();
  for (const r of recommendations) {
    categoryCounts[r.category] += 1;
  }

  const draftNotes = includeDraft
    ? buildHardenDraftNotes(recommendations)
    : [];

  const displayDir =
    opts?.reportsDirLabel?.trim() ||
    relativeReportsLabel(loaded.reportsDir);

  const report: HardenReport = {
    schemaVersion: "zeroday-harden-recommendations/v1",
    desk: "C",
    generatedAt: new Date().toISOString(),
    source: {
      reportsDir: displayDir,
      inventoryJson: loaded.inventoryJsonPath
        ? path.basename(loaded.inventoryJsonPath)
        : null,
      packetJson: loaded.packetJsonPath
        ? path.basename(loaded.packetJsonPath)
        : null,
      findingsJson: loaded.findingsJsonPath
        ? path.basename(loaded.findingsJsonPath)
        : null,
      caseNote: loaded.caseNotePath
        ? path.basename(loaded.caseNotePath)
        : null,
      sarifPaths: loaded.sarifPaths.map((p) => path.basename(p)),
    },
    recommendations,
    categoryCounts,
    draftNotes: draftNotes.map((d) => ({
      id: d.id,
      recommendationId: d.recommendationId,
      relativePath: d.relativePath,
      title: d.title,
      // Keep markdown out of the JSON blob summary path — stored as files
      markdown: "[see file]",
    })),
    posture: {
      recommendationsOnly: true,
      noAutoApply: true,
      noAutoPr: true,
      noAutoMerge: true,
      noPoC: true,
      secretsRedacted: true,
      needsHuman: true,
      draftNotesHumanGated: true,
      localizationOnly: true,
    },
  };

  const blob = redactInventoryText(JSON.stringify(report), [
    loaded.reportsDir,
  ]);
  return JSON.parse(blob) as HardenReport;
}

/**
 * Write harden recommendations directory from an inventory/packet reports dir.
 */
export function writeHardenReport(
  reportsDir: string,
  outputDir: string,
  opts?: { draft?: boolean },
): HardenWriteResult {
  const absOut = path.resolve(outputDir);
  fs.mkdirSync(absOut, { recursive: true });

  const loaded = loadHardenSources(reportsDir);
  const includeDraft = opts?.draft === true;
  const report = buildHardenReport(reportsDir, { draft: includeDraft });

  // Rebuild draft notes with full markdown for file writes
  const fullDrafts = includeDraft
    ? buildHardenDraftNotes(
        toHardenRecommendations(loaded.findings, { includeDraftRefs: true }),
      )
    : [];

  const hardenMd = toHardenMarkdown({
    ...report,
    draftNotes: fullDrafts.map((d) => ({
      id: d.id,
      recommendationId: d.recommendationId,
      relativePath: d.relativePath,
      title: d.title,
      markdown: "[see file]",
    })),
  });
  const readme = toHardenReadme();
  const hardenJson = JSON.stringify(report, null, 2);

  assertNoExploitInvariant([hardenMd, readme, hardenJson]);
  for (const d of fullDrafts) {
    assertNoExploitInvariant([d.markdown]);
  }

  const hardenJsonPath = path.join(absOut, "harden.json");
  const hardenMdPath = path.join(absOut, "harden.md");
  const readmePath = path.join(absOut, "README.md");

  fs.writeFileSync(
    hardenJsonPath,
    redactInventoryText(hardenJson, [loaded.reportsDir]),
  );
  fs.writeFileSync(
    hardenMdPath,
    redactInventoryText(hardenMd, [loaded.reportsDir]),
  );
  fs.writeFileSync(readmePath, readme);

  const draftPaths: string[] = [];
  let draftDir: string | null = null;
  if (fullDrafts.length > 0) {
    draftDir = path.join(absOut, "drafts");
    fs.mkdirSync(draftDir, { recursive: true });
    for (const d of fullDrafts) {
      const dest = path.join(absOut, d.relativePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(
        dest,
        redactInventoryText(d.markdown, [loaded.reportsDir]),
      );
      draftPaths.push(dest);
    }
  }

  fs.writeFileSync(
    path.join(absOut, "SOURCE.md"),
    [
      "# Harden source provenance",
      "",
      `- Reports dir: \`${report.source.reportsDir}\``,
      `- Inventory JSON: \`${report.source.inventoryJson ?? "—"}\``,
      `- Packet JSON: \`${report.source.packetJson ?? "—"}\``,
      `- Findings JSON: \`${report.source.findingsJson ?? "—"}\``,
      `- Case note: \`${report.source.caseNote ?? "—"}\``,
      `- SARIF: ${report.source.sarifPaths.map((p) => `\`${p}\``).join(", ") || "—"}`,
      `- Draft: ${includeDraft ? "yes (human-gated notes only)" : "no (recommendations only)"}`,
      "",
      "Desk C consumes Desk B + Desk A artifacts; it does not re-scan repos.",
      "No auto-apply · no auto-PR · no auto-merge.",
      "",
    ].join("\n"),
  );

  return {
    report,
    outputDir: absOut,
    hardenJsonPath,
    hardenMdPath,
    draftDir,
    draftPaths,
    readmePath,
  };
}

/** Default fixture reports path (checked-in Desk B artifacts). */
export function defaultHardenReportsDir(repoRoot?: string): string {
  return path.join(repoRoot ?? REPO_ROOT_FROM_SRC, "docs", "reports");
}
