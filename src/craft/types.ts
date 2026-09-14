/**
 * Desk slice D — defensive plugins/skills craft (generate-only scaffolds).
 * Encodes inventory → locate → packet → harden → classify habits.
 * Never auto-install · never marketplace publish · never PoC / attack skills.
 */

/** Habit stages encoded into generated skills/plugins (B→A→C→E + locate). */
export type CraftHabitStage =
  | "inventory"
  | "locate"
  | "packet"
  | "harden"
  | "classify";

export const CRAFT_HABIT_STAGES: CraftHabitStage[] = [
  "inventory",
  "locate",
  "packet",
  "harden",
  "classify",
];

export type CraftScaffoldKind = "skill" | "plugin";

export type CraftKindOption = CraftScaffoldKind | "both";

/** Pattern signal distilled from Desk B/A/C/E reports (evidence-backed only). */
export interface CraftPatternSignal {
  id: string;
  stage: CraftHabitStage;
  /** Short defensive habit line — never attack steps */
  habit: string;
  evidenceKind?: string;
  evidencePath?: string;
  sourceArtifact: string;
}

export interface CraftSourceRefs {
  reportsDir: string;
  inventoryJson: string | null;
  packetJson: string | null;
  hardenJson: string | null;
  classifyJson: string | null;
  findingsJson: string | null;
  caseNote: string | null;
  sarifPaths: string[];
}

export interface CraftScaffoldFile {
  kind: CraftScaffoldKind;
  name: string;
  relativePath: string;
  title: string;
}

export interface CraftReport {
  schemaVersion: "zeroday-craft-scaffold/v1";
  desk: "D";
  generatedAt: string;
  name: string;
  kind: CraftKindOption;
  source: CraftSourceRefs;
  patterns: CraftPatternSignal[];
  scaffolds: CraftScaffoldFile[];
  refused: false;
  posture: {
    generateOnly: true;
    noAutoInstall: true;
    noMarketplacePublish: true;
    noPoC: true;
    refusesOffensive: true;
    secretsRedacted: true;
    needsHuman: true;
    localizationOnly: true;
    habitsEncoded: true;
  };
}

export interface CraftWriteResult {
  report: CraftReport;
  outputDir: string;
  craftJsonPath: string;
  craftMdPath: string;
  readmePath: string;
  skillPaths: string[];
  pluginPaths: string[];
}

export interface CraftRefuseResult {
  refused: true;
  reason: string;
  matched: string;
  message: string;
}
