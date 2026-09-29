/**
 * `report.json` format id. The JSON Schema is published at
 * docs/schemas/zeroday.report.v1.schema.json and is part of the stable surface
 * (docs/stability.md): fields may be added, existing fields are not removed or
 * retyped within v1.
 */
export const REPORT_SCHEMA = "zeroday.report/v1" as const;

/** Serialize a report with its format id first. */
export function reportJson(report: object): string {
  return JSON.stringify({ schema: REPORT_SCHEMA, ...report }, null, 2);
}
