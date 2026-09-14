/**
 * Desk slice A — stranger-readable security packet summary.
 */

import { redactInventoryText } from "../factory/inventory-evidence";
import type { PacketClassification, SecurityPacket } from "./types";

function countLine(counts: Record<PacketClassification, number>): string {
  return (
    `agent-misfire **${counts["agent-misfire"]}** · ` +
    `config **${counts.config}** · ` +
    `dependency **${counts.dependency}** · ` +
    `unknown **${counts.unknown}**`
  );
}

export function toPacketSummary(packet: SecurityPacket): string {
  const lines: string[] = [];
  lines.push("# ZERODAY Desk A — security packet");
  lines.push("");
  lines.push(
    "> Offline security packet for sharing localization findings with a security team. " +
      "**Generate only — no auto-post** to Slack / GitHub / email. " +
      "Localization + evidence + harden notes only. **No PoC / exploit / payload.** " +
      "Secret *values* redacted; patterns/names only.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Generated | ${packet.generatedAt} |`);
  lines.push(`| Schema | \`${packet.schemaVersion}\` |`);
  lines.push(`| Desk | **A** (security packet) |`);
  lines.push(`| Findings | **${packet.findings.length}** |`);
  lines.push(`| Labels | ${countLine(packet.classificationCounts)} |`);
  lines.push(
    "| Posture | localize + evidence + harden · needs human · no auto-merge · no auto-send |",
  );
  lines.push("");

  lines.push("## Source (Desk B inventory — not reinvented)");
  lines.push("");
  lines.push("| Artifact | Path |");
  lines.push("|----------|------|");
  lines.push(
    `| Reports dir | \`${packet.source.reportsDir}\` |`,
  );
  lines.push(
    `| Inventory JSON | \`${packet.source.inventoryJson ?? "—"}\` |`,
  );
  lines.push(
    `| Case note | \`${packet.source.caseNote ?? "—"}\` |`,
  );
  for (const s of packet.source.sarifPaths) {
    lines.push(`| SARIF | \`${s}\` |`);
  }
  if (packet.source.sarifPaths.length === 0) {
    lines.push("| SARIF | — |");
  }
  lines.push("");

  lines.push("## Classification (evidence-backed only)");
  lines.push("");
  lines.push(
    "Labels are assigned **only** when inventory finding kind maps clearly. " +
      "Otherwise `unknown` — **no guessing**.",
  );
  lines.push("");
  lines.push("| Label | When |");
  lines.push("|-------|------|");
  lines.push(
    "| `agent-misfire` | Inventory `agent_harness` (agent/skill exec or fetch hint) |",
  );
  lines.push(
    "| `config` | Inventory `ci_secret_pattern` or `env_example_honesty` |",
  );
  lines.push(
    "| `dependency` | Inventory `dependency_harness` |",
  );
  lines.push(
    "| `unknown` | No evidence-backed mapping |",
  );
  lines.push("");

  lines.push("## Findings list");
  lines.push("");
  if (packet.findings.length === 0) {
    lines.push("_No packet findings (empty inventory or surfaces-only)._");
  } else {
    lines.push(
      "| Classification | Severity | Kind | Repo | Path | Pattern |",
    );
    lines.push(
      "|----------------|----------|------|------|------|---------|",
    );
    for (const f of packet.findings.slice(0, 100)) {
      lines.push(
        `| \`${f.classification}\` | ${f.severity} | \`${f.kind}\` | \`${f.repoId ?? "—"}\` | \`${f.path}\` | \`${f.pattern ?? "—"}\` |`,
      );
    }
    if (packet.findings.length > 100) {
      lines.push("");
      lines.push(
        `_… ${packet.findings.length - 100} more (see findings.json)._`,
      );
    }
  }
  lines.push("");

  lines.push("## Placeholders (fill before sharing)");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| Module / product link | ${packet.placeholders.moduleLink} |`);
  lines.push(`| PR link | ${packet.placeholders.prLink} |`);
  lines.push(`| Ticket link | ${packet.placeholders.ticketLink} |`);
  lines.push("");

  lines.push("## Next human action");
  lines.push("");
  lines.push(
    "1. Review each finding label; change `unknown` only with new evidence.",
  );
  lines.push(
    "2. Fill module / PR / ticket placeholders before sending to security.",
  );
  lines.push(
    "3. Share the packet directory (or zip) **manually** — ZERODAY does not auto-send.",
  );
  lines.push(
    "4. Treat as localization evidence, not exploitability proof. Never auto-merge.",
  );
  lines.push("");

  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Localization + evidence + harden notes only");
  lines.push("- No PoC / exploit / payload (localization only — not exploitability proof)");
  lines.push("- No Slack / GitHub / email auto-post");
  lines.push("- No live Antares / RunPod spend on this desk");
  lines.push("- Never exfiltrate source; redact secrets in exports");
  lines.push("- `npm run mvp` remains the stranger door");
  lines.push("");

  return redactInventoryText(lines.join("\n"));
}

export function toFindingsMarkdown(packet: SecurityPacket): string {
  const lines: string[] = [];
  lines.push("# Security packet findings");
  lines.push("");
  lines.push(
    "> Desk A · evidence-backed labels only · secrets redacted · no PoC",
  );
  lines.push("");
  lines.push(
    "| Id | Classification | Basis | Severity | Repo | Path | Pattern | Title |",
  );
  lines.push(
    "|----|----------------|-------|----------|------|------|---------|-------|",
  );
  for (const f of packet.findings) {
    lines.push(
      `| \`${f.id}\` | \`${f.classification}\` | ${f.classificationBasis} | ${f.severity} | \`${f.repoId ?? "—"}\` | \`${f.path}\` | \`${f.pattern ?? "—"}\` | ${f.title} |`,
    );
  }
  lines.push("");
  return redactInventoryText(lines.join("\n"));
}

export function toPacketReadme(): string {
  return `# ZERODAY security packet (Desk A)

Offline packet for sharing inventory localization findings with a security team.

## One command

\`\`\`bash
npm run zeroday -- packet --from docs/reports
# or after inventory:
npm run zeroday -- packet --from zeroday-reports/desk-b-inventory
\`\`\`

## Contents

| File | Role |
|------|------|
| \`summary.md\` | Stranger-readable rollup |
| \`findings.json\` / \`findings.md\` | Classified findings list |
| \`packet.json\` | Machine-readable manifest (\`zeroday-security-packet/v1\`) |
| \`*.sarif\` | Copied inventory SARIF path(s) |
| \`README.md\` | This file |

## Labels

\`agent-misfire\` · \`config\` · \`dependency\` · \`unknown\` — assigned only when Desk B inventory kind evidence maps; otherwise \`unknown\` (no guessing).

## Hard limits

- Generate only — **no** Slack / GH / email auto-send
- No PoC / exploit / payload (localization only)
- Secrets redacted (names/patterns only)
- \`npm run mvp\` unchanged as the stranger door
`;
}
