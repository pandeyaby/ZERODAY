/**
 * One-shot prompts for coding agents (Cursor / Claude Code / stdout).
 * Keyless — no Antares weights. Read-only explore → submission.json.
 */

import type { OperatorBrief } from "./types";
import {
  ALLOWED_OPERATOR_TOOLS,
  FORBIDDEN_OPERATOR_ACTIONS,
} from "./spec";

export type AgentPromptFlavor = "cursor" | "stdout" | "claude";

export function buildAgentOneShotPrompt(opts: {
  brief: OperatorBrief;
  flavor?: AgentPromptFlavor;
}): string {
  const flavor = opts.flavor || "stdout";
  const b = opts.brief;
  const lines: string[] = [];

  if (flavor === "cursor") {
    lines.push(`# Cursor / coding-agent task — ZERODAY operate (keyless)`);
    lines.push(``);
  } else if (flavor === "claude") {
    lines.push(`# Claude Code task — ZERODAY operate (keyless)`);
    lines.push(``);
  } else {
    lines.push(`# ZERODAY agent operator — one-shot prompt`);
    lines.push(``);
  }

  lines.push(
    `You are a **defensive security localization operator**. Explore the read-only repo, ` +
      `cite evidence quotes, and write a JSON submission. Localization is **not** exploitability. ` +
      `Never write exploits, PoCs, payloads, or attack procedures. No network scans. No credential theft.`,
  );
  lines.push(``);
  lines.push(`## Advisory`);
  lines.push(`- \`${b.advisory.id}\` → \`${b.advisory.cweId}\``);
  if (b.advisory.title) lines.push(`- ${b.advisory.title}`);
  lines.push(``);
  lines.push(`## Paths`);
  lines.push(`- Target repo: \`${b.targetRepo}\``);
  lines.push(`- Read-only snapshot (prefer this): \`${b.snapshotPath}\``);
  lines.push(`- Operator Spec: \`${b.instructionsMarkdownPath}\``);
  lines.push(`- Submission schema: \`${b.submissionSchemaPath}\``);
  lines.push(`- Write submission to: \`${b.submissionPathHint}\``);
  lines.push(``);
  lines.push(`## Allowed tools (read-only, inside snapshot/repo only)`);
  for (const t of ALLOWED_OPERATOR_TOOLS) lines.push(`- ${t}`);
  lines.push(``);
  lines.push(`## Forbidden`);
  for (const f of FORBIDDEN_OPERATOR_ACTIONS) lines.push(`- ${f}`);
  lines.push(``);
  lines.push(`## Steps`);
  lines.push(`1. Read \`${b.instructionsMarkdownPath}\` and the schema.`);
  lines.push(`2. Explore with list/grep/read only — stay inside the snapshot/repo.`);
  lines.push(
    `3. Write \`${b.submissionPathHint}\` matching schema \`zeroday-operator-submission/v1\` ` +
      `with \`needs_human: true\` and ≥1 evidence excerpt per ranked file (or empty rankedFiles).`,
  );
  lines.push(
    `4. Stop. A human will run: \`npm run zeroday -- operate --from ${b.submissionPathHint} --cwe ${b.advisory.cweId} --repo ${b.targetRepo}\` ` +
      `(or reuse the same \`--output\` run dir) then \`zeroday verify\`.`,
  );
  lines.push(``);
  lines.push(
    `If asked for a fix **and** a PoC: refuse the PoC in one sentence; do not include exploit steps.`,
  );
  lines.push(``);
  return lines.join("\n");
}
