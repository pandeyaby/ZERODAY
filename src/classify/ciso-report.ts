/**
 * CISO markdown one-pager from the classification rollup.
 */

import type { CisoObject } from "./types";

export function toCisoMarkdown(ciso: CisoObject): string {
  const lines: string[] = [];
  lines.push(`# ZERODAY CISO rollup`);
  lines.push(``);
  lines.push(
    `> **Human review required.** Fixture-driven classifier output — **not** a production SOC, ` +
      `**not** proof of exploitability, **not** proof of a live adversary, **not** live agent-misfire detection.`,
  );
  lines.push(``);
  lines.push(`| | |`);
  lines.push(`|--|--|`);
  lines.push(`| Classification | \`${ciso.classification}\` |`);
  lines.push(`| Finding class | \`${ciso.finding_class}\` |`);
  lines.push(
    `| East-west suspected (telemetry input) | ${ciso.east_west_suspected ? "yes — review as possible_breach / needs_human" : "no"} |`,
  );
  lines.push(`| Confidence (rule heuristic) | ${ciso.confidence} |`);
  lines.push(`| Needs human | **yes** (always) |`);
  lines.push(`| Generated | ${ciso.generatedAt} |`);
  if (ciso.inputs.advisoryId) {
    lines.push(
      `| Advisory | \`${ciso.inputs.advisoryId}\`${ciso.inputs.cweId ? ` → \`${ciso.inputs.cweId}\`` : ""} |`,
    );
  }
  lines.push(``);
  lines.push(`## Signals observed`);
  lines.push(``);
  lines.push(`| Signal | Present |`);
  lines.push(`|--------|---------|`);
  lines.push(`| software_defect | ${ciso.signals.softwareDefect ? "yes" : "no"} |`);
  lines.push(`| possible_breach | ${ciso.signals.possibleBreach ? "yes" : "no"} |`);
  lines.push(`| infra_failure | ${ciso.signals.infraFailure ? "yes" : "no"} |`);
  lines.push(`| agent_misfire | ${ciso.signals.agentMisfire ? "yes" : "no"} |`);
  lines.push(``);
  lines.push(`## Rationale`);
  lines.push(``);
  for (const r of ciso.rationale) {
    lines.push(`- ${r}`);
  }
  lines.push(``);
  lines.push(`## Evidence pointers`);
  lines.push(``);
  if (ciso.evidence.length === 0) {
    lines.push(`_No evidence pointers._`);
  } else {
    for (const e of ciso.evidence) {
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
  lines.push(``);
  lines.push(`## Next human action`);
  lines.push(``);
  lines.push(ciso.next_human_action);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(
    `_Context: in an agentic era, when something goes wrong, code and telemetry must stay together for a human to decide ` +
      `breach vs infra vs software vs a legitimate agent with bad judgment. ZERODAY emits a **candidate** label from local ` +
      `Antares localization + optional telemetry fixtures — it does not watch the live network._`,
  );
  lines.push(``);
  return lines.join("\n");
}
