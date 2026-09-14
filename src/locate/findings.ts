/**
 * Internal finding model — single source for all defender exporters.
 * Localization notes / Foundry Detector-lane CANDIDATES only.
 * True-positive waits for human triage. Never mark exploited.
 */

import { createHash } from "node:crypto";
import type { LocalizationResult, RankedFile, EvidenceSpan } from "./types";
import { categoryForCwe } from "./categories";

export interface InternalFinding {
  id: string;
  advisoryId: string;
  cweId: string;
  category: string;
  /** Only set when the operator input (or advisory) was a real CVE id */
  cveId?: string;
  ghsaId?: string;
  filePath: string;
  rank: number;
  title: string;
  evidence: EvidenceSpan[];
  /** Only when present in source report — never invented */
  startLine?: number;
  endLine?: number;
  mode: "fixture" | "live" | "agent" | "rules" | "ingest";
  model: string;
  generatedAt: string;
  targetRepo: string;
  /** Antares-1B public File F1 — model localization quality, not finding confidence */
  modelFileF1: number;
  posture: LocalizationResult["posture"];
  /** MITRE taxonomy string when present — not an exploit flag */
  likelihoodOfExploit?: string;
}

export const ANTARES_1B_FILE_F1 = 0.209;

export function findingId(
  advisoryId: string,
  filePath: string,
  rank: number,
): string {
  const h = createHash("sha256")
    .update(`${advisoryId}|${filePath}|${rank}`)
    .digest("hex")
    .slice(0, 16);
  return `zeroday-${h}`;
}

export function toInternalFindings(
  result: LocalizationResult,
): InternalFinding[] {
  const category = categoryForCwe(result.advisory.cweId);
  const cveId =
    result.advisory.kind === "cve" ? result.advisory.id : undefined;
  const ghsaId =
    result.advisory.kind === "ghsa" ? result.advisory.id : undefined;

  return result.rankedFiles.map((f: RankedFile) => {
    const primary = f.evidence[0];
    return {
      id: findingId(result.advisory.id, f.filePath, f.rank),
      advisoryId: result.advisory.id,
      cweId: f.cweIds[0] ?? result.advisory.cweId,
      category,
      cveId,
      ghsaId,
      filePath: f.filePath,
      rank: f.rank,
      title: f.title,
      evidence: f.evidence,
      startLine: primary?.startLine,
      endLine: primary?.endLine,
      mode: result.mode,
      model: result.model,
      generatedAt: result.generatedAt,
      targetRepo: result.targetRepo,
      modelFileF1: ANTARES_1B_FILE_F1,
      posture: result.posture,
      likelihoodOfExploit: f.likelihoodOfExploit,
    };
  });
}
