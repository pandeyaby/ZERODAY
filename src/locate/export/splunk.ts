/**
 * Splunk CIM Vulnerabilities — local JSON only.
 *
 * CIM fields: dest, dvc, signature, severity (critical|high|medium|informational|low),
 * category, xref (CWE), signature_id, vendor_product.
 * cve / cvss only when a real CVE was the advisory input — never invent.
 *
 * Recommend sourcetype `zeroday:antares:json` for a CUSTOMER TA.
 * Do not emit ES Notable JSON (no create-notable ingest schema).
 * No live Splunk push.
 *
 * Docs: https://docs.splunk.com/Documentation/CIM/6.0.0/User/Vulnerabilities
 */

import type { LocalizationResult } from "../types";
import { toInternalFindings, type InternalFinding } from "../findings";

export const SPLUNK_SOURCETYPE_RECOMMENDATION = "zeroday:antares:json";

export interface SplunkCimEvent {
  sourcetype: string;
  dest: string;
  dvc: string;
  signature: string;
  severity: "informational";
  category: string;
  xref: string;
  signature_id: string;
  vendor_product: string;
  /** Present only when advisory was a real CVE */
  cve?: string;
  /** Notable extras for customer ESCU / search — not ES Notable schema */
  cwe: string;
  file: string;
  evidence: string;
  advisory: string;
  mode: string;
  model: string;
  file_f1: number;
  time: string;
}

function toEvent(f: InternalFinding): SplunkCimEvent {
  const event: SplunkCimEvent = {
    sourcetype: SPLUNK_SOURCETYPE_RECOMMENDATION,
    dest: f.targetRepo,
    dvc: "zeroday-local",
    signature: f.title,
    severity: "informational",
    category: f.category,
    xref: f.cweId,
    signature_id: f.id,
    vendor_product: "ZERODAY Antares",
    cwe: f.cweId,
    file: f.filePath,
    evidence: f.evidence.map((e) => e.note).join("; "),
    advisory: f.advisoryId,
    mode: f.mode,
    model: f.model,
    file_f1: f.modelFileF1,
    time: f.generatedAt,
  };
  // cve only if real advisory input was CVE — never invent cvss
  if (f.cveId) event.cve = f.cveId;
  return event;
}

export function toSplunkCim(result: LocalizationResult): {
  sourcetype_recommendation: string;
  note: string;
  events: SplunkCimEvent[];
} {
  return {
    sourcetype_recommendation: SPLUNK_SOURCETYPE_RECOMMENDATION,
    note:
      "CIM Vulnerabilities projection for a customer TA. " +
      "Not ES Notable JSON. Configure props/transforms locally — ZERODAY does not push to Splunk.",
    events: toInternalFindings(result).map(toEvent),
  };
}

export function isValidSplunkShape(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as {
    events?: unknown;
    sourcetype_recommendation?: unknown;
  };
  if (d.sourcetype_recommendation !== SPLUNK_SOURCETYPE_RECOMMENDATION) {
    return false;
  }
  if (!Array.isArray(d.events)) return false;
  for (const e of d.events) {
    if (!e || typeof e !== "object") return false;
    const x = e as Record<string, unknown>;
    for (const key of [
      "dest",
      "dvc",
      "signature",
      "severity",
      "category",
      "xref",
      "signature_id",
      "vendor_product",
    ]) {
      if (x[key] == null) return false;
    }
    if (x.severity !== "informational") return false;
    // Must not invent cvss
    if ("cvss" in x) return false;
  }
  return true;
}
