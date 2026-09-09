/**
 * CISO one-pager — what was asked, what files, confidence limits, next human action.
 * Not a wall of JSON. Material claims cite evidence IDs when provided.
 */

import type { LocalizationResult } from "./types";
import { ANTARES_1B_FILE_F1 } from "./findings";
import { categoryForCwe } from "./categories";
import { formatEvidenceCitation } from "../evidence/findings";

export interface HumanReportOptions {
  /** Evidence vault claim ids — every ranked-file row cites these when present */
  evidenceClaimIds?: string[];
}

export function toHumanReport(
  result: LocalizationResult,
  opts: HumanReportOptions = {},
): string {
  const category = categoryForCwe(result.advisory.cweId);
  const lines: string[] = [];
  const claimIds = opts.evidenceClaimIds || [];

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
    if (result.summary.incompleteReason) {
      lines.push(`### Incomplete localization (no submission)`);
      lines.push(``);
      lines.push(
        `> **Antares did not call \`submit_vulnerable_files\` (or \`submit_no_vulnerability_found\`).** ` +
          `This is **not** a clean negative and **not** proof that the repo is safe. ` +
          `ZERODAY will not invent findings.`,
      );
      lines.push(``);
      lines.push(`**Reason:** ${result.summary.incompleteReason}`);
      if (result.summary.incompleteClass) {
        lines.push(`**Class:** \`${result.summary.incompleteClass}\``);
      }
      if (result.summary.recoveryAttempted) {
        lines.push(
          `**Recovery:** best-effort re-query with raised \`--tool-budget\` was attempted (not guaranteed).`,
        );
      }
      lines.push(``);
      lines.push(`**Operator tips:**`);
      lines.push(``);
      const tips =
        result.summary.incompleteTips && result.summary.incompleteTips.length
          ? result.summary.incompleteTips
          : [
              "Confirm the completions server is healthy (`GET /v1/models`, `POST /v1/completions`).",
              "On Mac MPS, float16 produces NaN logits — use float32 via `scripts/completions_server.py` (greedy is a false fix; prefer vLLM on CUDA).",
              "Increase exploration budget: `zeroday locate … --tool-budget 45` (Antares `--tool-budget`, range 1–50).",
              "Re-run live locate; still incomplete → human review of the exploration trace below.",
            ];
      tips.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
      lines.push(``);
    } else {
      lines.push(
        `_No vulnerable files submitted (\`submit_no_vulnerability_found\`)._`,
      );
      lines.push(``);
    }
  } else {
    lines.push(`| Rank | File | CWEs | Evidence | Citation |`);
    lines.push(`|------|------|------|----------|----------|`);
    for (let i = 0; i < result.rankedFiles.length; i++) {
      const f = result.rankedFiles[i];
      const cwes = (f.cweIds.length ? f.cweIds : [result.advisory.cweId]).join(
        ", ",
      );
      const note = f.evidence.map((e) => e.note).join("; ").replace(/\|/g, "/");
      const cite = claimIds[i]
        ? formatEvidenceCitation([claimIds[i]])
        : claimIds.length
          ? formatEvidenceCitation(claimIds)
          : "_see evidence vault_";
      lines.push(
        `| ${f.rank} | \`${f.filePath}\` | ${cwes} | ${note.slice(0, 120)} | ${cite} |`,
      );
    }
    lines.push(``);
  }

  if (claimIds.length) {
    lines.push(`## Evidence citations`);
    lines.push(``);
    lines.push(
      `Material claims above cite vault ids: ${formatEvidenceCitation(claimIds)}. ` +
        `Verify offline with \`zeroday verify --from <run-dir>\`.`,
    );
    lines.push(``);
  }

  lines.push(`## Confidence & limits`);
  lines.push(``);
  if (result.mode === "agent") {
    lines.push(
      `- **Keyless agent operator** — confidence labels come from the coding-agent submission, not a vendor score.`,
    );
    lines.push(
      `- Optional live Antares (when hosted locally) publishes File F1 **${ANTARES_1B_FILE_F1}** on the public benchmark — **not** a per-finding score. Antares CLI expects vLLM **0.19.1+** completions; ZERODAY does not claim independent vLLM validation.`,
    );
  } else {
    lines.push(
      `- Public **Antares-1B** File F1 is **${ANTARES_1B_FILE_F1}** (localization quality on the published benchmark — **not** a per-finding confidence score).`,
    );
    lines.push(
      `- Antares-350m File F1 is **0.135** (edge). We never claim Antares-3B.`,
    );
    lines.push(
      `- Antares CLI expects vLLM **0.19.1+** completions-only; ZERODAY does not claim independent “validated with vLLM 0.19.1” proof.`,
    );
  }
  lines.push(
    `- Findings are **notes** for human review (SARIF severity \`note\` / informational exporters).`,
  );
  lines.push(
    `- Terminal budget: ${result.summary.terminalCallsUsed} / ${result.summary.terminalCallBudget} exploration calls.`,
  );
  if (result.summary.incompleteReason) {
    lines.push(`- **Incomplete:** ${result.summary.incompleteReason}`);
  }
  lines.push(``);

  lines.push(`## Next human action`);
  lines.push(``);
  if (result.summary.incompleteReason && result.rankedFiles.length === 0) {
    lines.push(
      `1. Treat this run as **incomplete** — do not close the advisory as clean.`,
    );
    lines.push(
      `2. Fix server health / Mac MPS float32 completions server / raise \`--tool-budget\`, then re-run live locate.`,
    );
    lines.push(
      `3. Only after a complete submission (ranked files **or** explicit \`submit_no_vulnerability_found\`) triage candidates.`,
    );
    lines.push(`4. Open a normal reviewable PR — **never** auto-merge from ZERODAY.`);
  } else {
    lines.push(`1. Open the ranked files and confirm or dismiss each candidate.`);
    lines.push(
      `2. If a fix is warranted, run \`zeroday draft-fix --i-asked-for-a-fix\` (CodeGuard-aligned **DRAFT** only).`,
    );
    lines.push(`3. Open a normal reviewable PR — **never** auto-merge from ZERODAY.`);
    lines.push(
      `4. Optionally export for your SIEM/SOAR desk: \`zeroday export --format asff|splunk|xsoar|fortisiem|crowdstrike|sarif\`.`,
    );
  }
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
