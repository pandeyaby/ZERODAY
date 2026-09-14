/**
 * Desk slice D — defensive plugins/skills craft.
 * Generate-only scaffolds from Desk B→A→C→E patterns.
 * No auto-install · no marketplace · refuses offensive/PoC skills.
 */

export type {
  CraftHabitStage,
  CraftScaffoldKind,
  CraftKindOption,
  CraftPatternSignal,
  CraftSourceRefs,
  CraftScaffoldFile,
  CraftReport,
  CraftWriteResult,
  CraftRefuseResult,
} from "./types";

export { CRAFT_HABIT_STAGES } from "./types";

export {
  craftRequestLooksOffensive,
  craftOffensiveMatch,
  refuseOffensiveCraft,
  CraftRefuseError,
  CRAFT_OFFENSIVE_REFUSAL,
} from "./refuse";

export {
  loadCraftSources,
  distillCraftPatterns,
  toCraftSourceRefs,
  relativeReportsLabel,
} from "./patterns";

export {
  craftScaffoldSlug,
  renderSkillMarkdown,
  renderPluginJson,
  renderPluginReadme,
  scaffoldRelativePaths,
} from "./templates";

export { toCraftMarkdown, toCraftReadme } from "./summary";

export {
  buildCraftReport,
  writeCraftReport,
  defaultCraftReportsDir,
  DEFAULT_CRAFT_NAME,
  type BuildCraftOptions,
} from "./generate";
