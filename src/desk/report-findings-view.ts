/**
 * Presentational helpers for Desk ranked-findings panel.
 *
 * Reads `findings[]` from existing zeroday.report/v1 JSON only —
 * does not re-rank, invent scores, or claim exploitability.
 * Client-safe (no Node imports) for Prove doors "use client".
 */

/** Explicit non-claim shown with every findings panel. */
export const REPORT_FINDINGS_NON_CLAIM =
  "Localization ≠ exploitability — ranked files are candidates for human review only; not proof of exploitability." as const;

/** Max chars for the short evidence snippet (UI only; full evidence stays in JSON). */
export const REPORT_FINDINGS_EVIDENCE_SNIPPET_MAX = 140;

export type ReportFindingView = {
  path: string;
  rank?: number;
  score?: number;
  cweIds?: string[];
  /** Truncated first evidence line for UI display only. */
  evidenceSnippet?: string;
  /**
   * Exact first non-blank evidence string from report JSON (for Copy evidence).
   * Never invented; absent when evidence is blank/missing.
   */
  evidenceExact?: string;
  source?: string;
};

export type ReportFindingsViewResult = {
  /** True only when findings was a real array on the report (even if empty). */
  findingsPresent: boolean;
  findings: ReportFindingView[];
  /** Honest empty / fail-closed reason when there is nothing to list. */
  emptyMessage?: string;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Short evidence line from report finding.evidence[] — first string only.
 * Never invents content; returns undefined when absent.
 */
export function evidenceSnippetFromFinding(
  evidence: unknown,
  maxLen: number = REPORT_FINDINGS_EVIDENCE_SNIPPET_MAX,
): string | undefined {
  if (!Array.isArray(evidence) || evidence.length === 0) return undefined;
  const first = evidence.find((e) => typeof e === "string" && e.trim());
  if (typeof first !== "string") return undefined;
  const trimmed = first.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

/**
 * Path string for clipboard "Copy path" — exact report path only.
 * Fail-closed: missing/blank → null (do not invent a path).
 */
export function findingPathForClipboard(
  path: string | null | undefined,
): string | null {
  if (typeof path !== "string") return null;
  const trimmed = path.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Evidence string for clipboard "Copy evidence" — exact report text only.
 * Accepts finding.evidence[] (first non-blank string) or an already-extracted
 * string. Fail-closed: missing/blank → null (do not invent evidence).
 */
export function findingEvidenceForClipboard(
  evidence: unknown,
): string | null {
  if (typeof evidence === "string") {
    const trimmed = evidence.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const first = evidence.find((e) => typeof e === "string" && e.trim());
  if (typeof first !== "string") return null;
  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize one zeroday.report/v1 finding for display.
 * Fail-closed: missing/invalid path → null (do not invent a row).
 */
export function viewFromReportFinding(
  raw: unknown,
): ReportFindingView | null {
  if (!isPlainObject(raw)) return null;
  const path = findingPathForClipboard(
    typeof raw.path === "string" ? raw.path : null,
  );
  if (!path) return null;

  const view: ReportFindingView = { path };

  if (typeof raw.rank === "number" && Number.isFinite(raw.rank)) {
    view.rank = raw.rank;
  }
  if (typeof raw.score === "number" && Number.isFinite(raw.score)) {
    view.score = raw.score;
  }
  if (Array.isArray(raw.cweIds)) {
    const ids = raw.cweIds.filter(
      (c): c is string => typeof c === "string" && c.trim().length > 0,
    );
    if (ids.length) view.cweIds = ids;
  }
  if (typeof raw.source === "string" && raw.source.trim()) {
    view.source = raw.source.trim();
  }
  const exact = findingEvidenceForClipboard(raw.evidence);
  if (exact) {
    view.evidenceExact = exact;
    const snippet = evidenceSnippetFromFinding([exact]);
    if (snippet) view.evidenceSnippet = snippet;
  }

  return view;
}

/**
 * Build ranked findings view from a zeroday.report/v1 payload (or Desk envelope).
 * Does not re-sort or invent metrics — preserves report order after dropping invalids.
 */
export function findingsViewFromReport(
  report: unknown,
): ReportFindingsViewResult {
  if (!isPlainObject(report)) {
    return {
      findingsPresent: false,
      findings: [],
      emptyMessage: "No report payload — nothing to list (fail-closed).",
    };
  }

  if (!("findings" in report)) {
    return {
      findingsPresent: false,
      findings: [],
      emptyMessage:
        "Report has no findings field — empty is not a clean claim (fail-closed).",
    };
  }

  if (!Array.isArray(report.findings)) {
    return {
      findingsPresent: false,
      findings: [],
      emptyMessage:
        "Report findings is not an array — refusing to invent rows (fail-closed).",
    };
  }

  const findings = report.findings
    .map(viewFromReportFinding)
    .filter((f): f is ReportFindingView => f !== null);

  if (findings.length === 0) {
    return {
      findingsPresent: true,
      findings: [],
      emptyMessage:
        "No ranked files in inputs — empty is not a clean claim.",
    };
  }

  return { findingsPresent: true, findings };
}
