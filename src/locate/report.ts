/**
 * Human-readable localization report (CISO / analyst friendly).
 */

import type { LocalizationResult } from "./types";

export function toHumanReport(result: LocalizationResult): string {
  const lines: string[] = [];
  lines.push(`# ZERODAY Localization Report`);
  lines.push(``);
  lines.push(`**Advisory:** ${result.advisory.id} → ${result.advisory.cweId}`);
  if (result.advisory.title) {
    lines.push(`**Title:** ${result.advisory.title}`);
  }
  lines.push(`**Target:** \`${result.targetRepo}\``);
  lines.push(`**Mode:** ${result.mode}`);
  lines.push(`**Model:** ${result.model}`);
  lines.push(`**Generated:** ${result.generatedAt}`);
  lines.push(``);
  lines.push(`## Posture`);
  lines.push(``);
  lines.push(`- Localization only — ranked candidate files + evidence`);
  lines.push(`- Not proof of exploitability`);
  lines.push(`- Offensive demonstration code is out of scope`);
  lines.push(`- No auto-merge — human review required before any fix`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Findings | ${result.summary.findingCount} |`);
  lines.push(
    `| Terminal calls | ${result.summary.terminalCallsUsed} / ${result.summary.terminalCallBudget} |`,
  );
  lines.push(
    `| Incomplete | ${result.summary.incompleteReason ?? "no"} |`,
  );
  lines.push(``);

  if (result.warnings.length) {
    lines.push(`## Warnings`);
    lines.push(``);
    for (const w of result.warnings) {
      lines.push(`- ${w}`);
    }
    lines.push(``);
  }

  lines.push(`## Ranked candidate files`);
  lines.push(``);
  if (result.rankedFiles.length === 0) {
    lines.push(`_No vulnerable files submitted (\`submit_no_vulnerability_found\`)._`);
    lines.push(``);
  } else {
    for (const f of result.rankedFiles) {
      lines.push(`### ${f.rank}. \`${f.filePath}\``);
      lines.push(``);
      lines.push(`- **Title:** ${f.title}`);
      lines.push(`- **CWEs:** ${f.cweIds.join(", ") || result.advisory.cweId}`);
      if (f.likelihoodOfExploit) {
        lines.push(
          `- **MITRE likelihood_of_exploit (taxonomy, not confidence):** ${f.likelihoodOfExploit}`,
        );
      }
      lines.push(``);
      lines.push(`**Evidence**`);
      lines.push(``);
      for (const e of f.evidence) {
        const loc =
          e.startLine != null
            ? `:${e.startLine}${e.endLine != null ? `-${e.endLine}` : ""}`
            : "";
        lines.push(`- \`${e.filePath}${loc}\` — ${e.note}`);
        if (e.excerpt) {
          lines.push(``);
          lines.push("```");
          lines.push(e.excerpt.trimEnd());
          lines.push("```");
          lines.push(``);
        }
      }
    }
  }

  lines.push(`## Exploration trace`);
  lines.push(``);
  if (result.explorationTrace.length === 0) {
    lines.push(`_No trace steps recorded._`);
  } else {
    for (const step of result.explorationTrace) {
      lines.push(
        `${step.step}. **${step.tool}** \`${step.command}\` — ${step.summary}`,
      );
    }
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(
    `_Powered by Cisco Foundation AI Antares (localization). ZERODAY wraps the daily-driver UX around it._`,
  );
  lines.push(``);

  return lines.join("\n");
}
