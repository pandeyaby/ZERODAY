/**
 * Desk slice E — stranger-readable classify.md + README.
 * Always states: classification ≠ exploitability.
 */

import type { ClassificationLabel, ClassifyEvidencePack } from "./types";
import { CLASSIFICATION_LABELS } from "./types";

function labelRow(active: ClassificationLabel): string {
  return CLASSIFICATION_LABELS.map(
    (l) => `| \`${l}\` | ${l === active ? "**yes**" : "no"} |`,
  ).join("\n");
}

export function toClassifyMarkdown(pack: ClassifyEvidencePack): string {
  const lines: string[] = [];
  lines.push("# ZERODAY Desk E — crash classify + evidence");
  lines.push("");
  lines.push(
    "> **Human review required.** Fixture-driven crash/incident classification for triage. " +
      "**Classification ≠ exploitability.** Not a production SOC · not proof of a live adversary · " +
      "**no auto-remediate · no auto-merge · no PoC.** Secret *values* redacted.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Generated | ${pack.generatedAt} |`);
  lines.push(`| Schema | \`${pack.schemaVersion}\` |`);
  lines.push(`| Desk | **E** (crash classify + evidence) |`);
  lines.push(`| Classification | \`${pack.classification}\` |`);
  lines.push(`| Finding class | \`${pack.finding_class}\` |`);
  lines.push(`| Confidence (rule heuristic) | ${pack.confidence} |`);
  lines.push(
    `| East-west suspected (telemetry input) | ${pack.east_west_suspected ? "yes — review carefully" : "no"} |`,
  );
  lines.push(`| Needs human | **yes** (always) |`);
  lines.push(
    "| Classification ≠ exploitability | **yes** (always) |",
  );
  lines.push(
    "| Posture | human review · no auto-remediate · no PoC · secrets redacted |",
  );
  lines.push("");

  lines.push("## Labels (exactly one)");
  lines.push("");
  lines.push(
    "Ambiguous or competing signals → **`needs_human`**. Never invent `possible_breach` from weak signals.",
  );
  lines.push("");
  lines.push("| Label | Selected |");
  lines.push("|-------|----------|");
  lines.push(labelRow(pack.classification));
  lines.push("");

  lines.push("## Source");
  lines.push("");
  lines.push("| Artifact | Path |");
  lines.push("|----------|------|");
  lines.push(`| From | \`${pack.source.from ?? "—"}\` |`);
  lines.push(`| Scenario | \`${pack.source.scenario ?? "—"}\` |`);
  lines.push(`| Locate report | \`${pack.source.locateReport ?? "—"}\` |`);
  lines.push(
    `| Telemetry fixture | \`${pack.source.telemetryFixture ?? "—"}\` |`,
  );
  if (pack.source.advisoryId) {
    lines.push(
      `| Advisory | \`${pack.source.advisoryId}\`${pack.source.cweId ? ` → \`${pack.source.cweId}\`` : ""} |`,
    );
  }
  lines.push("");

  lines.push("## Signals observed");
  lines.push("");
  lines.push("| Signal | Present |");
  lines.push("|--------|---------|");
  lines.push(
    `| software_defect | ${pack.signals.softwareDefect ? "yes" : "no"} |`,
  );
  lines.push(
    `| possible_breach | ${pack.signals.possibleBreach ? "yes" : "no"} |`,
  );
  lines.push(
    `| infra_failure | ${pack.signals.infraFailure ? "yes" : "no"} |`,
  );
  lines.push(
    `| agent_misfire | ${pack.signals.agentMisfire ? "yes" : "no"} |`,
  );
  lines.push("");

  lines.push("## Rationale");
  lines.push("");
  for (const r of pack.rationale) {
    lines.push(`- ${r}`);
  }
  lines.push("");

  lines.push("## Evidence pointers");
  lines.push("");
  if (pack.evidence.length === 0) {
    lines.push("_No evidence pointers._");
  } else {
    for (const e of pack.evidence) {
      if (e.kind === "locate_file") {
        lines.push(
          `- **file** \`${e.filePath}\`${e.cwe ? ` (${e.cwe})` : ""} — ${e.summary}`,
        );
      } else if (e.kind === "telemetry_event") {
        lines.push(`- **telemetry** \`${e.telemetryId}\` — ${e.summary}`);
      } else {
        lines.push(`- ${e.summary}`);
      }
    }
  }
  lines.push("");

  lines.push("## Next human action");
  lines.push("");
  lines.push(pack.next_human_action);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "_Desk E packages locate + optional telemetry fixtures into a candidate label for a human. " +
      "It does not watch the live network, simulate attacks, or auto-remediate. " +
      "**Classification is not exploitability.**_",
  );
  lines.push("");
  return lines.join("\n");
}

export function toClassifyReadme(): string {
  return `# ZERODAY classify evidence (Desk E)

Crash / incident classification from locate + optional telemetry fixtures.

## One command

\`\`\`bash
npm run zeroday -- classify --from fixtures/classify/software_defect
# or bare scenario / --fixture:
npm run zeroday -- classify --fixture
npm run zeroday -- classify --scenario needs_human
\`\`\`

## Contents

| File | Role |
|------|------|
| \`classify.md\` | Stranger-readable classification summary |
| \`classify.json\` | Machine-readable evidence pack (\`zeroday-classify-evidence/v1\`) |
| \`ciso.json\` / \`ciso.md\` | CISO rollup (same classifier; backward compatible) |
| \`README.md\` | This file |

## Labels

\`possible_breach\` | \`infra_failure\` | \`software_defect\` | \`agent_misfire\` | \`needs_human\`

Ambiguous → **\`needs_human\`**. Never invent breach from weak signals.

## Hard limits

- **Classification ≠ exploitability**
- Human review required — **no** auto-remediate / auto-merge
- No PoC / exploit / attack simulation
- Secrets redacted in snippets
- \`npm run mvp\` / \`inventory\` / \`packet\` / \`harden\` unchanged
`;
}
