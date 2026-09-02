/**
 * CISO one-pager — what was asked, what files, confidence limits, next human action.
 * Not a wall of JSON.
 */

import type { LocalizationResult } from "./types";
import { ANTARES_1B_FILE_F1 } from "./findings";
import { categoryForCwe } from "./categories";

export function toHumanReport(result: LocalizationResult): string {
  const category = categoryForCwe(result.advisory.cweId);
  const lines: string[] = [];

  lines.push(`# ZERODAY Localization — CISO one-pager`);
  lines.push(``);
  lines.push(
    `> **Detector-lane candidate(s).** True-positive waits for human triage. ` +
      `Localization is **not** proof of exploitability. No auto-merge.`,
  );
  lines.push(``);

  lines.push(`## What was asked`);
  lines.push(``);
  lines.push(`| | |`);
  lines.push(`|--|--|`);
  lines.push(`| Advisory | \`${result.advisory.id}\` → \`${result.advisory.cweId}\` |`);
  if (result.advisory.title) {
    lines.push(`| Title | ${result.advisory.title} |`);
  }
  lines.push(`| Category | ${category} |`);
  lines.push(`| Target | \`${result.targetRepo}\` |`);
  lines.push(`| Mode | ${result.mode} |`);
  lines.push(`| Model | \`${result.model}\` |`);
  lines.push(`| Generated | ${result.generatedAt} |`);
  lines.push(``);

  lines.push(`## What files`);
  lines.push(``);
  if (result.rankedFiles.length === 0) {
    lines.push(
      `_No vulnerable files submitted (\`submit_no_vulnerability_found\`)._`,
    );
    lines.push(``);
  } else {
    lines.push(`| Rank | File | CWEs | Evidence |`);
    lines.push(`|------|------|------|----------|`);
    for (const f of result.rankedFiles) {
      const cwes = (f.cweIds.length ? f.cweIds : [result.advisory.cweId]).join(
        ", ",
      );
      const note = f.evidence.map((e) => e.note).join("; ").replace(/\|/g, "/");
      lines.push(
        `| ${f.rank} | \`${f.filePath}\` | ${cwes} | ${note.slice(0, 160)} |`,
      );
    }
    lines.push(``);
  }

  lines.push(`## Confidence & limits`);
  lines.push(``);
  lines.push(
    `- Public **Antares-1B** File F1 is **${ANTARES_1B_FILE_F1}** (localization quality on the published benchmark — **not** a per-finding confidence score).`,
  );
  lines.push(
    `- Antares-350m File F1 is **0.135** (edge). We never claim Antares-3B.`,
  );
  lines.push(
    `- Findings are **notes** for human review (SARIF severity \`note\` / informational exporters).`,
  );
  lines.push(
    `- Terminal budget: ${result.summary.terminalCallsUsed} / ${result.summary.terminalCallBudget} exploration calls.`,
  );
  if (result.summary.incompleteReason) {
    lines.push(`- Incomplete: ${result.summary.incompleteReason}`);
  }
  lines.push(``);

  lines.push(`## Next human action`);
  lines.push(``);
  lines.push(`1. Open the ranked files and confirm or dismiss each candidate.`);
  lines.push(
    `2. If a fix is warranted, run \`zeroday draft-fix --i-asked-for-a-fix\` (CodeGuard-aligned **DRAFT** only).`,
  );
  lines.push(`3. Open a normal reviewable PR — **never** auto-merge from ZERODAY.`);
  lines.push(
    `4. Optionally export for your SIEM/SOAR desk: \`zeroday export --format asff|splunk|xsoar|fortisiem|crowdstrike|sarif\`.`,
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

  lines.push(`## Exploration trace (analyst detail)`);
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
    `_Compose with [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) (Detector-lane candidates) and [Project CodeGuard](https://project-codeguard.org/) — do not replace them. ` +
      `Powered by Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/) localization._`,
  );
  lines.push(``);

  return lines.join("\n");
}
