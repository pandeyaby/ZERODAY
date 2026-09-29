/** Validates a written report.json against the published zeroday.report/v1 schema. */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { REPORT_SCHEMA } from "../../src/locate/report-schema.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "docs/schemas/zeroday.report.v1.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
export const validateReport = ajv.compile(schema);

export function assertValidReport(jsonPath: string): Record<string, unknown> {
  const report = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Record<string, unknown>;
  assert.ok(validateReport(report), `${jsonPath}\n${ajv.errorsText(validateReport.errors, { separator: "\n" })}`);
  assert.equal(report.schema, REPORT_SCHEMA);
  assert.equal(Object.keys(report)[0], "schema", "format id is the first field");
  return report;
}
