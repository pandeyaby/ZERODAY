/**
 * Findings Ledger + Retest workflow.
 */

import { dbRepo } from "@/lib/db/repo";
import type { Finding, FindingConfidence, FindingSeverity, RetestItem } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";

export interface CreateFindingInput {
  missionId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence?: FindingConfidence;
  vendorImpact: string[];
  evidenceIds: string[];
  recommendedFix: string;
  mitreTactics?: string[];
  cveIds?: string[];
}

/**
 * Create a finding. High/critical always enter needs_retest before promotion.
 */
export function createFinding(input: CreateFindingInput): Finding {
  const needsRetest = input.severity === "high" || input.severity === "critical";
  const finding: Finding = {
    id: uid("fnd"),
    missionId: input.missionId,
    title: input.title,
    description: input.description,
    severity: input.severity,
    confidence: input.confidence || (needsRetest ? "tentative" : "probable"),
    status: needsRetest ? "needs_retest" : "draft",
    vendorImpact: input.vendorImpact,
    evidenceIds: input.evidenceIds,
    recommendedFix: input.recommendedFix,
    mitreTactics: input.mitreTactics,
    cveIds: input.cveIds,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  dbRepo.saveFinding(finding);

  if (needsRetest) {
    queueRetest(finding.id, finding.missionId, "Automatic queue: high/critical requires retest before promotion.");
  }

  return finding;
}

export function queueRetest(findingId: string, missionId: string, reason: string): RetestItem {
  const item: RetestItem = {
    id: uid("rtx"),
    findingId,
    missionId,
    status: "queued",
    reason,
    createdAt: nowIso(),
  };
  return dbRepo.saveRetest(item);
}

/**
 * Complete a retest. On pass, promote confidence; on fail, mark false_positive or keep needs_retest.
 */
export function completeRetest(
  retestId: string,
  outcome: "passed" | "failed",
  notes: string
): { retest: RetestItem; finding?: Finding } {
  const retests = dbRepo.listRetests();
  const retest = retests.find((r) => r.id === retestId);
  if (!retest) throw new Error("Retest not found");

  retest.status = outcome;
  retest.completedAt = nowIso();
  retest.resultNotes = notes;
  dbRepo.saveRetest(retest);

  const finding = dbRepo.getFinding(retest.findingId);
  if (!finding) return { retest };

  if (outcome === "passed") {
    finding.status = "promoted";
    finding.confidence = "confirmed";
    finding.promotedAt = nowIso();
    finding.retestNotes = notes;
  } else {
    finding.status = "needs_retest";
    finding.confidence = "tentative";
    finding.retestNotes = notes;
  }
  finding.updatedAt = nowIso();
  dbRepo.saveFinding(finding);
  return { retest, finding };
}

export function dismissFinding(findingId: string, reason: string): Finding {
  const finding = dbRepo.getFinding(findingId);
  if (!finding) throw new Error("Finding not found");
  finding.status = "dismissed";
  finding.retestNotes = reason;
  finding.updatedAt = nowIso();
  return dbRepo.saveFinding(finding);
}
