/**
 * Fortinet FortiSIEM — generic JSON for a customer XML parser / rawupload.
 *
 * Keys: vendor, model, eventType, severity, cwe, filePath, title, description, occurred.
 * No official finding schema. No live /rawupload.
 * Do not claim PH_DEV_MON_CUSTOM_JSON as ours.
 */

import type { LocalizationResult } from "../types";
import { toInternalFindings, type InternalFinding } from "../findings";

export interface FortisiemEvent {
  vendor: string;
  model: string;
  eventType: string;
  severity: string;
  cwe: string;
  filePath: string;
  title: string;
  description: string;
  occurred: string;
  category: string;
  advisoryId: string;
  rank: number;
  file_f1: number;
  posture: string;
}

function toEvent(f: InternalFinding): FortisiemEvent {
  return {
    vendor: "ZERODAY",
    model: f.model,
    eventType: "VulnerabilityLocalization",
    severity: "Informational",
    cwe: f.cweId,
    filePath: f.filePath,
    title: f.title,
    description: f.evidence.map((e) => e.note).join("; "),
    occurred: f.generatedAt,
    category: f.category,
    advisoryId: f.advisoryId,
    rank: f.rank,
    file_f1: f.modelFileF1,
    posture: "detector-candidate;localization-only",
  };
}

export function toFortisiem(result: LocalizationResult): {
  note: string;
  events: FortisiemEvent[];
} {
  return {
    note:
      "Generic JSON for a customer FortiSIEM parser or rawupload configuration. " +
      "ZERODAY does not ship an official FortiSIEM finding schema and does not call /rawupload.",
    events: toInternalFindings(result).map(toEvent),
  };
}

export function isValidFortisiemShape(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as { events?: unknown };
  if (!Array.isArray(d.events)) return false;
  for (const e of d.events) {
    if (!e || typeof e !== "object") return false;
    const x = e as Record<string, unknown>;
    for (const key of [
      "vendor",
      "model",
      "eventType",
      "severity",
      "cwe",
      "filePath",
      "title",
      "description",
      "occurred",
    ]) {
      if (x[key] == null) return false;
    }
    if ("PH_DEV_MON_CUSTOM_JSON" in x) return false;
  }
  return true;
}
