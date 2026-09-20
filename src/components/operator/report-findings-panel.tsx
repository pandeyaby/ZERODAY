"use client";

import { Badge } from "@/components/ui/badge";
import {
  findingsViewFromReport,
  REPORT_FINDINGS_NON_CLAIM,
  type ReportFindingView,
} from "@/desk/report-findings-view";
import { ShieldAlert } from "lucide-react";

export type ReportFindingsPanelProps = {
  /** Last successful zeroday.report/v1 (or Desk envelope) response. */
  report: unknown;
  /** Optional className for the outer panel. */
  className?: string;
};

/**
 * Ranked findings panel for Desk Prove-doors after Generate report.
 * Presentational only — displays findings[] from the report response.
 * Localization ≠ exploitability; does not invent rows or start RunPod.
 */
export function ReportFindingsPanel({
  report,
  className,
}: ReportFindingsPanelProps) {
  const view = findingsViewFromReport(report);
  const runpod =
    report &&
    typeof report === "object" &&
    report !== null &&
    "runpod" in report
      ? (report as { runpod?: unknown }).runpod
      : undefined;

  return (
    <div
      className={className ?? "mb-3"}
      data-testid="prove-doors-report-findings-panel"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
          Ranked findings
        </span>
        <Badge tone="muted">
          {view.findings.length} listed
        </Badge>
        <Badge tone="muted">
          runpod: {String(runpod ?? false)}
        </Badge>
        <Badge tone="warn">localization only</Badge>
      </div>

      {view.findings.length > 0 ? (
        <ol
          className="space-y-2 mb-3"
          data-testid="prove-doors-report-findings"
        >
          {view.findings.map((f, i) => (
            <FindingRow key={`${f.path}-${i}`} finding={f} index={i} />
          ))}
        </ol>
      ) : (
        <p
          className="text-[11px] text-[var(--muted)] mb-3"
          data-testid="prove-doors-report-findings-empty"
          role="status"
        >
          {view.emptyMessage ??
            "No ranked files in inputs — empty is not a clean claim."}
        </p>
      )}

      <div
        className="flex gap-2 items-start rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-2"
        data-testid="prove-doors-report-findings-non-claim"
      >
        <ShieldAlert
          className="text-[var(--warn)] shrink-0 mt-0.5"
          size={14}
          aria-hidden
        />
        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          {REPORT_FINDINGS_NON_CLAIM}
        </p>
      </div>
    </div>
  );
}

function FindingRow({
  finding,
  index,
}: {
  finding: ReportFindingView;
  index: number;
}) {
  const rankLabel =
    typeof finding.rank === "number" ? `#${finding.rank}` : `#${index + 1}`;

  return (
    <li
      className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-2"
      data-testid="prove-doors-report-finding-row"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11px] font-mono text-[var(--accent)] shrink-0">
          {rankLabel}
        </span>
        <code className="text-[12px] font-mono text-[var(--text)]/90 break-all">
          {finding.path}
        </code>
        {typeof finding.score === "number" ? (
          <Badge tone="muted">score: {finding.score}</Badge>
        ) : null}
        {finding.cweIds?.length ? (
          <Badge tone="muted">{finding.cweIds.join(", ")}</Badge>
        ) : null}
        {finding.source ? (
          <Badge tone="muted">{finding.source}</Badge>
        ) : null}
      </div>
      {finding.evidenceSnippet ? (
        <p
          className="mt-1 text-[11px] font-mono text-[var(--muted)] leading-relaxed"
          data-testid="prove-doors-report-finding-evidence"
        >
          {finding.evidenceSnippet}
        </p>
      ) : null}
    </li>
  );
}
