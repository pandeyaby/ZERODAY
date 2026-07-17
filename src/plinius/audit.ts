/**
 * Audit trail for Plinius research / adapter access.
 */

import { captureEvidence } from "@/evidence/vault";
import type { OperatorRole } from "@/lib/types";

export function auditPliniusAccess(input: {
  missionId?: string;
  operatorRole?: OperatorRole;
  libraryId: string;
  action: string;
  summary: string;
  meta?: Record<string, unknown>;
  denied?: boolean;
}) {
  return captureEvidence({
    missionId: input.missionId || "system",
    operatorRole: input.operatorRole || "coordinator",
    toolId: `plinius.${input.libraryId}.${input.action}`,
    kind: "operator_note",
    title: input.denied
      ? `Plinius DENIED: ${input.libraryId}/${input.action}`
      : `Plinius: ${input.libraryId}/${input.action}`,
    summary: input.summary,
    payload: {
      libraryId: input.libraryId,
      action: input.action,
      denied: Boolean(input.denied),
      ...(input.meta || {}),
    },
    tags: ["plinius", input.libraryId, input.denied ? "denied" : "access"],
  });
}
