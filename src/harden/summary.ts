/**
 * Desk slice C — stranger-readable harden.md + README.
 */

import type { HardenCategory, HardenReport } from "./types";

function categoryLine(counts: Record<HardenCategory, number>): string {
  return (
    `agent-harness **${counts["agent-harness"]}** · ` +
    `package-scripts **${counts["package-scripts"]}** · ` +
    `secrets-hygiene **${counts["secrets-hygiene"]}** · ` +
    `config-surface **${counts["config-surface"]}**`
  );
}

export function toHardenMarkdown(report: HardenReport): string {
  const lines: string[] = [];
  lines.push("# ZERODAY Desk C — agent/package harden");
  lines.push("");
  lines.push(
    "> Recommend-only hardening from Desk B inventory + Desk A packet evidence. " +
      "**No auto-apply · no auto-PR · no auto-merge.** Localization + evidence + harden notes only. " +
      "**No PoC / exploit / payload.** Secret *values* redacted; patterns/names only.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Generated | ${report.generatedAt} |`);
  lines.push(`| Schema | \`${report.schemaVersion}\` |`);
  lines.push(`| Desk | **C** (agent/package harden) |`);
  lines.push(`| Recommendations | **${report.recommendations.length}** |`);
  lines.push(`| Categories | ${categoryLine(report.categoryCounts)} |`);
  lines.push(
    `| Draft notes | ${report.draftNotes.length > 0 ? `**${report.draftNotes.length}** (human-gated)` : "none (default recommend-only)"} |`,
  );
  lines.push(
    "| Posture | recommendations only · needs human · no auto-apply · no auto-PR · no auto-merge |",
  );
  lines.push("");

  lines.push("## Source (Desk B / Desk A — not re-scanned)");
  lines.push("");
  lines.push("| Artifact | Path |");
  lines.push("|----------|------|");
  lines.push(`| Reports dir | \`${report.source.reportsDir}\` |`);
  lines.push(
    `| Inventory JSON | \`${report.source.inventoryJson ?? "—"}\` |`,
  );
  lines.push(`| Packet JSON | \`${report.source.packetJson ?? "—"}\` |`);
  lines.push(
    `| Findings JSON | \`${report.source.findingsJson ?? "—"}\` |`,
  );
  lines.push(`| Case note | \`${report.source.caseNote ?? "—"}\` |`);
  for (const s of report.source.sarifPaths) {
    lines.push(`| SARIF | \`${s}\` |`);
  }
  if (report.source.sarifPaths.length === 0) {
    lines.push("| SARIF | — |");
  }
  lines.push("");

  lines.push("## Categories (evidence-backed only)");
  lines.push("");
  lines.push(
    "Recommendations are emitted **only** when inventory/packet finding kinds map clearly. " +
      "Unmapped kinds are skipped — **no guessing**.",
  );
  lines.push("");
  lines.push("| Category | Evidence kinds |");
  lines.push("|----------|----------------|");
  lines.push("| `agent-harness` | `agent_harness` |");
  lines.push("| `package-scripts` | `dependency_harness` (install/lifecycle scripts) |");
  lines.push("| `secrets-hygiene` | `ci_secret_pattern` · `env_example_honesty` |");
  lines.push("| `config-surface` | `config_surface` (already localized) |");
  lines.push("");

  lines.push("## Recommendations");
  lines.push("");
  if (report.recommendations.length === 0) {
    lines.push("_No harden recommendations (empty source or no mapped kinds)._");
  } else {
    lines.push(
      "| Priority | Category | Repo | Path | Pattern | Title |",
    );
    lines.push(
      "|----------|----------|------|------|---------|-------|",
    );
    for (const r of report.recommendations.slice(0, 120)) {
      lines.push(
        `| ${r.priority} | \`${r.category}\` | \`${r.evidence.repoId ?? "—"}\` | \`${r.evidence.path}\` | \`${r.evidence.pattern ?? "—"}\` | ${r.title.replace(/\|/g, "/")} |`,
      );
    }
    if (report.recommendations.length > 120) {
      lines.push("");
      lines.push(
        `_…and ${report.recommendations.length - 120} more (see harden.json)._`,
      );
    }
    lines.push("");
    lines.push("### Detail (top priorities)");
    lines.push("");
    const detail = report.recommendations
      .filter((r) => r.priority === "high" || r.priority === "medium")
      .slice(0, 24);
    if (detail.length === 0) {
      lines.push("_No high/medium items — see full table / JSON._");
    } else {
      for (const r of detail) {
        lines.push(`#### ${r.title}`);
        lines.push("");
        lines.push(
          `- Evidence: \`${r.evidence.findingId}\` · kind \`${r.evidence.kind}\``,
        );
        lines.push(`- ${r.recommendation}`);
        lines.push("");
      }
    }
  }

  if (report.draftNotes.length > 0) {
    lines.push("## Draft notes (human-gated)");
    lines.push("");
    lines.push(
      "Emitted only with `--draft`. CodeGuard-aligned **notes** — still not auto-applied.",
    );
    lines.push("");
    for (const d of report.draftNotes.slice(0, 40)) {
      lines.push(`- [\`${d.relativePath}\`](${d.relativePath}) — ${d.title}`);
    }
    if (report.draftNotes.length > 40) {
      lines.push(`- _…and ${report.draftNotes.length - 40} more under \`drafts/\`_`);
    }
    lines.push("");
  }

  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Recommendations only by default (`harden.md` + `harden.json`)");
  lines.push("- Optional `--draft` notes remain human-gated");
  lines.push("- **No** auto-apply · **no** auto-PR · **no** auto-merge");
  lines.push("- No PoC / exploit / payload (localization only — not exploitability proof)");
  lines.push("- Does not re-scan live private clones unless `--from` points at local paths");
  lines.push("- Consumes Desk B + Desk A outputs only");
  lines.push("- `npm run mvp` / `inventory` / `packet` unchanged");
  lines.push("");
  lines.push(
    `_Compose with [Project CodeGuard](https://project-codeguard.org/) — do not replace it._`,
  );
  lines.push("");
  return lines.join("\n");
}

export function toHardenReadme(): string {
  return [
    "# ZERODAY harden recommendations (Desk C)",
    "",
    "Recommend-only agent/package hardening from Desk B inventory + Desk A packet evidence.",
    "",
    "## One command",
    "",
    "```bash",
    "npm run zeroday -- harden",
    "npm run zeroday -- harden --from zeroday-reports/security-packet",
    "# fixture smoke:",
    "npm run zeroday -- harden --fixture",
    "# optional CodeGuard-aligned draft notes (still human-gated):",
    "npm run zeroday -- harden --draft",
    "```",
    "",
    "## Contents",
    "",
    "| File | Role |",
    "|------|------|",
    "| `harden.md` | Stranger-readable recommendations |",
    "| `harden.json` | Machine-readable manifest (`zeroday-harden-recommendations/v1`) |",
    "| `drafts/*.md` | Optional `--draft` CodeGuard-aligned notes |",
    "| `README.md` | This file |",
    "",
    "## Hard limits",
    "",
    "- Recommend-only — **no** auto-apply / auto-PR / auto-merge",
    "- No PoC / exploit / payload (Desk ≠ vuln discovery)",
    "- Secrets redacted (names/patterns only)",
    "- Fixtures via `--fixture` / `npm run mvp` only",
    "",
  ].join("\n");
}
