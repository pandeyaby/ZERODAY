/**
 * Operator Spec — markdown brief an AI coding agent follows.
 * Keyless by default: the coding agent already running the tool is the operator.
 */

import type { AdvisoryRef } from "../locate/types";

export const ALLOWED_OPERATOR_TOOLS = [
  "list (directory listing within the snapshot / repo only)",
  "grep (search file contents within the snapshot / repo only)",
  "read (read file contents within the snapshot / repo only)",
] as const;

export const FORBIDDEN_OPERATOR_ACTIONS = [
  "Write exploits, PoCs, payloads, shellcode, or attack procedures",
  "Network probing, scanning, or outbound requests against live systems",
  "Credential theft, secret exfiltration, or bypass of access controls",
  "Mutating the target repo or snapshot (read-only)",
  "Downloading model weights or calling cloud inference with customer source",
  "Claiming exploitability or auto-merging fixes",
] as const;

export function buildOperatorInstructions(opts: {
  advisory: AdvisoryRef;
  targetRepo: string;
  snapshotPath: string;
  schemaPath: string;
  submissionHint: string;
}): string {
  const lines: string[] = [];
  lines.push(`# ZERODAY Agent Operator Spec`);
  lines.push(``);
  lines.push(
    `You are a **defensive security localization operator**. Your job is to find ` +
      `candidate files related to an advisory inside a **read-only** repository snapshot, ` +
      `cite evidence quotes, and submit a structured JSON package. Localization is **not** ` +
      `proof of exploitability. A human always reviews.`,
  );
  lines.push(``);
  lines.push(`## Inputs`);
  lines.push(``);
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Advisory | \`${opts.advisory.id}\` → \`${opts.advisory.cweId}\` |`);
  if (opts.advisory.title) {
    lines.push(`| Title | ${opts.advisory.title} |`);
  }
  lines.push(`| Target repo | \`${opts.targetRepo}\` |`);
  lines.push(`| Read-only snapshot | \`${opts.snapshotPath}\` |`);
  lines.push(`| Submission schema | \`${opts.schemaPath}\` |`);
  lines.push(`| Write submission to | \`${opts.submissionHint}\` |`);
  lines.push(``);
  lines.push(`## Allowed tools (read-only explore)`);
  lines.push(``);
  for (const t of ALLOWED_OPERATOR_TOOLS) {
    lines.push(`- ${t}`);
  }
  lines.push(``);
  lines.push(`Stay inside the snapshot / repo path. Do not follow symlinks outside it.`);
  lines.push(``);
  lines.push(`## Forbidden actions`);
  lines.push(``);
  for (const f of FORBIDDEN_OPERATOR_ACTIONS) {
    lines.push(`- ${f}`);
  }
  lines.push(``);
  lines.push(
    `If asked for a fix **and** a PoC: produce only a defensive fix draft idea in notes ` +
      `(or leave notes empty) and **refuse the PoC in one sentence**. Never include exploit steps.`,
  );
  lines.push(``);
  lines.push(`## Submission format`);
  lines.push(``);
  lines.push(
    `Emit JSON matching schema \`zeroday-operator-submission/v1\` (see \`${opts.schemaPath}\`):`,
  );
  lines.push(``);
  lines.push(`- \`rankedFiles[]\` — repo-relative paths, 1-based rank, CWE ids, short title`);
  lines.push(`- Each file needs ≥1 evidence quote (\`excerpt\` + \`note\` + optional lines)`);
  lines.push(`- \`confidence\` per file: \`low\` | \`medium\` | \`high\` (your judgment, not a vendor score)`);
  lines.push(`- \`needs_human\` **must** be \`true\``);
  lines.push(`- Optional \`explorationTrace\` / \`toolLog\` for the evidence vault`);
  lines.push(``);
  lines.push(`If no candidate files: submit \`rankedFiles: []\` with \`needs_human: true\`.`);
  lines.push(``);
  lines.push(`## Posture`);
  lines.push(``);
  lines.push(`- Detector-lane **candidates** only (Foundry Security Spec)`);
  lines.push(`- Compose with Project CodeGuard for patch drafts — never auto-merge`);
  lines.push(`- Source stays on this machine; keyless by default (no Antares HF token required)`);
  lines.push(``);
  return lines.join("\n");
}
