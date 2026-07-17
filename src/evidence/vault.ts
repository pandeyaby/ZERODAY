/**
 * Evidence Vault — durable, hashed, provenance-tracked records.
 */

import { dbRepo } from "@/lib/db/repo";
import type { EvidenceKind, EvidenceRecord, OperatorRole } from "@/lib/types";
import { hashPayload, nowIso, redactSecrets, uid } from "@/lib/utils";

export interface CaptureEvidenceInput {
  missionId: string;
  operatorRole?: OperatorRole;
  toolId?: string;
  kind: EvidenceKind;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  parentIds?: string[];
  tags?: string[];
  containsSecrets?: boolean;
  /** Force redaction regardless of settings. */
  forceRedact?: boolean;
}

/**
 * Capture evidence into the vault. Secrets are redacted by default.
 */
export function captureEvidence(input: CaptureEvidenceInput): EvidenceRecord {
  const settings = dbRepo.getSettings();
  const shouldRedact = settings.redactSecrets || input.forceRedact || input.containsSecrets;
  const payload = shouldRedact ? redactSecrets(input.payload) : input.payload;

  const record: EvidenceRecord = {
    id: uid("ev"),
    missionId: input.missionId,
    operatorRole: input.operatorRole,
    toolId: input.toolId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    payload,
    hash: hashPayload(payload),
    parentIds: input.parentIds || [],
    createdAt: nowIso(),
    tags: input.tags || [],
    containsSecrets: Boolean(input.containsSecrets),
    redacted: Boolean(shouldRedact),
  };

  return dbRepo.saveEvidence(record);
}

export function getEvidenceChain(evidenceId: string): EvidenceRecord[] {
  const root = dbRepo.getEvidence(evidenceId);
  if (!root) return [];
  const all = dbRepo.listEvidence(root.missionId);
  const byId = new Map(all.map((e) => [e.id, e]));
  const chain: EvidenceRecord[] = [root];
  const queue = [...root.parentIds];
  const seen = new Set<string>([root.id]);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) {
      chain.push(node);
      queue.push(...node.parentIds);
    }
  }
  return chain;
}
