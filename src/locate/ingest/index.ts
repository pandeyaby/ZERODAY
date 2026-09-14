/**
 * SARIF ingest locate — Keyless K2.
 *
 * Explicit mode: "ingest". Local file path only. No Antares, no rules engine,
 * no GitHub alerts API / network fetch. Honest: third-party findings, not
 * Antares/rules discovery; localization ≠ exploitability.
 */

import path from "node:path";
import type { AdvisoryRef, LocalizationResult, TraceStep } from "../types";
import {
  findingsToRankedFiles,
  parseSarifFile,
  type ParseSarifResult,
} from "./parse-sarif";

export const INGEST_MODEL_ID = "zeroday/sarif-ingest";

const HONEST_WARNINGS = [
  "Ingest mode: third-party SARIF findings (CodeQL / Semgrep / generic SARIF 2.1) — not Antares inference and not rules discovery.",
  "Localization only: ranked files are candidates for human review — not proof of exploitability.",
  "File-path ingest only — no GitHub Code Scanning / Dependabot / alerts API network fetch in this door.",
  "No PoC / exploit / payload content is emitted.",
];

export interface IngestLocateOptions {
  sarifPath: string;
  /** Optional CWE filter (e.g. CWE-89) — keeps only matching mapped findings */
  cweFilter?: string | null;
  /** Label for targetRepo in the LocalizationResult */
  targetRepo?: string;
  /** Advisory metadata for the report (caller resolves / synthesizes) */
  advisory: AdvisoryRef;
}

/**
 * Ingest a local SARIF file into LocalizationResult (mode=ingest).
 */
export function runIngestLocalization(
  opts: IngestLocateOptions,
): LocalizationResult {
  const sarifPath = path.resolve(opts.sarifPath);
  const parsed: ParseSarifResult = parseSarifFile(sarifPath);
  const { rankedFiles, warnings: rankWarnings } = findingsToRankedFiles(
    parsed.findings,
    { cweFilter: opts.cweFilter },
  );

  const warnings: string[] = [
    ...HONEST_WARNINGS,
    ...parsed.warnings,
    ...rankWarnings,
  ];

  if (parsed.toolNames.length) {
    warnings.push(
      `Source tool(s): ${parsed.toolNames.join(", ")} (third-party — not ZERODAY discovery).`,
    );
  }
  if (parsed.resultCount === 0) {
    warnings.push(
      "SARIF contained zero results — empty localization (not a claim of cleanliness).",
    );
  }

  const explorationTrace: TraceStep[] = [
    {
      step: 1,
      tool: "other",
      command: `ingest:parse-sarif ${sarifPath}`,
      summary: `Parsed ${parsed.resultCount} SARIF result(s) from local file (version ${parsed.version ?? "unknown"}).`,
    },
    {
      step: 2,
      tool: "other",
      command: opts.cweFilter
        ? `ingest:filter ${opts.cweFilter}`
        : "ingest:filter none",
      summary: opts.cweFilter
        ? `Optional CWE filter ${opts.cweFilter} applied.`
        : "No CWE filter — all parseable results considered.",
    },
  ];

  for (const f of rankedFiles.slice(0, 12)) {
    explorationTrace.push({
      step: explorationTrace.length + 1,
      tool: "other",
      command: `ingest-hit ${f.filePath}`,
      summary: `${f.title} @ ${f.filePath}`,
    });
  }

  explorationTrace.push({
    step: explorationTrace.length + 1,
    tool: "submit",
    command: "submit_vulnerable_files",
    summary:
      rankedFiles.length > 0
        ? `Submitted ${rankedFiles.length} ranked file(s) from SARIF ingest.`
        : "No ranked files from SARIF ingest (not a claim of cleanliness).",
  });

  const targetRepo = path.resolve(
    opts.targetRepo && opts.targetRepo.length > 0
      ? opts.targetRepo
      : path.dirname(sarifPath),
  );

  return {
    mode: "ingest",
    advisory: opts.advisory,
    targetRepo,
    model: INGEST_MODEL_ID,
    generatedAt: new Date().toISOString(),
    rankedFiles,
    explorationTrace,
    warnings,
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: rankedFiles.length,
      incompleteReason: null,
      terminalCallBudget: explorationTrace.length,
      terminalCallsUsed: explorationTrace.length,
    },
  };
}

export {
  parseSarifFile,
  parseSarifDocument,
  findingsToRankedFiles,
} from "./parse-sarif";
export { mapRuleToCwe, cwesFromTags } from "./cwe-map";
