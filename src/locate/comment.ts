/**
 * Reviewable PR comment for CI — localization only, human in the loop.
 */

import type { LocalizationResult } from "./types";

export function toPullRequestComment(result: LocalizationResult): string {
  const lines: string[] = [];
  lines.push("## ZERODAY Antares localization (CI)");
  lines.push("");
  lines.push(
    "> **Human review required.** File-level localization candidates — **not** proof of exploitability. " +
      "No auto-merge. No exploits, PoCs, or payloads.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  const modeNote =
    result.mode === "fixture"
      ? "fixture CI / no-GPU — recorded localization, not live weights"
      : result.mode === "live"
        ? "live Antares — local completions endpoint"
        : "keyless agent operator";
  lines.push(
    `| Advisory | \`${result.advisory.id}\` → \`${result.advisory.cweId}\` |`,
  );
  lines.push(`| Mode | \`${result.mode}\` (${modeNote}) |`);
  lines.push(`| Model | \`${result.model}\` |`);
  lines.push(
    `| Findings | **${result.summary.findingCount}** ranked file(s) |`,
  );
  lines.push(
    `| Incomplete | ${result.summary.incompleteReason ?? "no"} |`,
  );
  lines.push("");

  if (result.rankedFiles.length === 0) {
    lines.push("### Result");
    lines.push("");
    if (result.summary.incompleteReason) {
      lines.push(
        "**Incomplete localization** — Antares did not submit vulnerable files " +
          "(and did not call `submit_no_vulnerability_found`).",
      );
      lines.push("");
      if (result.summary.incompleteClass) {
        lines.push(`- **Class:** \`${result.summary.incompleteClass}\``);
      }
      lines.push(`> ${result.summary.incompleteReason}`);
      lines.push("");
      const tips = result.summary.incompleteTips?.length
        ? result.summary.incompleteTips
        : [
            "check completions health",
            "Mac MPS → float32 completions server (scripts/completions_server.py)",
            "raise --tool-budget",
          ];
      lines.push(
        "_Do not treat this as a clean negative. Tips: " +
          tips.join("; ") +
          "._",
      );
      lines.push("");
    } else {
      lines.push(
        "No vulnerable files submitted (`submit_no_vulnerability_found`).",
      );
      lines.push("");
    }
  } else {
    lines.push("### Ranked candidate files");
    lines.push("");
    for (const f of result.rankedFiles) {
      const cwes = (f.cweIds.length ? f.cweIds : [result.advisory.cweId]).join(
        ", ",
      );
      lines.push(`#### ${f.rank}. \`${f.filePath}\``);
      lines.push("");
      lines.push(`- **Title:** ${f.title}`);
      lines.push(`- **CWEs:** ${cwes}`);
      for (const e of f.evidence) {
        const loc =
          e.startLine != null
            ? `:${e.startLine}${e.endLine != null ? `-${e.endLine}` : ""}`
            : "";
        lines.push(`- **Evidence:** \`${e.filePath}${loc}\` — ${e.note}`);
      }
      lines.push("");
    }
  }

  if (result.explorationTrace.length) {
    lines.push("<details>");
    lines.push(
      `<summary>Exploration trace (${result.explorationTrace.length} steps)</summary>`,
    );
    lines.push("");
    for (const step of result.explorationTrace) {
      lines.push(
        `${step.step}. **${step.tool}** \`${step.command}\` — ${step.summary}`,
      );
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push("### Posture");
  lines.push("");
  lines.push("- Localization only · not exploitability proof");
  lines.push("- SARIF uploaded at **note** severity (GitHub Code Scanning)");
  lines.push(
    "- Foundry Detector-lane **candidate** — true-positive waits for human triage",
  );
  lines.push(
    "- Sister pieces: Foundry Security Spec · CodeGuard (compose, don’t replace)",
  );
  lines.push("");
  lines.push(
    "_Powered by [ZERODAY](https://github.com/pandeyaby/ZERODAY) around Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/)._",
  );
  lines.push("");
  return lines.join("\n");
}
