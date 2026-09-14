/**
 * Desk D — Cursor/Grok-style SKILL.md + plugin stub templates.
 * Defensive habits only; generate-only (no auto-install / marketplace).
 */

import type { CraftPatternSignal, CraftScaffoldKind } from "./types";
import { CRAFT_HABIT_STAGES } from "./types";

export interface CraftTemplateInput {
  name: string;
  patterns: CraftPatternSignal[];
  generatedAt: string;
  sourceLabel: string;
}

function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "zeroday-defensive-operator";
}

export function craftScaffoldSlug(name: string): string {
  return slugify(name);
}

function habitsByStage(
  patterns: CraftPatternSignal[],
): Record<string, CraftPatternSignal[]> {
  const map: Record<string, CraftPatternSignal[]> = {};
  for (const stage of CRAFT_HABIT_STAGES) map[stage] = [];
  for (const p of patterns) {
    (map[p.stage] ??= []).push(p);
  }
  return map;
}

/**
 * Cursor / Grok-style SKILL.md encoding inventory→locate→packet→harden→classify.
 */
export function renderSkillMarkdown(input: CraftTemplateInput): string {
  const slug = slugify(input.name);
  const byStage = habitsByStage(input.patterns);
  const lines: string[] = [];

  lines.push("---");
  lines.push(`name: ${slug}`);
  lines.push(
    "description: Defensive ZERODAY operator habits — inventory → locate → packet → harden → classify. Localization only; no PoC / exploit / attack skills. Generate-only scaffold — human installs manually.",
  );
  lines.push("metadata:");
  lines.push("  desk: D");
  lines.push('  schema: zeroday-craft-scaffold/v1');
  lines.push("  posture: defensive-generate-only");
  lines.push("---");
  lines.push("");
  lines.push(`# ${input.name}`);
  lines.push("");
  lines.push(
    "> **Defensive localization skill.** Encode Desk B→A→C→E habits. " +
      "No PoC / exploit / payload. Never write attack procedures. " +
      "Localization ≠ exploitability. Always `needs_human: true`.",
  );
  lines.push("");
  lines.push("## When to use");
  lines.push("");
  lines.push(
    "Authorized operator assessing a local repo they may access — keyless ZERODAY path. " +
      "Do **not** use this skill for offensive research, red-team kits, jailbreak packs, or exploit write-ups.",
  );
  lines.push("");
  lines.push("## Habit loop (inventory → locate → packet → harden → classify)");
  lines.push("");

  const stageTitles: Record<string, string> = {
    inventory: "1. Inventory (Desk B)",
    locate: "2. Locate / operate",
    packet: "3. Packet (Desk A)",
    harden: "4. Harden (Desk C)",
    classify: "5. Classify (Desk E)",
  };
  const stageCmds: Record<string, string> = {
    inventory:
      "`npm run zeroday -- inventory` (cwd / `--repo`; `--fixture` for smoke)",
    locate:
      "`npm run zeroday -- operate --cwe CWE-89 --fixture` or `locate --fixture` (localize — not Desk)",
    packet: "`npm run zeroday -- packet` (or `--from` / `--fixture`)",
    harden: "`npm run zeroday -- harden` (or `--from` / `--fixture`)",
    classify: "`npm run zeroday -- classify --from <dir>` or `--fixture`",
  };

  for (const stage of CRAFT_HABIT_STAGES) {
    lines.push(`### ${stageTitles[stage]}`);
    lines.push("");
    lines.push(`Command cue: ${stageCmds[stage]}`);
    lines.push("");
    for (const p of (byStage[stage] ?? []).slice(0, 6)) {
      lines.push(`- ${p.habit}`);
    }
    lines.push("");
  }

  lines.push("## Allowed tools");
  lines.push("");
  lines.push("- list / grep / read inside the authorized snapshot or repo only");
  lines.push("- write `submission.json` / craft scaffolds when the operator asks");
  lines.push("");
  lines.push("## Forbidden");
  lines.push("");
  lines.push("- No PoC / exploit / payload; no attack procedures; no network scans; no credential theft");
  lines.push("- Auto-merge, auto-apply harden, auto-post packet, auto-remediate classify");
  lines.push("- Auto-install this skill into Cursor / Grok Bot or marketplace publish");
  lines.push("- Offensive / red-team / jailbreak skill patterns");
  lines.push("");
  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Generate-only scaffold — human copies files if they want them installed");
  lines.push("- Secrets: names/patterns only; values never exported");
  lines.push("- `npm run mvp` / `inventory` / `packet` / `harden` / `classify` remain unchanged by craft");
  lines.push("");
  lines.push(`_Source patterns: \`${input.sourceLabel}\` · generated ${input.generatedAt}_`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Plugin stub manifest (Cursor/Grok-style) — generate only, no auto-install.
 */
export function renderPluginJson(input: CraftTemplateInput): string {
  const slug = slugify(input.name);
  const habitSummary = CRAFT_HABIT_STAGES.map((s) => s).join(" → ");
  const body = {
    schemaVersion: "zeroday-craft-plugin-stub/v1",
    name: slug,
    displayName: input.name,
    description:
      "Defensive ZERODAY operator plugin stub. Encodes inventory→locate→packet→harden→classify. Generate-only — do not auto-install or marketplace-publish.",
    desk: "D",
    skills: [`skills/${slug}/SKILL.md`],
    habits: habitSummary,
    patternCount: input.patterns.length,
    source: input.sourceLabel,
    generatedAt: input.generatedAt,
    posture: {
      generateOnly: true,
      noAutoInstall: true,
      noMarketplacePublish: true,
      noPoC: true,
      refusesOffensive: true,
      needsHuman: true,
      localizationOnly: true,
    },
    installHint:
      "Human copies this folder manually into an agent plugin directory if desired. Craft never auto-installs.",
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

export function renderPluginReadme(input: CraftTemplateInput): string {
  const slug = slugify(input.name);
  return [
    `# ${input.name} (plugin stub)`,
    "",
    "Desk D **generate-only** plugin stub. Encodes defensive ZERODAY habits.",
    "",
    "## Contents",
    "",
    "| File | Role |",
    "|------|------|",
    "| `plugin.json` | Stub manifest (`zeroday-craft-plugin-stub/v1`) |",
    `| \`../skills/${slug}/SKILL.md\` | Linked Cursor/Grok-style skill |`,
    "| `README.md` | This file |",
    "",
    "## Manual install (human only)",
    "",
    "1. Review `plugin.json` + linked `SKILL.md`.",
    "2. Copy into your local agent plugin/skills directory **only if** you choose to.",
    "3. Do **not** marketplace-publish from this scaffold.",
    "",
    "## Hard limits",
    "",
    "- **No** auto-install into Cursor / Grok Bot",
    "- **No** marketplace publish",
    "- No PoC / exploit / attack skills",
    "- Localization + evidence habits only",
    "",
    `_Generated from \`${input.sourceLabel}\` · ${input.generatedAt}_`,
    "",
  ].join("\n");
}

export function scaffoldRelativePaths(
  name: string,
  kind: CraftScaffoldKind,
): string[] {
  const slug = slugify(name);
  if (kind === "skill") {
    return [`skills/${slug}/SKILL.md`];
  }
  return [
    `plugins/${slug}/plugin.json`,
    `plugins/${slug}/README.md`,
  ];
}
