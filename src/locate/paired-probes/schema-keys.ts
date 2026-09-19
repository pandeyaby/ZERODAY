/**
 * SCHEMAX — required LocalizationResult / SARIF schema keys (order-invariant).
 * Documented set; silent renames fail the violating control.
 */

/** Required keys on LocalizationResult (report.json telemetry). */
export const REQUIRED_RESULT_KEYS = [
  "mode",
  "advisory",
  "targetRepo",
  "model",
  "generatedAt",
  "rankedFiles",
  "explorationTrace",
  "warnings",
  "posture",
  "summary",
] as const;

/** Required nested posture keys (localization hard limits). */
export const REQUIRED_POSTURE_KEYS = [
  "localizationOnly",
  "notExploitProof",
  "noAutoMerge",
  "noPoC",
] as const;

/** Required SARIF top-level / run keys graded as schema. */
export const REQUIRED_SARIF_KEYS = [
  "$schema",
  "version",
  "runs",
  "runs.tool.driver.name",
  "runs.results",
  "runs.properties.mode",
  "runs.properties.posture",
] as const;

export const ALL_REQUIRED_SCHEMA_KEYS: string[] = [
  ...REQUIRED_RESULT_KEYS.map((k) => `result.${k}`),
  ...REQUIRED_POSTURE_KEYS.map((k) => `result.posture.${k}`),
  ...REQUIRED_SARIF_KEYS.map((k) => `sarif.${k}`),
];

export function collectPresentSchemaKeys(
  result: Record<string, unknown>,
  sarif: Record<string, unknown>,
): string[] {
  const present: string[] = [];
  for (const k of REQUIRED_RESULT_KEYS) {
    if (k in result) present.push(`result.${k}`);
  }
  const posture = result.posture as Record<string, unknown> | undefined;
  if (posture && typeof posture === "object") {
    for (const k of REQUIRED_POSTURE_KEYS) {
      if (k in posture) present.push(`result.posture.${k}`);
    }
  }
  for (const k of ["$schema", "version", "runs"] as const) {
    if (k in sarif) present.push(`sarif.${k}`);
  }
  const runs = sarif.runs as unknown[] | undefined;
  const run0 = runs?.[0] as Record<string, unknown> | undefined;
  if (run0) {
    const tool = run0.tool as { driver?: { name?: string } } | undefined;
    if (tool?.driver?.name) present.push("sarif.runs.tool.driver.name");
    if (Array.isArray(run0.results)) present.push("sarif.runs.results");
    const props = run0.properties as Record<string, unknown> | undefined;
    if (props && "mode" in props) present.push("sarif.runs.properties.mode");
    if (props && "posture" in props) present.push("sarif.runs.properties.posture");
  }
  return present.sort();
}

export function keySetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((k, i) => k === sb[i]);
}

/** Violating twin: drop or rename one required key from the present set. */
export function dropRequiredKey(keys: string[], which: string): string[] {
  return keys.filter((k) => k !== which).sort();
}

export function renameRequiredKey(
  keys: string[],
  from: string,
  to: string,
): string[] {
  return keys.map((k) => (k === from ? to : k)).sort();
}
