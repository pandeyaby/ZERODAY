/**
 * Palo Alto Cortex XSOAR — local incident-shaped JSON array for a customer mapper.
 *
 * Fields: type, name, occurred, severity, details, cwe, file_path.
 * XSOAR does NOT natively ingest SARIF.
 * Cortex Cloud AppSec can ingest SARIF but needs startLine — we omit rather than invent.
 * No live incident POST.
 */

import type { LocalizationResult } from "../types";
import { toInternalFindings, type InternalFinding } from "../findings";

export interface XsoarIncident {
  type: string;
  name: string;
  occurred: string;
  /** XSOAR severity scale 0–4; 0.5 informational / unknown triage */
  severity: number;
  details: string;
  cwe: string;
  file_path: string;
  advisory_id: string;
  rank: number;
  category: string;
  mode: string;
  model: string;
  file_f1: number;
  posture: string;
}

function toIncident(f: InternalFinding): XsoarIncident {
  return {
    type: "ZERODAY Antares Localization",
    name: `${f.cweId}: ${f.title}`.slice(0, 200),
    occurred: f.generatedAt,
    severity: 0.5,
    details: f.evidence.map((e) => e.note).join("; "),
    cwe: f.cweId,
    file_path: f.filePath,
    advisory_id: f.advisoryId,
    rank: f.rank,
    category: f.category,
    mode: f.mode,
    model: f.model,
    file_f1: f.modelFileF1,
    posture: "detector-candidate;localization-only;human-triage-required",
  };
}

export function toXsoar(result: LocalizationResult): XsoarIncident[] {
  return toInternalFindings(result).map(toIncident);
}

export function isValidXsoarShape(doc: unknown): boolean {
  if (!Array.isArray(doc)) return false;
  for (const e of doc) {
    if (!e || typeof e !== "object") return false;
    const x = e as Record<string, unknown>;
    for (const key of [
      "type",
      "name",
      "occurred",
      "severity",
      "details",
      "cwe",
      "file_path",
    ]) {
      if (x[key] == null) return false;
    }
    // Do not invent startLine for Cortex Cloud AppSec SARIF path
    if ("startLine" in x || "start_line" in x) return false;
  }
  return true;
}
