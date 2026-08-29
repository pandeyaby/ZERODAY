/**
 * Parse CWE / CVE / GHSA advisory identifiers.
 */

import type { AdvisoryKind, AdvisoryRef } from "./types";

const CWE_RE = /^CWE-(\d{1,4})$/i;
const CVE_RE = /^CVE-(\d{4})-(\d{4,})$/i;
const GHSA_RE = /^GHSA-([a-z0-9]{4})-([a-z0-9]{4})-([a-z0-9]{4})$/i;

/** Known demo / fixture mappings — not a full NVD database. */
const FIXTURE_ADVISORY_MAP: Record<
  string,
  { cweId: string; title: string }
> = {
  "CWE-89": {
    cweId: "CWE-89",
    title: "Improper Neutralization of Special Elements used in an SQL Command",
  },
  "CVE-2024-89001": {
    cweId: "CWE-89",
    title: "Demo SQL injection advisory (fixture)",
  },
  "ghsa-demo-0000-sql1": {
    cweId: "CWE-89",
    title: "Demo GHSA mapped to CWE-89 (fixture)",
  },
  "CWE-79": {
    cweId: "CWE-79",
    title: "Improper Neutralization of Input During Web Page Generation (XSS)",
  },
  "CWE-22": {
    cweId: "CWE-22",
    title: "Improper Limitation of a Pathname to a Restricted Directory",
  },
  "CWE-78": {
    cweId: "CWE-78",
    title: "Improper Neutralization of Special Elements used in an OS Command",
  },
};

export function normalizeAdvisoryId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function detectAdvisoryKind(id: string): AdvisoryKind | null {
  const n = normalizeAdvisoryId(id);
  if (CWE_RE.test(n)) return "cwe";
  if (CVE_RE.test(n)) return "cve";
  // GHSA ids are lowercase by convention; re-check original
  if (GHSA_RE.test(id.trim()) || GHSA_RE.test(n.toLowerCase())) return "ghsa";
  return null;
}

export function parseAdvisory(raw: string): AdvisoryRef {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Advisory id is required (CWE-…, CVE-…, or GHSA-…).");
  }

  const kind = detectAdvisoryKind(trimmed);
  if (!kind) {
    throw new Error(
      `Unrecognized advisory '${raw}'. Expected CWE-NNN, CVE-YYYY-NNNN, or GHSA-xxxx-xxxx-xxxx.`,
    );
  }

  let id: string;
  if (kind === "cwe") {
    const m = trimmed.match(CWE_RE)!;
    id = `CWE-${m[1]}`;
  } else if (kind === "cve") {
    const m = trimmed.match(CVE_RE)!;
    id = `CVE-${m[1]}-${m[2]}`;
  } else {
    const m = trimmed.match(GHSA_RE) ?? trimmed.toLowerCase().match(GHSA_RE);
    if (!m) {
      throw new Error(`Invalid GHSA id '${raw}'.`);
    }
    id = `GHSA-${m[1]}-${m[2]}-${m[3]}`.toLowerCase();
  }

  const mapKey =
    kind === "ghsa" ? id.toLowerCase() : id;
  const mapped =
    FIXTURE_ADVISORY_MAP[mapKey] ??
    FIXTURE_ADVISORY_MAP[mapKey.toUpperCase()] ??
    (kind === "cwe"
      ? { cweId: id, title: undefined }
      : undefined);

  if (!mapped && kind !== "cwe") {
    // Live mode can still accept CVE/GHSA if the operator also passes --cwe,
    // but for the default path we require a known mapping or explicit CWE.
    throw new Error(
      `${id} is not in ZERODAY's built-in advisory→CWE map. ` +
        `Pass a CWE directly (e.g. --cwe CWE-89) or add a mapping for fixture demos. ` +
        `Antares itself queries by CWE.`,
    );
  }

  return {
    kind,
    id: kind === "ghsa" ? id : id.toUpperCase().replace(/^GHSA/, "GHSA"),
    cweId: mapped?.cweId ?? (kind === "cwe" ? id : "CWE-0"),
    title: mapped?.title,
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
  return Object.keys(FIXTURE_ADVISORY_MAP);
}
