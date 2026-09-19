/**
 * SIGNFLIP score_margin channel — signed continuous polarity from localization
 * evidence weights (same features that drive rankedFiles), not SARIF level renames.
 */

import type { LocalizationResult, RankedFile } from "../types";
import { decisionFingerprintFromPacket } from "./fingerprint";

/**
 * Deterministic evidence weight mirroring CWE-89 heuristic pattern scores
 * (sql-plus-embed / concat / SELECT presence) plus continuous excerpt features.
 * Not a cosmetic field — same family of weights used to produce rankedFiles.
 */
export function evidenceScore(file: RankedFile): number {
  let s = 0;
  for (const e of file.evidence) {
    const excerpt = e.excerpt ?? "";
    const note = e.note ?? "";
    // Pattern family aligned with src/locate/rules/cwe-89.ts scores
    if (/(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^;\n]{0,120}\+\s*\w+\s*\+/i.test(excerpt)) {
      s += 96;
    } else if (
      /(["'])[^"'\\\n]{0,120}(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^"'\\\n]{0,120}\1\s*\+/i.test(
        excerpt,
      )
    ) {
      s += 95;
    } else if (/(?:execute|query|raw)\s*\(/i.test(excerpt) && /\+/.test(excerpt)) {
      s += 92;
    } else if (/(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(excerpt)) {
      s += 80;
    } else if (/req\.query|findUser|parameter/i.test(excerpt + note)) {
      s += 70;
    } else {
      s += 40;
    }
    // Continuous components so margin is not a pure categorical jump
    s += Math.min(excerpt.length, 200) / 100;
    if (typeof e.startLine === "number") {
      s += 1 / (1 + e.startLine);
    }
    if (typeof e.endLine === "number" && typeof e.startLine === "number") {
      s += Math.max(0, e.endLine - e.startLine) * 0.1;
    }
  }
  s += Math.min(file.title.length, 80) * 0.01;
  return s;
}

export interface ScoredFile {
  filePath: string;
  score: number;
}

/** Order files by signed score descending (ties broken by path). */
export function orderByScore(files: RankedFile[]): ScoredFile[] {
  return files
    .map((f) => ({ filePath: f.filePath, score: evidenceScore(f) }))
    .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));
}

/** score(top1) − score(top2); negative when reported order disagrees with scores. */
export function scoreMargin(ordered: ScoredFile[]): number {
  if (ordered.length < 2) {
    throw new Error("score_margin requires ≥2 scored files");
  }
  return ordered[0].score - ordered[1].score;
}

/**
 * Odd-symmetric graded invariant: sign-normalize order by margin polarity.
 * fp(order, m) === fp(reverse(order), −m) after canonicalization.
 */
export function signNormalizedInvariant(
  orderedPaths: string[],
  margin: number,
): string {
  const canon =
    margin < 0 ? [...orderedPaths].reverse() : [...orderedPaths];
  return decisionFingerprintFromPacket({
    signflip_channel: "score_margin",
    canon_order: canon,
  });
}

/** Negate polarity and re-sort reported order (SIGNFLIP conforming axis). */
export function flipAndResort(ordered: ScoredFile[]): ScoredFile[] {
  // Reverse reported ranking under flipped polarity. Evidence scores stay on
  // files so score(top1)−score(top2) becomes negative (order disagrees with
  // natural score descent). Negating scores then re-sorting descending would
  // keep margin positive — that is NOT a sign flip of the channel.
  return [...ordered].reverse();
}

/** Flip margin sign without changing reported order (violating). */
export function flipMarginKeepOrder(ordered: ScoredFile[]): {
  paths: string[];
  margin: number;
} {
  const paths = ordered.map((f) => f.filePath);
  const margin = -scoreMargin(ordered);
  return { paths, margin };
}

export function scoredFromResult(result: LocalizationResult): ScoredFile[] {
  if (result.rankedFiles.length < 2) {
    throw new Error("SIGNFLIP requires ≥2 rankedFiles for score_margin");
  }
  return orderByScore(result.rankedFiles);
}
