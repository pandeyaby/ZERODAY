/**
 * Generic vulnerability categories derived from CWE (localization taxonomy).
 * Not attack recipes — used for routing / SIEM tags / CISO reports.
 */

const CWE_CATEGORY: Record<string, string> = {
  "CWE-22": "path-traversal",
  "CWE-78": "os-command-injection",
  "CWE-79": "xss",
  "CWE-89": "sql-injection",
  "CWE-94": "code-injection",
  "CWE-200": "information-exposure",
  "CWE-287": "authentication",
  "CWE-352": "csrf",
  "CWE-434": "unrestricted-upload",
  "CWE-502": "deserialization",
  "CWE-611": "xxe",
  "CWE-798": "hardcoded-credentials",
  "CWE-862": "missing-authorization",
  "CWE-918": "ssrf",
};

export function categoryForCwe(cweId: string): string {
  const key = cweId.toUpperCase().startsWith("CWE-")
    ? cweId.toUpperCase()
    : `CWE-${cweId}`;
  return CWE_CATEGORY[key] ?? "code-weakness";
}

export function mergeCategoryMap(
  extras?: Record<string, string>,
): Record<string, string> {
  return { ...CWE_CATEGORY, ...(extras ?? {}) };
}
