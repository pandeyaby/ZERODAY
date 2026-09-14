/**
 * Desk D — stranger-readable craft.md + README.
 */

import type { CraftHabitStage, CraftReport } from "./types";
import { CRAFT_HABIT_STAGES } from "./types";

function stageCounts(
  report: CraftReport,
): Record<CraftHabitStage, number> {
  const counts = Object.fromEntries(
    CRAFT_HABIT_STAGES.map((s) => [s, 0]),
  ) as Record<CraftHabitStage, number>;
  for (const p of report.patterns) {
    counts[p.stage] += 1;
  }
  return counts;
}

export function toCraftMarkdown(report: CraftReport): string {
  const counts = stageCounts(report);
  const lines: string[] = [];
  lines.push("# ZERODAY Desk D — defensive plugins/skills craft");
  lines.push("");
  lines.push(
    "> Generate-only Cursor/Grok-style `SKILL.md` + plugin stub from Desk B→A→C→E patterns. " +
      "**No auto-install · no marketplace publish.** " +
      "Refuses exploits, PoCs, and offensive skill patterns. Localization habits only.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Generated | ${report.generatedAt} |`);
  lines.push(`| Schema | \`${report.schemaVersion}\` |`);
  lines.push(`| Desk | **D** (defensive plugins/skills craft) |`);
  lines.push(`| Name | \`${report.name}\` |`);
  lines.push(`| Kind | \`${report.kind}\` |`);
  lines.push(`| Patterns | **${report.patterns.length}** |`);
  lines.push(`| Scaffolds | **${report.scaffolds.length}** |`);
  lines.push(
    "| Posture | generate-only · no auto-install · no marketplace · refuses offensive · needs human |",
  );
  lines.push("");

  lines.push("## Source (Desk B→A→C→E — not re-scanned)");
  lines.push("");
  lines.push("| Artifact | Path |");
  lines.push("|----------|------|");
  lines.push(`| Reports dir | \`${report.source.reportsDir}\` |`);
  lines.push(
    `| Inventory JSON | \`${report.source.inventoryJson ?? "—"}\` |`,
  );
  lines.push(`| Packet JSON | \`${report.source.packetJson ?? "—"}\` |`);
  lines.push(`| Harden JSON | \`${report.source.hardenJson ?? "—"}\` |`);
  lines.push(
    `| Classify JSON | \`${report.source.classifyJson ?? "—"}\` |`,
  );
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

  lines.push("## Habit stages encoded");
  lines.push("");
  lines.push(
    "`inventory` → `locate` → `packet` → `harden` → `classify`",
  );
  lines.push("");
  lines.push("| Stage | Pattern signals |");
  lines.push("|-------|-----------------|");
  for (const stage of CRAFT_HABIT_STAGES) {
    lines.push(`| \`${stage}\` | **${counts[stage]}** |`);
  }
  lines.push("");

  lines.push("## Scaffolds");
  lines.push("");
  if (report.scaffolds.length === 0) {
    lines.push("_No scaffolds (unexpected)._");
  } else {
    lines.push("| Kind | Name | Path |");
    lines.push("|------|------|------|");
    for (const s of report.scaffolds) {
      lines.push(
        `| \`${s.kind}\` | \`${s.name}\` | [\`${s.relativePath}\`](${s.relativePath}) |`,
      );
    }
  }
  lines.push("");

  lines.push("## Pattern cues (sample)");
  lines.push("");
  for (const p of report.patterns.slice(0, 16)) {
    lines.push(`- **${p.stage}** — ${p.habit}`);
  }
  if (report.patterns.length > 16) {
    lines.push(`- _…and ${report.patterns.length - 16} more (see craft.json)._`);
  }
  lines.push("");

  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Generate-only (`craft.md` + `craft.json` + skill/plugin files)");
  lines.push("- **No** auto-install into Cursor / Grok Bot");
  lines.push("- **No** marketplace publish");
  lines.push("- Refuses exploits, PoCs, and offensive skill patterns");
  lines.push("- No PoC / exploit / payload (localization only)");
  lines.push("- Consumes Desk B→A→C→E reports; does not re-scan private clones");
  lines.push(
    "- `npm run mvp` / `inventory` / `packet` / `harden` / `classify` unchanged",
  );
  lines.push("");
  return lines.join("\n");
}

export function toCraftReadme(): string {
  return [
    "# ZERODAY defensive craft (Desk D)",
    "",
    "Generate-only Cursor/Grok-style `SKILL.md` + plugin stub from Desk B→A→C→E patterns.",
    "",
    "## One command",
    "",
    "```bash",
    "npm run zeroday -- craft",
    "npm run zeroday -- craft --from zeroday-reports",
    "# fixture smoke / aliases:",
    "npm run zeroday -- craft --fixture",
    "npm run zeroday -- skill --fixture",
    "npm run zeroday -- plugin --fixture",
    "```",
    "",
    "## Contents",
    "",
    "| File | Role |",
    "|------|------|",
    "| `craft.md` | Stranger-readable craft summary |",
    "| `craft.json` | Machine-readable manifest (`zeroday-craft-scaffold/v1`) |",
    "| `skills/*/SKILL.md` | Defensive skill scaffold |",
    "| `plugins/*/plugin.json` | Plugin stub (generate-only) |",
    "| `README.md` | This file |",
    "",
    "## Hard limits",
    "",
    "- Generate-only — **no** auto-install / marketplace publish",
    "- Refuses exploits, PoCs, and offensive skill patterns",
    "- No PoC / exploit / payload (Desk ≠ vuln discovery)",
    "- Fixtures via `--fixture` / `npm run mvp` only",
    "",
  ].join("\n");
}
