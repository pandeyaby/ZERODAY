/**
 * Redaction pipeline for org CI cassettes (Keyless K3).
 * Absolute paths → repo-relative; secret-shaped strings stripped.
 * Fail-closed: refuse to emit a cassette when redaction cannot be proven.
 */

import fs from "node:fs";
import path from "node:path";
import { redactInventoryText } from "../../factory/inventory-evidence";
import type {
  LocalizationResult,
  RankedFile,
  TraceStep,
  EvidenceSpan,
} from "../types";
import {
  type OrgCassette,
  type CassetteSourceMode,
  ORG_CASSETTE_SCHEMA,
  HUMAN_REVIEW_NOTE,
} from "./types";

/** Secret-shaped tokens that must not appear in a written cassette. */
const SECRET_LEAK_RE =
  /\b(?:sk|rk|ghp|gho|ghu|ghs|ghr|hf)_[A-Za-z0-9_]{6,}\b|\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{20,})\b|\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i;

/** Absolute path shapes that must not survive redaction. */
const ABS_PATH_LEAK_RE =
  /(?:\/(?:Users|home|tmp|var\/folders|var\/tmp|opt\/cursor|workspace|private\/tmp)\/|[A-Za-z]:\\)/;

export class RecordRefuseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordRefuseError";
  }
}

export interface LoadedLocateReport {
  report: LocalizationResult;
  reportPath: string;
  fromDir: string;
}

/**
 * Load report.json from a locate reports directory (or a direct report.json path).
 */
export function loadLocateReport(from: string): LoadedLocateReport {
  const resolved = path.resolve(from);
  let reportPath: string;
  let fromDir: string;

  // Allow either the reports dir or a direct report.json path.
  if (resolved.endsWith("report.json") || resolved.endsWith(".json")) {
    reportPath = resolved;
    fromDir = path.dirname(resolved);
  } else {
    fromDir = resolved;
    reportPath = path.join(fromDir, "report.json");
  }

  if (!fs.existsSync(reportPath)) {
    throw new RecordRefuseError(
      `record refused: missing report.json at ${reportPath}. ` +
        `Run locate first, then: zeroday record --from <locate-reports-dir> --out <cassette.json>`,
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(reportPath, "utf8");
  } catch (e) {
    throw new RecordRefuseError(
      `record refused: cannot read report.json (${(e as Error).message})`,
    );
  }

  let report: LocalizationResult;
  try {
    report = JSON.parse(raw) as LocalizationResult;
  } catch {
    throw new RecordRefuseError(
      "record refused: report.json is not valid JSON.",
    );
  }

  return { report, reportPath, fromDir };
}

/** Validate report is complete enough to cassette — fail closed. */
export function assertRecordableReport(report: LocalizationResult): void {
  if (!report || typeof report !== "object") {
    throw new RecordRefuseError("record refused: report.json is empty or invalid.");
  }
  if (!Array.isArray(report.rankedFiles)) {
    throw new RecordRefuseError(
      "record refused: report.json missing rankedFiles (incomplete / corrupt locate output).",
    );
  }
  if (report.rankedFiles.length === 0) {
    throw new RecordRefuseError(
      "record refused: rankedFiles is empty — org cassettes require at least one finding. " +
        "Incomplete or clean-negative runs are not recorded for CI regression.",
    );
  }
  if (report.summary?.incompleteReason) {
    throw new RecordRefuseError(
      `record refused: locate run is incomplete (${report.summary.incompleteReason}). ` +
        `Only complete localizations with rankedFiles may become org cassettes.`,
    );
  }
  if (!report.advisory?.cweId) {
    throw new RecordRefuseError(
      "record refused: report.json missing advisory.cweId.",
    );
  }
  if (!report.mode) {
    throw new RecordRefuseError("record refused: report.json missing mode.");
  }
  if (report.mode === "recording") {
    throw new RecordRefuseError(
      "record refused: cannot re-record a recording replay. Record from rules/ingest/live/fixture locate output.",
    );
  }
}

function relativizePath(filePath: string, repoRoot: string): string {
  if (!filePath) return filePath;
  const normalized = filePath.replace(/\\/g, "/");
  const root = path.resolve(repoRoot).replace(/\\/g, "/");

  if (normalized === root || normalized.startsWith(root + "/")) {
    const rel = path.relative(root, normalized).replace(/\\/g, "/");
    return rel || ".";
  }

  // Already relative?
  if (!path.isAbsolute(filePath) && !/^[A-Za-z]:[\\/]/.test(filePath)) {
    return normalized.replace(/^\.\//, "");
  }

  // Snapshot /tmp paths — keep basename-ish relative label
  const snap = normalized.match(/\/snapshot\/(.+)$/);
  if (snap) return snap[1];

  // Fall back to basename so we never keep an absolute path
  return path.basename(normalized);
}

function sanitizeText(text: string, repoRoots: string[]): string {
  let out = redactInventoryText(text, repoRoots);
  // Extra secret shapes (Bearer / sk- long form) beyond inventory helper
  out = out
    .replace(
      /\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{20,})\b/g,
      "[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
  return out;
}

function redactEvidence(
  span: EvidenceSpan,
  repoRoot: string,
  roots: string[],
): EvidenceSpan {
  return {
    ...span,
    filePath: relativizePath(span.filePath, repoRoot),
    excerpt: span.excerpt ? sanitizeText(span.excerpt, roots) : undefined,
    note: sanitizeText(span.note, roots),
  };
}

function redactRankedFile(
  file: RankedFile,
  repoRoot: string,
  roots: string[],
): RankedFile {
  return {
    ...file,
    filePath: relativizePath(file.filePath, repoRoot),
    title: sanitizeText(file.title, roots),
    evidence: (file.evidence ?? []).map((e) =>
      redactEvidence(e, repoRoot, roots),
    ),
  };
}

function redactTrace(
  step: TraceStep,
  roots: string[],
): TraceStep {
  return {
    ...step,
    command: sanitizeText(step.command, roots),
    summary: sanitizeText(step.summary, roots),
  };
}

function collectLeakSamples(blob: string): string[] {
  const samples: string[] = [];
  const secret = blob.match(SECRET_LEAK_RE);
  if (secret) samples.push(`secret-shaped:${secret[0].slice(0, 24)}…`);
  const abs = blob.match(ABS_PATH_LEAK_RE);
  if (abs) samples.push(`abs-path:${abs[0].slice(0, 48)}…`);
  return samples;
}

/**
 * Build a redacted org cassette from a LocalizationResult.
 * Fail-closed when redaction cannot be proven.
 */
export function buildRedactedCassette(
  report: LocalizationResult,
): OrgCassette {
  assertRecordableReport(report);

  const repoRoot = report.targetRepo || process.cwd();
  const roots = [repoRoot];
  if (report.snapshotPath) roots.push(report.snapshotPath);

  const rankedFiles = report.rankedFiles.map((f) =>
    redactRankedFile(f, repoRoot, roots),
  );
  const explorationTrace = (report.explorationTrace ?? []).map((t) =>
    redactTrace(t, roots),
  );
  const warnings = (report.warnings ?? []).map((w) => sanitizeText(w, roots));

  const cassette: OrgCassette = {
    schemaVersion: ORG_CASSETTE_SCHEMA,
    redacted: true,
    recordedAt: new Date().toISOString(),
    sourceMode: report.mode as CassetteSourceMode,
    advisory: {
      kind: report.advisory.kind,
      id: report.advisory.id,
      cweId: report.advisory.cweId,
      ...(report.advisory.title
        ? { title: sanitizeText(report.advisory.title, roots) }
        : {}),
    },
    targetRepo: "<repo>",
    model: sanitizeText(report.model || "unknown", roots),
    rankedFiles,
    explorationTrace,
    warnings: [
      ...warnings,
      "Org cassette (Keyless K3): redacted recording for CI regression — not mvp product fixtures.",
      "Replay via: zeroday locate --recording <cassette.json>",
      HUMAN_REVIEW_NOTE,
    ],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: rankedFiles.length,
      incompleteReason: null,
      incompleteClass: null,
      terminalCallBudget: report.summary?.terminalCallBudget ?? 0,
      terminalCallsUsed: report.summary?.terminalCallsUsed ?? 0,
    },
    humanReviewNote: HUMAN_REVIEW_NOTE,
  };

  // Fail-closed leak scan on the serialized cassette
  const blob = JSON.stringify(cassette);
  const leaks = collectLeakSamples(blob);
  if (leaks.length > 0) {
    throw new RecordRefuseError(
      `record refused: redaction fail-closed — residual leaks detected (${leaks.join(", ")}). ` +
        `Cassette was not written. Fix the source report or sanitize manually, then retry.`,
    );
  }

  // Ranked file paths must be relative (no leading / or drive letter)
  for (const f of rankedFiles) {
    if (path.isAbsolute(f.filePath) || /^[A-Za-z]:[\\/]/.test(f.filePath)) {
      throw new RecordRefuseError(
        `record refused: ranked file still absolute after redaction: ${f.filePath}`,
      );
    }
    for (const e of f.evidence ?? []) {
      if (path.isAbsolute(e.filePath) || /^[A-Za-z]:[\\/]/.test(e.filePath)) {
        throw new RecordRefuseError(
          `record refused: evidence path still absolute after redaction: ${e.filePath}`,
        );
      }
    }
  }

  return cassette;
}
