/**
 * CrowdStrike LogScale / HEC — NDJSON event objects for customer HEC shipper.
 *
 * Fields: host, message, cwe, file_path, signature, severity, vendor, product.
 * Do NOT emit # CPS parser tags.
 * No live HEC push.
 */

import type { LocalizationResult } from "../types";
import { toInternalFindings, type InternalFinding } from "../findings";

export interface CrowdstrikeHecEvent {
  host: string;
  message: string;
  cwe: string;
  file_path: string;
  signature: string;
  severity: string;
  vendor: string;
  product: string;
  advisory_id: string;
  category: string;
  rank: number;
  mode: string;
  model: string;
  file_f1: number;
  time: string;
}

function toEvent(f: InternalFinding): CrowdstrikeHecEvent {
  return {
    host: "zeroday-local",
    message: `${f.cweId} localization candidate ${f.filePath}: ${f.evidence.map((e) => e.note).join("; ")}`,
    cwe: f.cweId,
    file_path: f.filePath,
    signature: f.title,
    severity: "informational",
    vendor: "ZERODAY",
    product: "ZERODAY Antares",
    advisory_id: f.advisoryId,
    category: f.category,
    rank: f.rank,
    mode: f.mode,
    model: f.model,
    file_f1: f.modelFileF1,
    time: f.generatedAt,
  };
}

/** Return events; caller serializes as NDJSON (one JSON object per line). */
export function toCrowdstrikeHec(
  result: LocalizationResult,
): CrowdstrikeHecEvent[] {
  return toInternalFindings(result).map(toEvent);
}

export function toCrowdstrikeNdjson(result: LocalizationResult): string {
  return toCrowdstrikeHec(result)
    .map((e) => JSON.stringify(e))
    .join("\n")
    .concat(toCrowdstrikeHec(result).length ? "\n" : "");
}

export function isValidCrowdstrikeNdjson(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    if (line.includes("#cps") || line.includes("# CPS") || line.startsWith("#")) {
      return false;
    }
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return false;
    }
    for (const key of [
      "host",
      "message",
      "cwe",
      "file_path",
      "signature",
      "severity",
      "vendor",
      "product",
    ]) {
      if (obj[key] == null) return false;
    }
  }
  return true;
}
