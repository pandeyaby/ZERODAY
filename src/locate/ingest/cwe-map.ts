/**
 * Map common CodeQL / Semgrep / generic SARIF rule ids → CWE when known.
 * Honest: unknown rules keep ruleId + warning — never invents exploitability.
 */

export interface CweMapResult {
  cweIds: string[];
  /** True when at least one id came from a known mapping / explicit CWE tag */
  mapped: boolean;
  /** Rule id retained for evidence when unmapped */
  ruleId: string;
}

const RULE_ID_PATTERNS: Array<{ re: RegExp; cwe: string }> = [
  { re: /sql[-_]?injection|sqli\b|cwe[-_]?89\b/i, cwe: "CWE-89" },
  {
    re: /cross[-_]?site[-_]?script|xss\b|cwe[-_]?79\b|dom[-_]?based[-_]?xss/i,
    cwe: "CWE-79",
  },
  {
    re: /path[-_]?traversal|path[-_]?injection|directory[-_]?traversal|zip[-_]?slip|cwe[-_]?22\b/i,
    cwe: "CWE-22",
  },
  { re: /command[-_]?injection|os[-_]?command|cwe[-_]?78\b/i, cwe: "CWE-78" },
  {
    re: /code[-_]?injection|eval[-_]?injection|cwe[-_]?94\b/i,
    cwe: "CWE-94",
  },
  {
    re: /insecure[-_]?deserial|cwe[-_]?502\b/i,
    cwe: "CWE-502",
  },
  {
    re: /hardcoded[-_]?(password|credential|secret)|cwe[-_]?798\b/i,
    cwe: "CWE-798",
  },
  {
    re: /ssrf|server[-_]?side[-_]?request|cwe[-_]?918\b/i,
    cwe: "CWE-918",
  },
];

function normalizeCwe(raw: string): string | null {
  const m = String(raw).match(/CWE-?0*(\d{1,4})/i);
  if (!m) return null;
  return `CWE-${Number(m[1])}`;
}

/** Extract CWE ids from CodeQL-style tags: external/cwe/cwe-089 */
export function cwesFromTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const fromExternal = t.match(/external\/cwe\/cwe-?0*(\d{1,4})/i);
    if (fromExternal) {
      out.push(`CWE-${Number(fromExternal[1])}`);
      continue;
    }
    const n = normalizeCwe(t);
    if (n) out.push(n);
  }
  return [...new Set(out)];
}

function cwesFromProperties(props: Record<string, unknown> | undefined): string[] {
  if (!props) return [];
  const out: string[] = [];

  const push = (v: unknown) => {
    if (typeof v === "string") {
      const n = normalizeCwe(v);
      if (n) out.push(n);
    } else if (Array.isArray(v)) {
      for (const item of v) push(item);
    }
  };

  push(props.cwe);
  push(props.cweIds);
  push(props.cwe_ids);
  out.push(...cwesFromTags(props.tags));

  return [...new Set(out.filter((c) => /^CWE-\d+$/i.test(c)))];
}

/**
 * Resolve CWE ids for one SARIF result using rule metadata + ruleId heuristics.
 */
export function mapRuleToCwe(opts: {
  ruleId: string;
  resultProperties?: Record<string, unknown>;
  ruleProperties?: Record<string, unknown>;
}): CweMapResult {
  const ruleId = opts.ruleId || "unknown-rule";
  const fromProps = [
    ...cwesFromProperties(opts.resultProperties),
    ...cwesFromProperties(opts.ruleProperties),
  ];
  if (fromProps.length) {
    return { cweIds: [...new Set(fromProps)], mapped: true, ruleId };
  }

  const direct = normalizeCwe(ruleId);
  if (direct) {
    return { cweIds: [direct], mapped: true, ruleId };
  }

  for (const { re, cwe } of RULE_ID_PATTERNS) {
    if (re.test(ruleId)) {
      return { cweIds: [cwe], mapped: true, ruleId };
    }
  }

  return { cweIds: [], mapped: false, ruleId };
}
