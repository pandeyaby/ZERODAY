/**
 * Desk Reports browser + org cassette record/replay (UI-2).
 * Path-sandboxed via path-policy. Reuses K3 recordCassette / locate --recording.
 * Redact default ON; UI/API refuse --no-redact. No live / RunPod / file exfil.
 */

import fs from "node:fs";
import path from "node:path";
import {
  assertPathAllowed,
  getAllowedRoots,
  PathPolicyError,
  resolveOutputDir,
} from "../lib/path-policy";
import {
  locate,
  recordCassette,
  HUMAN_REVIEW_NOTE,
  type LocalizationResult,
} from "../locate/index";
import { RecordRefuseError } from "../locate/record/index";

const HONESTY_BANNER =
  "needs_human · no PoC · localization ≠ exploitability · no auto-merge · reports + cassettes = org regression, not discovery";

export const REPORTS_ACTIONS = [
  "list",
  "preview",
  "record",
  "replay",
] as const;

export type ReportsAction = (typeof REPORTS_ACTIONS)[number];

export interface ReportListEntry {
  dir: string;
  name: string;
  mtimeMs: number;
  kind: "locate" | "inventory" | "other";
  mode?: string;
  advisory?: string;
  cweId?: string;
  findingCount?: number;
  hasReportJson: boolean;
  hasCassette: boolean;
  artifactHints: string[];
}

export interface ReportsListResult {
  kind: "reports-list";
  mode: "reports";
  roots: string[];
  reportsRoot: string;
  entries: ReportListEntry[];
  honesty: string[];
}

export interface ReportsPreviewResult {
  kind: "reports-preview";
  mode: string;
  dir: string;
  advisory?: string;
  cweId?: string;
  findingCount: number;
  rankedFiles: Array<{
    rank: number;
    filePath: string;
    title: string;
    cweIds: string[];
  }>;
  paths: Record<string, string>;
  warnings: string[];
  needs_human: true;
  honesty: string;
}

export interface ReportsRecordResult {
  kind: "cassette-record";
  mode: "record";
  fromDir: string;
  outPath: string;
  sourceMode: string;
  findingCount: number;
  redacted: true;
  humanReviewNote: string;
  needs_human: true;
  honesty: string;
}

export interface ReportsReplayResult {
  kind: "locate";
  mode: "recording";
  action: "replay";
  advisory: string;
  cweId: string;
  findingCount: number;
  rankedFiles: Array<{
    rank: number;
    filePath: string;
    title: string;
    cweIds: string[];
  }>;
  outputDir: string;
  paths: {
    json: string;
    sarif: string;
    report: string;
  };
  cassettePath: string;
  warnings: string[];
  needs_human: true;
  honesty: string;
}

export type ReportsResult =
  | ReportsListResult
  | ReportsPreviewResult
  | ReportsRecordResult
  | ReportsReplayResult;

export interface ReportsRunRequest {
  action: ReportsAction;
  /** Report dir or report.json for preview / record --from. */
  from?: string;
  /** Cassette out path (record) or cassette path (replay). */
  cassette?: string;
  /** Output dir for replay locate artifacts. */
  output?: string;
  /**
   * Redaction flag. Default / omitted = ON.
   * Explicit false is refused (UI must not offer --no-redact).
   */
  redact?: boolean;
  cwd?: string;
  /** Max report dirs to return from list (default 40). */
  limit?: number;
}

const ARTIFACT_NAMES = [
  "report.json",
  "report.sarif",
  "report.md",
  "comment.md",
  "inventory.json",
  "inventory.sarif",
  "inventory.md",
  "packet.json",
  "harden.json",
  "classify.json",
] as const;

function reportsRootFor(cwd: string): string {
  return path.join(cwd, "zeroday-reports");
}

function detectKind(dir: string): ReportListEntry["kind"] {
  if (fs.existsSync(path.join(dir, "report.json"))) return "locate";
  if (fs.existsSync(path.join(dir, "inventory.json"))) return "inventory";
  return "other";
}

function peekLocateMeta(dir: string): {
  mode?: string;
  advisory?: string;
  cweId?: string;
  findingCount?: number;
} {
  const reportPath = path.join(dir, "report.json");
  if (!fs.existsSync(reportPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      mode?: string;
      advisory?: { id?: string; cweId?: string };
      summary?: { findingCount?: number };
      rankedFiles?: unknown[];
    };
    return {
      mode: raw.mode,
      advisory: raw.advisory?.id,
      cweId: raw.advisory?.cweId,
      findingCount:
        raw.summary?.findingCount ??
        (Array.isArray(raw.rankedFiles) ? raw.rankedFiles.length : undefined),
    };
  } catch {
    return {};
  }
}

function listArtifactHints(dir: string): string[] {
  const hints: string[] = [];
  for (const name of ARTIFACT_NAMES) {
    if (fs.existsSync(path.join(dir, name))) hints.push(name);
  }
  try {
    for (const ent of fs.readdirSync(dir)) {
      if (ent.endsWith(".cassette.json") || ent.endsWith(".cassette")) {
        hints.push(ent);
      }
    }
  } catch {
    /* ignore */
  }
  return hints;
}

function hasCassetteFile(dir: string): boolean {
  try {
    return fs
      .readdirSync(dir)
      .some(
        (n) =>
          n.endsWith(".cassette.json") ||
          n.endsWith(".cassette") ||
          n === "cassette.json",
      );
  } catch {
    return false;
  }
}

/**
 * List recent report directories under sandboxed zeroday-reports/ (+ shallow
 * children). Preview metadata only — never serves file bodies outside summary.
 */
export function listReports(options?: {
  cwd?: string;
  limit?: number;
}): ReportsListResult {
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const roots = getAllowedRoots({ cwd });
  const reportsRoot = reportsRootFor(cwd);
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const entries: ReportListEntry[] = [];

  if (fs.existsSync(reportsRoot)) {
    assertPathAllowed(reportsRoot, {
      cwd,
      mustExist: true,
      kind: "dir",
      label: "reportsRoot",
    });
    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(reportsRoot, { withFileTypes: true });
    } catch {
      children = [];
    }
    for (const ent of children) {
      if (!ent.isDirectory()) continue;
      const dir = path.join(reportsRoot, ent.name);
      // Skip escape via symlink outside sandbox
      try {
        assertPathAllowed(dir, { cwd, mustExist: true, kind: "dir" });
      } catch {
        continue;
      }
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(dir).mtimeMs;
      } catch {
        continue;
      }
      const kind = detectKind(dir);
      const meta = kind === "locate" ? peekLocateMeta(dir) : {};
      entries.push({
        dir,
        name: ent.name,
        mtimeMs,
        kind,
        ...meta,
        hasReportJson: fs.existsSync(path.join(dir, "report.json")),
        hasCassette: hasCassetteFile(dir),
        artifactHints: listArtifactHints(dir),
      });
    }
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);

  return {
    kind: "reports-list",
    mode: "reports",
    roots,
    reportsRoot,
    entries: entries.slice(0, limit),
    honesty: [
      "Reports browser previews summaries in-panel — copy paths only; no arbitrary download outside sandbox",
      "Org cassettes = CI regression (record --redact → locate --recording), not discovery",
      "Redact default ON; UI refuses --no-redact",
      "needs_human always · no PoC · no auto-commit / exfil of cassettes",
      "Paths must stay under cwd (or ZERODAY_UI_ROOTS)",
    ],
  };
}

function collectArtifactPaths(dir: string): Record<string, string> {
  const paths: Record<string, string> = {};
  const map: Record<string, string> = {
    json: "report.json",
    sarif: "report.sarif",
    report: "report.md",
    comment: "comment.md",
    inventoryJson: "inventory.json",
    inventorySarif: "inventory.sarif",
    inventoryMd: "inventory.md",
  };
  for (const [key, name] of Object.entries(map)) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) paths[key] = p;
  }
  try {
    for (const ent of fs.readdirSync(dir)) {
      if (ent.endsWith(".cassette.json") || ent === "cassette.json") {
        paths[`cassette:${ent}`] = path.join(dir, ent);
      }
    }
  } catch {
    /* ignore */
  }
  return paths;
}

/** Preview report.json key fields only (no raw file body dump). */
export function previewReport(
  from: string,
  options?: { cwd?: string },
): ReportsPreviewResult {
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const abs = assertPathAllowed(from, {
    cwd,
    mustExist: true,
    kind: "any",
    label: "from",
  });

  let dir = abs;
  let reportPath = path.join(abs, "report.json");
  if (fs.statSync(abs).isFile()) {
    dir = path.dirname(abs);
    reportPath = abs.endsWith("report.json")
      ? abs
      : path.join(dir, "report.json");
  }

  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `preview: no report.json under ${dir} (locate reports only)`,
    );
  }

  // Ensure report.json itself is sandboxed
  assertPathAllowed(reportPath, {
    cwd,
    mustExist: true,
    kind: "file",
    label: "report.json",
  });

  const raw = JSON.parse(
    fs.readFileSync(reportPath, "utf8"),
  ) as LocalizationResult;

  const rankedFiles = (raw.rankedFiles ?? []).slice(0, 50).map((f) => ({
    rank: f.rank,
    filePath: f.filePath,
    title: f.title,
    cweIds: f.cweIds ?? [],
  }));

  return {
    kind: "reports-preview",
    mode: raw.mode || "unknown",
    dir,
    advisory: raw.advisory?.id,
    cweId: raw.advisory?.cweId,
    findingCount:
      raw.summary?.findingCount ?? rankedFiles.length,
    rankedFiles,
    paths: collectArtifactPaths(dir),
    warnings: (raw.warnings ?? []).slice(0, 20),
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

/**
 * Record redacted org cassette from a locate reports dir.
 * Redact always ON; explicit redact:false / --no-redact refused.
 */
export function recordOrgCassette(
  req: Pick<ReportsRunRequest, "from" | "cassette" | "redact" | "cwd">,
): ReportsRecordResult {
  const cwd = path.resolve(req.cwd ?? process.cwd());

  if (req.redact === false) {
    throw new RecordRefuseError(
      "Desk UI refuses --no-redact: org cassettes require redaction (Keyless K3 / GRAX). Redact default ON.",
    );
  }

  if (!req.from?.trim()) {
    throw new PathPolicyError("from: locate reports dir is required");
  }

  const fromDir = assertPathAllowed(req.from.trim(), {
    cwd,
    mustExist: true,
    kind: "any",
    label: "from",
  });

  const outRel =
    req.cassette?.trim() ||
    path.join(
      reportsRootFor(cwd),
      "cassettes",
      `org-${Date.now()}.cassette.json`,
    );
  const outPath = assertPathAllowed(outRel, {
    cwd,
    label: "cassette",
  });

  const artifacts = recordCassette({
    from: fromDir,
    out: outPath,
    redact: true,
  });

  return {
    kind: "cassette-record",
    mode: "record",
    fromDir: artifacts.fromDir,
    outPath: artifacts.outPath,
    sourceMode: artifacts.cassette.sourceMode,
    findingCount: artifacts.findingCount,
    redacted: true,
    humanReviewNote: artifacts.cassette.humanReviewNote || HUMAN_REVIEW_NOTE,
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

/** Replay redacted cassette via locate --recording (mode=recording). */
export async function replayOrgCassette(
  req: Pick<ReportsRunRequest, "cassette" | "output" | "cwd">,
): Promise<ReportsReplayResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  if (!req.cassette?.trim()) {
    throw new PathPolicyError("cassette: path is required for replay");
  }

  const cassettePath = assertPathAllowed(req.cassette.trim(), {
    cwd,
    mustExist: true,
    kind: "file",
    label: "cassette",
  });

  const outputDir = resolveOutputDir(
    req.output,
    `desk-replay-${Date.now()}`,
    { cwd },
  );

  const artifacts = await locate({
    repo: cwd,
    advisory: "",
    recording: cassettePath,
    outputDir,
  });

  if (artifacts.result.mode !== "recording") {
    throw new Error(
      `Replay invariant broken: expected mode=recording, got ${artifacts.result.mode}`,
    );
  }

  return {
    kind: "locate",
    mode: "recording",
    action: "replay",
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
    },
    cassettePath,
    warnings: artifacts.result.warnings,
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

export async function runReportsAction(
  req: ReportsRunRequest,
): Promise<ReportsResult> {
  const action = req.action;
  if (!action || !REPORTS_ACTIONS.includes(action)) {
    throw new Error(`action must be one of: ${REPORTS_ACTIONS.join("|")}`);
  }
  switch (action) {
    case "list":
      return listReports({ cwd: req.cwd, limit: req.limit });
    case "preview":
      if (!req.from?.trim()) {
        throw new PathPolicyError("from: report dir is required for preview");
      }
      return previewReport(req.from.trim(), { cwd: req.cwd });
    case "record":
      return recordOrgCassette(req);
    case "replay":
      return replayOrgCassette(req);
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}

export { PathPolicyError, RecordRefuseError, HUMAN_REVIEW_NOTE };
