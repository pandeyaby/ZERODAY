/**
 * Ownership routing — CODEOWNERS + optional git blame heuristics.
 * Emits reviewable markdown + GitHub comment body. Never auto-merges.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LocalizationResult } from "../locate/types";
import type {
  CodeOwnersRule,
  InventoryArtifact,
  OwnershipArtifact,
  OwnershipHit,
} from "./types";

/** Minimal glob-ish match for CODEOWNERS patterns (* and **). */
export function matchCodeownersPattern(
  filePath: string,
  pattern: string,
): boolean {
  const file = filePath.replace(/^\.\//, "").split(path.sep).join("/");
  let pat = pattern.replace(/^\.\//, "");

  // Directory ownership: /foo/ or foo/
  if (pat.endsWith("/")) {
    const dir = pat.replace(/^\//, "");
    return file === dir.slice(0, -1) || file.startsWith(dir);
  }

  // Absolute-from-root patterns
  if (pat.startsWith("/")) {
    pat = pat.slice(1);
  }

  const escapeReChar = (ch: string) =>
    /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;

  let reSrc = "^";
  for (let i = 0; i < pat.length; ) {
    if (pat[i] === "*" && pat[i + 1] === "*") {
      reSrc += ".*";
      i += 2;
      continue;
    }
    if (pat[i] === "*") {
      reSrc += "[^/]*";
      i += 1;
      continue;
    }
    if (pat[i] === "?") {
      reSrc += "[^/]";
      i += 1;
      continue;
    }
    reSrc += escapeReChar(pat[i]!);
    i += 1;
  }
  reSrc += "$";
  return new RegExp(reSrc).test(file);
}

export function ownersForFile(
  filePath: string,
  rules: CodeOwnersRule[],
): { owners: string[]; matchedPattern: string | null } {
  // Last matching rule wins (GitHub CODEOWNERS semantics)
  let matched: CodeOwnersRule | null = null;
  for (const rule of rules) {
    if (matchCodeownersPattern(filePath, rule.pattern)) {
      matched = rule;
    }
  }
  if (!matched) return { owners: [], matchedPattern: null };
  return { owners: [...matched.owners], matchedPattern: matched.pattern };
}

function blameHint(repoRoot: string, filePath: string): string | null {
  const abs = path.join(repoRoot, filePath);
  if (!fs.existsSync(abs)) return null;
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%an <%ae>", "--", filePath],
      {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: 5_000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

function buildReviewMarkdown(
  result: LocalizationResult,
  hits: OwnershipHit[],
  unmatched: string[],
): string {
  const lines: string[] = [];
  lines.push("# ZERODAY ownership route");
  lines.push("");
  lines.push(
    "> **Human review required.** Localization candidates with CODEOWNERS / blame hints — " +
      "**not** proof of exploitability. No auto-merge.",
  );
  lines.push("");
  lines.push(`- Advisory: \`${result.advisory.id}\` → \`${result.advisory.cweId}\``);
  lines.push(`- Mode: \`${result.mode}\``);
  lines.push(`- Findings: ${result.summary.findingCount}`);
  lines.push("");
  lines.push("## Routed files");
  lines.push("");
  if (hits.length === 0) {
    lines.push("_No ranked files to route._");
  } else {
    lines.push("| File | Owners | Pattern | Blame hint |");
    lines.push("|------|--------|---------|------------|");
    for (const h of hits) {
      lines.push(
        `| \`${h.filePath}\` | ${h.owners.join(" ") || "—"} | \`${h.matchedPattern ?? "—"}\` | ${h.blameHint ?? "—"} |`,
      );
    }
  }
  if (unmatched.length) {
    lines.push("");
    lines.push("## Unmatched (no CODEOWNERS rule)");
    lines.push("");
    for (const u of unmatched) lines.push(`- \`${u}\``);
  }
  lines.push("");
  lines.push("## Posture");
  lines.push("");
  lines.push("- Localization only · not exploit proof · no PoC · no auto-merge");
  lines.push("- Ownership hints are for triage routing — not assignment authority");
  lines.push("");
  return lines.join("\n");
}

function buildGithubComment(
  result: LocalizationResult,
  hits: OwnershipHit[],
): string {
  const lines: string[] = [];
  lines.push("## ZERODAY factory — ownership route");
  lines.push("");
  lines.push(
    "> **Human review required.** Not exploitability proof. No auto-merge.",
  );
  lines.push("");
  lines.push(
    `| Advisory | \`${result.advisory.id}\` → \`${result.advisory.cweId}\` |`,
  );
  lines.push(`| Findings | **${result.summary.findingCount}** |`);
  lines.push("");
  if (hits.length) {
    lines.push("| File | Owners |");
    lines.push("|------|--------|");
    for (const h of hits) {
      lines.push(
        `| \`${h.filePath}\` | ${h.owners.join(" ") || "_unassigned_"} |`,
      );
    }
  } else {
    lines.push("_No ranked files._");
  }
  lines.push("");
  lines.push("_Factory loop: inventory → locate → classify → own → verify._");
  lines.push("");
  return lines.join("\n");
}

export function buildOwnership(opts: {
  result: LocalizationResult;
  inventory: InventoryArtifact;
  /** Include git blame heuristics (read-only) */
  includeBlame?: boolean;
}): OwnershipArtifact {
  const rules = opts.inventory.codeownersRules;
  const hits: OwnershipHit[] = [];
  const unmatched: string[] = [];

  for (const f of opts.result.rankedFiles) {
    const { owners, matchedPattern } = ownersForFile(f.filePath, rules);
    const blame =
      opts.includeBlame === false
        ? null
        : blameHint(opts.inventory.repoRoot, f.filePath);
    const hit: OwnershipHit = {
      filePath: f.filePath,
      owners,
      matchedPattern,
      blameHint: blame,
    };
    hits.push(hit);
    if (owners.length === 0) unmatched.push(f.filePath);
  }

  const reviewMarkdown = buildReviewMarkdown(opts.result, hits, unmatched);
  const githubCommentMarkdown = buildGithubComment(opts.result, hits);

  return {
    schemaVersion: "zeroday-factory-ownership/v1",
    generatedAt: new Date().toISOString(),
    hits,
    unmatched,
    reviewMarkdown,
    githubCommentMarkdown,
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      humanReviewRequired: true,
    },
  };
}

export function writeOwnership(
  opts: {
    result: LocalizationResult;
    inventory: InventoryArtifact;
    includeBlame?: boolean;
  },
  paths: { json: string; md: string; comment: string },
): OwnershipArtifact {
  const artifact = buildOwnership(opts);
  fs.mkdirSync(path.dirname(paths.json), { recursive: true });
  fs.writeFileSync(paths.json, JSON.stringify(artifact, null, 2));
  fs.writeFileSync(paths.md, artifact.reviewMarkdown);
  fs.writeFileSync(paths.comment, artifact.githubCommentMarkdown);
  return artifact;
}
