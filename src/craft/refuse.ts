/**
 * Desk D — refuse offensive / PoC / attack skill or plugin requests.
 * Generate-only defensive scaffolds; never encode exploit habits.
 */

import { checkNoExploitInvariant } from "../locate/invariant";
import type { CraftRefuseResult } from "./types";

export const CRAFT_OFFENSIVE_REFUSAL =
  "ZERODAY craft refuses exploits, PoCs, and attack skill/plugin scaffolds — " +
  "defensive localization habits only (inventory→locate→packet→harden→classify).";

/** Extra offensive skill/plugin naming patterns beyond the shared no-exploit invariant. */
const OFFENSIVE_CRAFT_PATTERNS: Array<{ id: string; re: RegExp }> = [
  {
    id: "attack-skill",
    re: /\b((?:attack|offensive|adversary)[-\s]?(?:skill|plugin|kit|pack|procedure|playbook)|red[-\s]?team[-\s]?(?:skill|plugin|kit|pack)?|kill[-\s]?chain|weaponiz\w*|exploit(?:ation)?(?:[-\s]?(?:skill|plugin|kit|code|script))?|payload[-\s]?(?:skill|plugin|dropper)?|shellcode|malware|ransomware|\bc2\b|c&c|backdoor|rootkit)\b/i,
  },
  {
    id: "poc-skill",
    re: /\b(proof[-\s]?of[-\s]?concept|\bpoc\b|write[-\s]?up\s+exploit|exploit\s+kit)\b/i,
  },
  {
    id: "jailbreak-skill",
    re: /\b(jailbreak|prompt[-\s]?injection\s+pack|bypass\s+(?:guard|safety|filter))\b/i,
  },
  {
    id: "auto-publish",
    re: /\b(auto[-\s]?publish|marketplace\s+publish|publish\s+to\s+(?:marketplace|store)|auto[-\s]?install\s+(?:into|to)\s+(?:cursor|grok))\b/i,
  },
];

/**
 * True when free-text (name / intent / kind label) looks like an offensive craft request.
 */
export function craftRequestLooksOffensive(text: string): boolean {
  const t = text?.trim() ?? "";
  if (!t) return false;
  if (checkNoExploitInvariant([t]).length > 0) return true;
  for (const rule of OFFENSIVE_CRAFT_PATTERNS) {
    if (rule.re.test(t)) return true;
  }
  return false;
}

/**
 * First matched offensive token/sample for operator-facing refuse messages.
 */
export function craftOffensiveMatch(text: string): string | null {
  const t = text?.trim() ?? "";
  if (!t) return null;
  const inv = checkNoExploitInvariant([t]);
  if (inv[0]?.sample) return inv[0].sample;
  for (const rule of OFFENSIVE_CRAFT_PATTERNS) {
    const m = t.match(rule.re);
    if (m) return m[0];
  }
  return null;
}

/**
 * Refuse offensive craft requests. Returns a structured refuse result (never throws).
 */
export function refuseOffensiveCraft(
  texts: Array<string | undefined | null>,
): CraftRefuseResult | null {
  for (const text of texts) {
    if (!text) continue;
    if (!craftRequestLooksOffensive(text)) continue;
    const matched = craftOffensiveMatch(text) ?? "offensive-pattern";
    return {
      refused: true,
      reason: "offensive_skill_or_plugin_pattern",
      matched,
      message: `${CRAFT_OFFENSIVE_REFUSAL} Matched: ${matched}`,
    };
  }
  return null;
}

export class CraftRefuseError extends Error {
  readonly refuse: CraftRefuseResult;

  constructor(refuse: CraftRefuseResult) {
    super(refuse.message);
    this.name = "CraftRefuseError";
    this.refuse = refuse;
  }
}
