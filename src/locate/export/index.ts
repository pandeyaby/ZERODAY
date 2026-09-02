/**
 * Defender exporters — project LocalizationResult → local files only.
 * Never call vendor clouds. Never invent CVEs, CVSS, line numbers, or exploit flags.
 *
 * Formats:
 *   sarif | asff | splunk | xsoar | fortisiem | crowdstrike
 */

import fs from "node:fs";
import path from "node:path";
import type { LocalizationResult } from "../types";
import { toSarif } from "../sarif";
import { toAsff, isValidAsffShape } from "./asff";
import { toSplunkCim, isValidSplunkShape } from "./splunk";
import { toXsoar, isValidXsoarShape } from "./xsoar";
import { toFortisiem, isValidFortisiemShape } from "./fortisiem";
import {
  toCrowdstrikeNdjson,
  isValidCrowdstrikeNdjson,
} from "./crowdstrike";

export type ExportFormat =
  | "sarif"
  | "asff"
  | "splunk"
  | "xsoar"
  | "fortisiem"
  | "crowdstrike";

export const EXPORT_FORMATS: ExportFormat[] = [
  "sarif",
  "asff",
  "splunk",
  "xsoar",
  "fortisiem",
  "crowdstrike",
];

export interface ExportWriteResult {
  format: ExportFormat;
  path: string;
  bytes: number;
}

export function defaultExportFilename(format: ExportFormat): string {
  switch (format) {
    case "sarif":
      return "report.sarif";
    case "asff":
      return "asff-findings.json";
    case "splunk":
      return "splunk-cim-vulnerabilities.json";
    case "xsoar":
      return "xsoar-incidents.json";
    case "fortisiem":
      return "fortisiem-custom.json";
    case "crowdstrike":
      return "crowdstrike-hec-events.ndjson";
  }
}

export function renderExport(
  result: LocalizationResult,
  format: ExportFormat,
  opts?: { awsAccountId?: string; region?: string },
): string {
  switch (format) {
    case "sarif":
      return JSON.stringify(toSarif(result), null, 2);
    case "asff":
      return JSON.stringify(
        toAsff(result, {
          awsAccountId: opts?.awsAccountId,
          region: opts?.region,
        }),
        null,
        2,
      );
    case "splunk":
      return JSON.stringify(toSplunkCim(result), null, 2);
    case "xsoar":
      return JSON.stringify(toXsoar(result), null, 2);
    case "fortisiem":
      return JSON.stringify(toFortisiem(result), null, 2);
    case "crowdstrike":
      return toCrowdstrikeNdjson(result);
    default: {
      const _e: never = format;
      throw new Error(`Unknown export format: ${_e}`);
    }
  }
}

export function writeExport(
  result: LocalizationResult,
  format: ExportFormat,
  outputPath: string,
  opts?: { awsAccountId?: string; region?: string },
): ExportWriteResult {
  const body = renderExport(result, format, opts);
  const abs = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return { format, path: abs, bytes: Buffer.byteLength(body) };
}

/** Write all defender formats beside an existing report.json */
export function writeAllExports(
  result: LocalizationResult,
  outputDir: string,
  opts?: { awsAccountId?: string; region?: string },
): ExportWriteResult[] {
  const out: ExportWriteResult[] = [];
  for (const format of EXPORT_FORMATS) {
    out.push(
      writeExport(
        result,
        format,
        path.join(outputDir, defaultExportFilename(format)),
        opts,
      ),
    );
  }
  return out;
}

export {
  toAsff,
  isValidAsffShape,
  toSplunkCim,
  isValidSplunkShape,
  toXsoar,
  isValidXsoarShape,
  toFortisiem,
  isValidFortisiemShape,
  toCrowdstrikeNdjson,
  isValidCrowdstrikeNdjson,
};
