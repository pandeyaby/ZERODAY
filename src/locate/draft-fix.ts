/**
 * CodeGuard-aligned patch DRAFTS — gated human request only.
 *
 * Maps CWE → existing Project CodeGuard rule ids (codeguard-*.md).
 * Never auto-merge. Never emit PoC/exploit. Never claim "CodeGuard-approved."
 * https://project-codeguard.org/
 */

import fs from "node:fs";
import path from "node:path";
import type { LocalizationResult, RankedFile } from "./types";
import {
  assertNoExploitInvariant,
  checkNoExploitInvariant,
} from "./invariant";

/** Explicit CLI gate flag name */
export const DRAFT_FIX_FLAG = "--i-asked-for-a-fix";

/** Existing Project CodeGuard rule ids we map to — no new upstream rules. */
export const CODEGUARD_RULE_MAP: Record<
  string,
  { ruleId: string; ruleFile: string; guidance: string }
> = {
  "CWE-89": {
    ruleId: "codeguard-0-input-validation-injection",
    ruleFile: "codeguard-0-input-validation-injection.md",
    guidance:
      "Use prepared statements / parameterized queries for 100% of data access. " +
      "Never concatenate untrusted input into SQL. Prefer least-privilege DB users.",
  },
  "CWE-79": {
    ruleId: "codeguard-0-input-validation-injection",
    ruleFile: "codeguard-0-input-validation-injection.md",
    guidance:
      "Treat untrusted input as data, never as code. Encode output for the correct HTML/JS context. " +
      "Prefer framework auto-escaping; avoid raw/unsafe HTML sinks.",
  },
  "CWE-78": {
    ruleId: "codeguard-0-input-validation-injection",
    ruleFile: "codeguard-0-input-validation-injection.md",
    guidance:
      "Do not invoke a shell with untrusted input. Prefer structured exec APIs with argv arrays; " +
      "allow-list arguments; validate early at trust boundaries.",
  },
  "CWE-22": {
    ruleId: "codeguard-0-input-validation-injection",
    ruleFile: "codeguard-0-input-validation-injection.md",
    guidance:
      "Resolve paths against an allow-listed root; reject .. and absolute escapes. " +
      "Canonicalize before checks. Never trust client-supplied path segments.",
  },
  "CWE-94": {
    ruleId: "codeguard-0-input-validation-injection",
    ruleFile: "codeguard-0-input-validation-injection.md",
    guidance:
      "Never evaluate untrusted strings as code. Avoid dynamic eval/exec; " +
      "use safe parsers and allow-listed operations.",
  },
  "CWE-502": {
    ruleId: "codeguard-0-framework-and-languages",
    ruleFile: "codeguard-0-framework-and-languages.md",
    guidance:
      "Avoid deserializing untrusted data with unsafe formatters. Prefer allow-listed types; " +
      "disable gadget-prone defaults; validate at trust boundaries.",
  },
};

export const EXPLOIT_REFUSAL =
  "ZERODAY refuses exploits, PoCs, payloads, and attack procedures — localization and optional patch drafts only.";

export interface DraftFixOptions {
  /** Must be true — mirrors CLI --i-asked-for-a-fix */
  iAskedForAFix: boolean;
  /** Also asked for a PoC/exploit — refuse that; still emit draft if fix was asked */
  alsoAskedForPoC?: boolean;
  result: LocalizationResult;
  /** Optional: read file contents from this repo for contextual drafts */
  repoPath?: string;
  outputDir: string;
}

export interface DraftFixArtifact {
  path: string;
  markdown: string;
  refusedExploit: boolean;
}

function draftForFile(
  result: LocalizationResult,
  file: RankedFile,
  sourceSnippet?: string,
): string {
  const cwe = file.cweIds[0] ?? result.advisory.cweId;
  const rule =
    CODEGUARD_RULE_MAP[cwe] ??
    ({
      ruleId: "codeguard-0-input-validation-injection",
      ruleFile: "codeguard-0-input-validation-injection.md",
      guidance:
        "Apply Project CodeGuard secure-coding guidance for this CWE: validate at trust boundaries, " +
        "separate code from data, prefer safe platform APIs.",
    } as const);

  const lines: string[] = [];
  lines.push(`# Patch DRAFT — ${file.filePath}`);
  lines.push(``);
  lines.push(`> **DRAFT ONLY.** Human review required. Never auto-merge.`);
  lines.push(
    `> Aligned to Project CodeGuard rule \`${rule.ruleId}\` (\`${rule.ruleFile}\`).`,
  );
  lines.push(
    `> This is **not** a CodeGuard certification or approval claim.`,
  );
  lines.push(``);
  lines.push(`| | |`);
  lines.push(`|--|--|`);
  lines.push(`| Advisory | ${result.advisory.id} → ${cwe} |`);
  lines.push(`| Rank | ${file.rank} |`);
  lines.push(`| Title | ${file.title} |`);
  lines.push(`| CodeGuard rule | ${rule.ruleId} |`);
  lines.push(``);
  lines.push(`## Why this draft`);
  lines.push(``);
  lines.push(rule.guidance);
  lines.push(``);
  lines.push(`## Evidence (from localization)`);
  lines.push(``);
  for (const e of file.evidence) {
    lines.push(`- ${e.note}`);
    if (e.excerpt) {
      lines.push(``);
      lines.push("```");
      lines.push(e.excerpt.trimEnd());
      lines.push("```");
      lines.push(``);
    }
  }

  if (cwe === "CWE-89") {
    lines.push(`## Suggested direction (parameterize)`);
    lines.push(``);
    lines.push(
      `Replace string-concatenated SQL with a parameterized API. Example pattern:`,
    );
    lines.push(``);
    lines.push("```js");
    lines.push(`// DRAFT — review before merge`);
    lines.push(
      `export function findUserByName(db, name) {`,
    );
    lines.push(
      `  return db.query(`,
    );
    lines.push(
      `    "SELECT id, name, email FROM users WHERE name = ?",`,
    );
    lines.push(`    [name],`);
    lines.push(`  );`);
    lines.push(`}`);
    lines.push("```");
    lines.push(``);
  } else {
    lines.push(`## Suggested direction`);
    lines.push(``);
    lines.push(
      `Apply the CodeGuard guidance above to \`${file.filePath}\`. ` +
        `Keep the change minimal; add tests that assert untrusted input cannot alter control flow.`,
    );
    lines.push(``);
  }

  if (sourceSnippet) {
    lines.push(`## Current snippet (context)`);
    lines.push(``);
    lines.push("```");
    // Strip defensive doc-comments that mention refused topics so the draft
    // itself stays within the no-exploit invariant.
    const cleaned = sourceSnippet
      .split("\n")
      .filter((l) => !/\b(exploit|poc|payload)\b/i.test(l))
      .join("\n")
      .trimEnd()
      .slice(0, 2000);
    lines.push(cleaned);
    lines.push("```");
    lines.push(``);
  }

  lines.push(`## Human next steps`);
  lines.push(``);
  lines.push(`1. Confirm the localization candidate is a true positive.`);
  lines.push(`2. Adapt this DRAFT to your stack and coding standards.`);
  lines.push(`3. Add / update tests; open a normal reviewable PR.`);
  lines.push(`4. Do **not** auto-merge from ZERODAY.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(
    `_Project CodeGuard: https://project-codeguard.org/ · Foundry Security Spec roles compose separately._`,
  );
  lines.push(``);
  return lines.join("\n");
}

/**
 * Refuse if the gate flag is missing. If PoC was also requested, refuse PoC
 * in one sentence but still emit the patch draft when the fix was asked.
 */
export function draftFix(options: DraftFixOptions): DraftFixArtifact {
  if (!options.iAskedForAFix) {
    throw new Error(
      `draft-fix requires the explicit human flag ${DRAFT_FIX_FLAG}. ` +
        `Patch drafts are never generated by default.`,
    );
  }

  const refusedExploit = Boolean(options.alsoAskedForPoC);
  const parts: string[] = [];
  parts.push(`# ZERODAY patch DRAFTS`);
  parts.push(``);
  parts.push(
    `Human asked for a fix (${DRAFT_FIX_FLAG}). Localization-first. Never auto-merge.`,
  );
  if (refusedExploit) {
    parts.push(``);
    parts.push(`> ${EXPLOIT_REFUSAL}`);
  }
  parts.push(``);
  parts.push(
    `Advisory: **${options.result.advisory.id}** → **${options.result.advisory.cweId}**`,
  );
  parts.push(`Findings: ${options.result.rankedFiles.length}`);
  parts.push(``);

  if (options.result.rankedFiles.length === 0) {
    parts.push(`_No ranked files — nothing to draft._`);
    parts.push(``);
  } else {
    for (const file of options.result.rankedFiles) {
      let snippet: string | undefined;
      if (options.repoPath) {
        const p = path.join(options.repoPath, file.filePath);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          try {
            snippet = fs.readFileSync(p, "utf8").slice(0, 2000);
          } catch {
            snippet = undefined;
          }
        }
      }
      parts.push(draftForFile(options.result, file, snippet));
      parts.push(``);
    }
  }

  const markdown = parts.join("\n");
  assertNoExploitInvariant([markdown]);

  fs.mkdirSync(options.outputDir, { recursive: true });
  const outPath = path.join(options.outputDir, "patch-draft.md");
  fs.writeFileSync(outPath, markdown);
  return { path: outPath, markdown, refusedExploit };
}

/** CLI helper: detect exploit/PoC intent in free-text args */
export function requestLooksLikeExploit(text: string): boolean {
  return checkNoExploitInvariant([text]).length > 0 ||
    /\b(poc|exploit|payload|weaponize|shellcode)\b/i.test(text);
}
