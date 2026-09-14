/**
 * Desk slice A — build offline security packet from Desk B inventory reports.
 * Consumes existing inventory JSON + SARIF; does not re-run inventory.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactInventoryText } from "../factory/inventory-evidence";
import { assertNoExploitInvariant } from "../locate/invariant";
import { classifyInventoryKind, isPacketFindingKind } from "./classify";
import {
  toFindingsMarkdown,
  toPacketReadme,
  toPacketSummary,
} from "./summary";
import type {
  PacketClassification,
  PacketFinding,
  PacketWriteResult,
  SecurityPacket,
} from "./types";

const PACKET_SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_FROM_SRC = path.resolve(PACKET_SRC_DIR, "../..");

const PLACEHOLDER = "_TBD — fill before sharing_";

interface RawInventoryFinding {
  id: string;
  kind: string;
  severity?: string;
  path: string;
  title?: string;
  summary?: string;
  pattern?: string;
  startLine?: number;
  tags?: string[];
  repoId?: string;
}

interface LoadedReports {
  reportsDir: string;
  inventoryJsonPath: string | null;
  caseNotePath: string | null;
  sarifPaths: string[];
  findings: RawInventoryFinding[];
  generatedAt?: string;
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

  // Fallback: any *.sarif in the reports dir (non-recursive)
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
): { findings: RawInventoryFinding[]; generatedAt?: string } {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
    schemaVersion?: string;
    generatedAt?: string;
    findings?: RawInventoryFinding[];
    repos?: Array<{ repoId?: string; findings?: RawInventoryFinding[] }>;
  };

  if (Array.isArray(raw.findings) && raw.findings.length > 0) {
    return { findings: raw.findings, generatedAt: raw.generatedAt };
  }

  // Single-repo inventory without flattened findings
  if (Array.isArray(raw.repos)) {
    const flat: RawInventoryFinding[] = [];
    for (const r of raw.repos) {
      for (const f of r.findings ?? []) {
        flat.push({
          ...f,
          repoId: f.repoId ?? r.repoId,
        });
      }
    }
    return { findings: flat, generatedAt: raw.generatedAt };
  }

  return { findings: [], generatedAt: raw.generatedAt };
}

/**
 * Resolve Desk B inventory artifacts under a reports directory.
 * Accepts live inventory output dirs or checked-in `docs/reports`.
 */
export function loadPacketSources(reportsDir: string): LoadedReports {
  const abs = path.resolve(reportsDir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Reports directory not found: ${abs}`);
  }

  const inventoryJsonPath = prefer(
    path.join(abs, "inventory.json"),
    path.join(abs, "desk-b-inventory.json"),
  );
  const caseNotePath = prefer(
    path.join(abs, "case-note.md"),
    path.join(abs, "desk-b-case-note.md"),
  );
  const sarifPaths = collectSarifPaths(abs);

  if (!inventoryJsonPath && sarifPaths.length === 0) {
    throw new Error(
      `No inventory.json / desk-b-inventory.json or *.sarif under ${abs}. ` +
        `Run inventory first, pass --from <dir>, or use --fixture for smoke.`,
    );
  }

  let findings: RawInventoryFinding[] = [];
  let generatedAt: string | undefined;
  if (inventoryJsonPath) {
    const loaded = loadFindingsFromInventoryJson(inventoryJsonPath);
    findings = loaded.findings;
    generatedAt = loaded.generatedAt;
  }

  return {
    reportsDir: abs,
    inventoryJsonPath,
    caseNotePath,
    sarifPaths,
    findings,
    generatedAt,
  };
}

function emptyCounts(): Record<PacketClassification, number> {
  return {
    "agent-misfire": 0,
    config: 0,
    dependency: 0,
    unknown: 0,
  };
}

export function toPacketFindings(
  raw: RawInventoryFinding[],
): PacketFinding[] {
  const out: PacketFinding[] = [];
  for (const f of raw) {
    if (!isPacketFindingKind(f.kind)) continue;
    const rule = classifyInventoryKind(f.kind);
    const severity =
      f.severity === "warning" || f.severity === "note"
        ? f.severity
        : "note";
    out.push({
      id: f.id,
      classification: rule.classification,
      classificationBasis: rule.basis,
      severity,
      kind: f.kind,
      repoId: f.repoId,
      path: f.path,
      pattern: f.pattern,
      title: f.title ?? f.kind,
      summary: f.summary ?? "",
      startLine: f.startLine,
      tags: f.tags,
    });
  }
  return out.sort(
    (a, b) =>
      a.classification.localeCompare(b.classification) ||
      (a.repoId ?? "").localeCompare(b.repoId ?? "") ||
      a.path.localeCompare(b.path) ||
      a.id.localeCompare(b.id),
  );
}

export function buildSecurityPacket(
  reportsDir: string,
  opts?: {
    moduleLink?: string;
    prLink?: string;
    ticketLink?: string;
    /** Optional display label for reports dir (relative path preferred) */
    reportsDirLabel?: string;
  },
): SecurityPacket {
  const loaded = loadPacketSources(reportsDir);
  const findings = toPacketFindings(loaded.findings);
  const classificationCounts = emptyCounts();
  for (const f of findings) {
    classificationCounts[f.classification] += 1;
  }

  const displayDir =
    opts?.reportsDirLabel?.trim() ||
    relativeReportsLabel(loaded.reportsDir);

  const packet: SecurityPacket = {
    schemaVersion: "zeroday-security-packet/v1",
    desk: "A",
    generatedAt: new Date().toISOString(),
    source: {
      reportsDir: displayDir,
      inventoryJson: loaded.inventoryJsonPath
        ? path.basename(loaded.inventoryJsonPath)
        : null,
      caseNote: loaded.caseNotePath
        ? path.basename(loaded.caseNotePath)
        : null,
      sarifPaths: loaded.sarifPaths.map((p) => path.basename(p)),
    },
    findings,
    classificationCounts,
    placeholders: {
      moduleLink: opts?.moduleLink?.trim() || PLACEHOLDER,
      prLink: opts?.prLink?.trim() || PLACEHOLDER,
      ticketLink: opts?.ticketLink?.trim() || PLACEHOLDER,
    },
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
      noAutoSend: true,
      secretsRedacted: true,
      needsHuman: true,
      hardenNotesOnly: true,
    },
  };

  // Sanitize absolute paths that may have leaked into summaries
  const blob = redactInventoryText(JSON.stringify(packet), [
    loaded.reportsDir,
  ]);
  return JSON.parse(blob) as SecurityPacket;
}

/** Prefer a short relative label over absolute machine paths. */
function relativeReportsLabel(absDir: string): string {
  const abs = path.resolve(absDir);
  // Common checked-in fixture
  if (abs.endsWith(`${path.sep}docs${path.sep}reports`)) {
    return "docs/reports";
  }
  const cwdRel = path.relative(process.cwd(), abs);
  if (cwdRel && !cwdRel.startsWith("..") && !path.isAbsolute(cwdRel)) {
    return cwdRel.split(path.sep).join("/");
  }
  return path.basename(abs);
}

function copySarifRedacted(
  srcPath: string,
  destPath: string,
  redactRoots: string[],
): void {
  const text = fs.readFileSync(srcPath, "utf8");
  const redacted = redactInventoryText(text, redactRoots);
  fs.writeFileSync(destPath, redacted);
}

/**
 * Write a full security packet directory from an inventory reports dir.
 */
export function writeSecurityPacket(
  reportsDir: string,
  outputDir: string,
  opts?: {
    moduleLink?: string;
    prLink?: string;
    ticketLink?: string;
  },
): PacketWriteResult {
  const absOut = path.resolve(outputDir);
  fs.mkdirSync(absOut, { recursive: true });

  const loaded = loadPacketSources(reportsDir);
  const packet = buildSecurityPacket(reportsDir, opts);

  const summary = toPacketSummary(packet);
  const findingsMd = toFindingsMarkdown(packet);
  const readme = toPacketReadme();
  const packetJson = JSON.stringify(packet, null, 2);

  assertNoExploitInvariant([summary, findingsMd, readme, packetJson]);

  const packetJsonPath = path.join(absOut, "packet.json");
  const summaryPath = path.join(absOut, "summary.md");
  const findingsJsonPath = path.join(absOut, "findings.json");
  const findingsMdPath = path.join(absOut, "findings.md");
  const readmePath = path.join(absOut, "README.md");

  fs.writeFileSync(packetJsonPath, packetJson);
  fs.writeFileSync(summaryPath, summary);
  fs.writeFileSync(
    findingsJsonPath,
    redactInventoryText(
      JSON.stringify(
        {
          schemaVersion: "zeroday-security-packet-findings/v1",
          generatedAt: packet.generatedAt,
          classificationCounts: packet.classificationCounts,
          findings: packet.findings,
        },
        null,
        2,
      ),
      [loaded.reportsDir],
    ),
  );
  fs.writeFileSync(findingsMdPath, findingsMd);
  fs.writeFileSync(readmePath, readme);

  const writtenSarif: string[] = [];
  for (const src of loaded.sarifPaths) {
    const destName = path.basename(src);
    const dest = path.join(absOut, destName);
    copySarifRedacted(src, dest, [loaded.reportsDir]);
    writtenSarif.push(dest);
  }

  // Source provenance note (basename / relative labels only)
  const displayDir = packet.source.reportsDir;
  fs.writeFileSync(
    path.join(absOut, "SOURCE.md"),
    [
      "# Packet source provenance",
      "",
      `- Reports dir: \`${displayDir}\``,
      `- Inventory JSON: \`${packet.source.inventoryJson ?? "—"}\``,
      `- Case note: \`${packet.source.caseNote ?? "—"}\``,
      `- SARIF: ${packet.source.sarifPaths.map((p) => `\`${p}\``).join(", ") || "—"}`,
      "",
      "Desk A packages Desk B artifacts; it does not re-scan repos.",
      "",
    ].join("\n"),
  );

  return {
    packet,
    outputDir: absOut,
    packetJsonPath,
    summaryPath,
    findingsJsonPath,
    findingsMdPath,
    sarifPaths: writtenSarif,
    readmePath,
  };
}

/** Default fixture reports path (checked-in Desk B artifacts) — use with --fixture. */
export function defaultPacketReportsDir(repoRoot?: string): string {
  return path.join(repoRoot ?? REPO_ROOT_FROM_SRC, "docs", "reports");
}
