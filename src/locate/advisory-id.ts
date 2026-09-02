/**
 * Advisory id detection / normalization (no I/O).
 */

export type AdvisoryKind = "cwe" | "cve" | "ghsa";

const CWE_RE = /^CWE-(\d{1,4})$/i;
const CVE_RE = /^CVE-(\d{4})-(\d{4,})$/i;
const GHSA_RE = /^GHSA-([a-z0-9]{4})-([a-z0-9]{4})-([a-z0-9]{4})$/i;

export function normalizeAdvisoryId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function detectAdvisoryKind(id: string): AdvisoryKind | null {
  const n = normalizeAdvisoryId(id);
  if (CWE_RE.test(n)) return "cwe";
  if (CVE_RE.test(n)) return "cve";
  if (GHSA_RE.test(id.trim()) || GHSA_RE.test(n.toLowerCase())) return "ghsa";
  return null;
}

export function normalizeKindId(kind: AdvisoryKind, raw: string): string {
  const trimmed = raw.trim();
  if (kind === "cwe") {
    const m = trimmed.match(CWE_RE)!;
    return `CWE-${m[1]}`;
  }
  if (kind === "cve") {
    const m = trimmed.match(CVE_RE)!;
    return `CVE-${m[1]}-${m[2]}`;
  }
  const m =
    trimmed.match(GHSA_RE) ??
    trimmed.toLowerCase().match(GHSA_RE);
  if (!m) throw new Error(`Invalid GHSA id '${raw}'.`);
  return `GHSA-${m[1]}-${m[2]}-${m[3]}`.toLowerCase();
}
