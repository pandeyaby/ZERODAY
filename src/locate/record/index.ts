/**
 * Org CI cassette record + replay (Keyless K3).
 *
 *   zeroday record --from <locate-reports-dir> --out <cassette.json>
 *   zeroday locate --recording <cassette.json>
 *
 * --redact is default ON and fail-closed. Never auto-commit / network-exfil.
 */

import fs from "node:fs";
import path from "node:path";
import type { LocalizationResult } from "../types";
import {
  assertNoExploitInvariant,
  collectResultTexts,
} from "../invariant";
import {
  loadLocateReport,
  assertRecordableReport,
  buildRedactedCassette,
  RecordRefuseError,
} from "./redact";
import {
  type OrgCassette,
  type RecordOptions,
  ORG_CASSETTE_SCHEMA,
  HUMAN_REVIEW_NOTE,
} from "./types";

export {
  loadLocateReport,
  assertRecordableReport,
  buildRedactedCassette,
  RecordRefuseError,
};
export type { OrgCassette, RecordOptions };
export { ORG_CASSETTE_SCHEMA, HUMAN_REVIEW_NOTE };

export interface RecordArtifacts {
  cassette: OrgCassette;
  outPath: string;
  fromDir: string;
  reportPath: string;
  findingCount: number;
}

/**
 * Read locate report.json → redacted org cassette → write --out.
 * Redaction default ON; --no-redact / redact:false refuses closed.
 */
export function recordCassette(options: RecordOptions): RecordArtifacts {
  if (options.redact === false) {
    throw new RecordRefuseError(
      "record refused: --no-redact is not allowed for org CI cassettes. " +
        "Redaction is default ON and fail-closed (Keyless K3 / GRAX).",
    );
  }

  const { report, reportPath, fromDir } = loadLocateReport(options.from);
  assertRecordableReport(report);

  const cassette = buildRedactedCassette(report);

  assertNoExploitInvariant([
    ...collectResultTexts({
      rankedFiles: cassette.rankedFiles,
      explorationTrace: cassette.explorationTrace,
      warnings: cassette.warnings,
    }),
    cassette.humanReviewNote,
    JSON.stringify(cassette),
  ]);

  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(cassette, null, 2) + "\n");

  return {
    cassette,
    outPath,
    fromDir,
    reportPath,
    findingCount: cassette.rankedFiles.length,
  };
}

/** Load + validate an org cassette file for replay. */
export function loadOrgCassette(cassettePath: string): OrgCassette {
  const resolved = path.resolve(cassettePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Recording cassette not found: ${resolved}`);
  }
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch (e) {
    throw new Error(
      `Cannot read recording cassette: ${(e as Error).message}`,
    );
  }
  let cassette: OrgCassette;
  try {
    cassette = JSON.parse(raw) as OrgCassette;
  } catch {
    throw new Error(`Recording cassette is not valid JSON: ${resolved}`);
  }
  if (cassette.schemaVersion !== ORG_CASSETTE_SCHEMA) {
    throw new Error(
      `Unsupported cassette schema '${String(cassette.schemaVersion)}' ` +
        `(expected ${ORG_CASSETTE_SCHEMA}).`,
    );
  }
  if (cassette.redacted !== true) {
    throw new Error(
      "Recording cassette must have redacted: true. Refuse to replay unredacted cassettes.",
    );
  }
  if (!Array.isArray(cassette.rankedFiles) || cassette.rankedFiles.length === 0) {
    throw new Error(
      "Recording cassette missing rankedFiles — refuse incomplete cassette replay.",
    );
  }
  if (!cassette.advisory?.cweId) {
    throw new Error("Recording cassette missing advisory.cweId.");
  }
  return cassette;
}

/**
 * Replay an org cassette as LocalizationResult with honest mode: "recording".
 * Offline — no network, no Antares, no rules walk.
 */
export function runRecordingLocalization(
  cassette: OrgCassette,
  targetRepo?: string,
): LocalizationResult {
  return {
    mode: "recording",
    advisory: cassette.advisory,
    targetRepo: targetRepo
      ? path.resolve(targetRepo)
      : cassette.targetRepo || "<repo>",
    model: cassette.model,
    generatedAt: new Date().toISOString(),
    rankedFiles: cassette.rankedFiles,
    explorationTrace: cassette.explorationTrace,
    warnings: [
      ...(cassette.warnings ?? []),
      `Recording replay (Keyless K3): sourceMode=${cassette.sourceMode}; ` +
        `mode="recording" — redacted org cassette, not live/rules/ingest/fixture discovery.`,
      "Localization ≠ exploitability. Human review of findings still required.",
    ],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: cassette.rankedFiles.length,
      incompleteReason: null,
      incompleteClass: null,
      terminalCallBudget: cassette.summary?.terminalCallBudget ?? 0,
      terminalCallsUsed: cassette.summary?.terminalCallsUsed ?? 0,
    },
  };
}
