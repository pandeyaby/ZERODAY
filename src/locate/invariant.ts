/**
 * Defensive invariants: ZERODAY never emits exploit / PoC / payload content.
 */

/** Phrases that mention forbidden topics only to refuse them — allow these. */
const DEFENSIVE_ALLOWLIST =
  /\b(not\s+(an?\s+)?(exploit|poc|payload)|not\s+an?\s+exploit\s+or\s+poc|no\s+(poc|exploit|payload)|never\s+(an?\s+)?(exploit|poc)|refuses?\s+exploits?,\s*pocs?|localization\s+only|not\s+proof\s+of\s+exploitability|not\s+exploit\s+proof|likelihood_of_exploit|noPoC|no_poc|offensive\s+demonstration\s+code\s+is\s+out\s+of\s+scope)\b/gi;

const FORBIDDEN_PATTERNS: { id: string; re: RegExp; hint: string }[] = [
  {
    id: "exploit-keyword",
    re: /\b((?:write|craft|build|generate|run|launch|deliver)\s+(?:an?\s+)?exploit|0-?day\s+exploit|weaponiz(?:e|ation)|exploit(?:ation)?\s+(?:code|script|kit|chain))\b/i,
    hint: "exploit-oriented language",
  },
  {
    id: "poc-keyword",
    re: /\b(proof[-\s]?of[-\s]?concept|\bpoc\b|shellcode|reverse\s+shell)\b/i,
    hint: "PoC / shellcode language",
  },
  {
    id: "payload-keyword",
    re: /\b((?:drop|inject|deliver|craft)\s+(?:\w+\s+){0,3}payload|malware\s+payload|exploit\s+payload)\b/i,
    hint: "payload delivery language",
  },
  {
    id: "attack-procedure",
    re: /\b(attack\s+procedure|how\s+to\s+exploit|steps?\s+to\s+exploit)\b/i,
    hint: "attack procedure language",
  },
  {
    id: "metasploit",
    re: /\b(metasploit|msfvenom|meterpreter)\b/i,
    hint: "offensive tooling reference",
  },
];

export interface InvariantViolation {
  id: string;
  hint: string;
  sample: string;
}

function scrubDefensiveCopy(text: string): string {
  return text.replace(DEFENSIVE_ALLOWLIST, " ");
}

/**
 * Scan free-text fields of a localization artifact for forbidden content.
 * Returns violations (empty = pass).
 */
export function checkNoExploitInvariant(
  texts: Array<string | undefined | null>,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  for (const text of texts) {
    if (!text) continue;
    const scrubbed = scrubDefensiveCopy(text);
    for (const rule of FORBIDDEN_PATTERNS) {
      const m = scrubbed.match(rule.re);
      if (m) {
        violations.push({
          id: rule.id,
          hint: rule.hint,
          sample: m[0],
        });
      }
    }
  }
  return violations;
}

export function assertNoExploitInvariant(
  texts: Array<string | undefined | null>,
): void {
  const v = checkNoExploitInvariant(texts);
  if (v.length > 0) {
    const detail = v.map((x) => `${x.id} (${x.sample})`).join(", ");
    throw new Error(
      `ZERODAY no-exploit invariant violated: ${detail}. ` +
        `Localization reports must not include exploits, PoCs, payloads, or attack procedures.`,
    );
  }
}

/** Collect all string fields from a LocalizationResult-like object for scanning. */
export function collectResultTexts(result: {
  rankedFiles: Array<{
    title: string;
    filePath: string;
    evidence: Array<{ note: string; excerpt?: string }>;
  }>;
  explorationTrace: Array<{ command: string; summary: string }>;
  warnings: string[];
}): string[] {
  const out: string[] = [...result.warnings];
  for (const f of result.rankedFiles) {
    out.push(f.title, f.filePath);
    for (const e of f.evidence) {
      out.push(e.note);
      if (e.excerpt) out.push(e.excerpt);
    }
  }
  for (const t of result.explorationTrace) {
    out.push(t.command, t.summary);
  }
  return out;
}
