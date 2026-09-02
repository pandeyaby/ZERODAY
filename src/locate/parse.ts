/**
 * Parse CWE / CVE / GHSA advisory identifiers (sync).
 * CVE/GHSA → CWE uses vendored map; async NVD/GHSA resolve lives in resolve.ts.
 */

import type { AdvisoryRef } from "./types";
import {
  detectAdvisoryKind,
  normalizeAdvisoryId,
  type AdvisoryKind,
} from "./advisory-id";
import { resolveAdvisorySync, loadVendoredMap } from "./resolve";

export { detectAdvisoryKind, normalizeAdvisoryId };
export type { AdvisoryKind };

export function parseAdvisory(raw: string): AdvisoryRef {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Advisory id is required (CWE-…, CVE-…, or GHSA-…).");
  }
  const resolved = resolveAdvisorySync(trimmed);
  return {
    kind: resolved.kind,
    id: resolved.id,
    cweId: resolved.cweId,
    title: resolved.title,
  };
}

/** Normalize GHSA casing in the returned id */
export function parseAdvisorySafe(raw: string): AdvisoryRef {
  const ref = parseAdvisory(raw);
  if (ref.kind === "ghsa") {
    return { ...ref, id: ref.id.toLowerCase() };
  }
  return ref;
}

export function listFixtureAdvisories(): string[] {
  return Object.keys(loadVendoredMap().advisories);
}
