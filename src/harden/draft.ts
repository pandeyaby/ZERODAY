/**
 * Optional CodeGuard-aligned draft notes for Desk C harden.
 * Human-gated (--draft) — never auto-apply / auto-PR / auto-merge.
 */

import { assertNoExploitInvariant } from "../locate/invariant";
import type { HardenDraftNote, HardenRecommendation } from "./types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

/**
 * Emit CodeGuard-aligned draft note markdown for one recommendation.
 * Still recommend-only — no patch application.
 */
export function draftNoteMarkdown(rec: HardenRecommendation): string {
  const cg = rec.codeguard;
  const lines: string[] = [];
  lines.push(`# Harden DRAFT — ${rec.title}`);
  lines.push("");
  lines.push(`> **DRAFT ONLY.** Human review required. Never auto-apply · never auto-PR · never auto-merge.`);
  if (cg) {
    lines.push(
      `> Aligned to Project CodeGuard rule \`${cg.ruleId}\` (\`${cg.ruleFile}\`).`,
    );
    lines.push(
      `> This is **not** a CodeGuard certification or approval claim.`,
    );
  } else {
    lines.push(
      `> No CodeGuard rule mapped for this category — defensive recommendation only.`,
    );
  }
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Desk | C (agent/package harden) |`);
  lines.push(`| Category | \`${rec.category}\` |`);
  lines.push(`| Priority | ${rec.priority} |`);
  lines.push(`| Evidence finding | \`${rec.evidence.findingId}\` |`);
  lines.push(`| Kind | \`${rec.evidence.kind}\` |`);
  lines.push(`| Path | \`${rec.evidence.path}\` |`);
  lines.push(`| Pattern | \`${rec.evidence.pattern ?? "—"}\` |`);
  if (cg?.cweId) {
    lines.push(`| CWE map (guidance only) | \`${cg.cweId}\` |`);
  }
  lines.push("");
  lines.push("## Recommendation (human-gated)");
  lines.push("");
  lines.push(rec.recommendation);
  lines.push("");
  if (cg) {
    lines.push("## CodeGuard guidance (compose, don’t replace)");
    lines.push("");
    lines.push(cg.guidance);
    lines.push("");
  }
  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Recommendations / draft notes only — **no** auto-apply");
  lines.push("- **No** auto-PR · **no** auto-merge");
  lines.push("- No PoC / exploit / payload (localization only — not exploitability proof)");
  lines.push("- Secret *values* never included (patterns/names only)");
  lines.push("- Localization ≠ exploitability · `needs_human: true`");
  lines.push("");
  lines.push(
    `_Project CodeGuard: https://project-codeguard.org/ · Foundry Security Spec roles compose separately._`,
  );
  lines.push("");

  const md = lines.join("\n");
  assertNoExploitInvariant([md]);
  return md;
}

/**
 * Build draft note artifacts for recommendations that carry CodeGuard refs.
 * Recommendations without a codeguard mapping get a lightweight draft still
 * marked human-gated (config-surface).
 */
export function buildHardenDraftNotes(
  recommendations: HardenRecommendation[],
): HardenDraftNote[] {
  const notes: HardenDraftNote[] = [];
  for (const rec of recommendations) {
    const base =
      slugify(
        `${rec.category}-${rec.evidence.repoId ?? "repo"}-${rec.evidence.path}-${rec.evidence.pattern ?? rec.evidence.kind}`,
      ) || "harden-draft";
    const relativePath = `drafts/${base}.md`;
    const markdown = draftNoteMarkdown(rec);
    notes.push({
      id: `draft:${rec.id}`,
      recommendationId: rec.id,
      relativePath,
      title: rec.title,
      markdown,
    });
  }
  return notes;
}
