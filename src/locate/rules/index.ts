/**
 * Rules locate — thin in-repo CWE heuristics (Keyless K1).
 *
 * Explicit mode: "rules". No Semgrep binary, no Antares, no network, no Docker.
 * Honest: not Antares File F1; localization ≠ exploitability.
 */

import path from "node:path";
import type { AdvisoryRef, LocalizationResult, TraceStep } from "../types";
import { walkSourceFiles } from "./walk";
import { hitsToRankedFiles, scanRepoForCwe89 } from "./cwe-89";
import { scanRepoForCwe79 } from "./cwe-79";
import { scanRepoForCwe22 } from "./cwe-22";

export const RULES_MODEL_ID = "zeroday/rules-heuristics";

/** CWEs with a thin rules pack. Anything else is reported as not scanned. */
export const RULES_SUPPORTED_CWES = ["CWE-89", "CWE-79", "CWE-22"] as const;

const HONEST_WARNINGS = [
  "Rules mode: thin in-repo CWE heuristics — not Antares inference and not Antares File F1.",
  "Localization only: ranked files are candidates for human review — not proof of exploitability.",
  "No Semgrep binary dependency; network=none; Docker not required (CI-safe).",
  "No PoC / exploit / payload content is emitted.",
];

function normalizeCwe(cweId: string): string {
  const m = String(cweId).match(/CWE-?(\d{1,4})/i);
  return m ? `CWE-${m[1]}` : cweId.toUpperCase();
}

/**
 * Run allowlisted heuristics against a local repo (or snapshot path).
 */
export function runRulesLocalization(
  advisory: AdvisoryRef,
  targetRepo: string,
): LocalizationResult {
  const cweId = normalizeCwe(advisory.cweId);
  const root = path.resolve(targetRepo);
  const { files, skipped, warnings: walkWarnings } = walkSourceFiles(root);

  const explorationTrace: TraceStep[] = [];
  let unsupportedCwe = false;
  let rankedFiles = hitsToRankedFiles([], cweId);
  const warnings: string[] = [...HONEST_WARNINGS, ...walkWarnings];

  if (skipped > 0) {
    warnings.push(`Skipped ${skipped} oversized or unreadable source file(s).`);
  }

  if (cweId === "CWE-89") {
    const { hits, trace } = scanRepoForCwe89(files);
    explorationTrace.push(...trace);
    rankedFiles = hitsToRankedFiles(hits, cweId);
    for (const h of hits.slice(0, 8)) {
      explorationTrace.push({
        step: explorationTrace.length + 1,
        tool: "grep",
        command: `rules-hit ${h.ruleId} ${h.filePath}:${h.startLine}`,
        summary: `${h.title} @ ${h.filePath}:${h.startLine}`,
      });
    }
  } else if (cweId === "CWE-79") {
    const { hits, trace } = scanRepoForCwe79(files);
    explorationTrace.push(...trace);
    rankedFiles = hitsToRankedFiles(hits, cweId);
    for (const h of hits.slice(0, 8)) {
      explorationTrace.push({
        step: explorationTrace.length + 1,
        tool: "grep",
        command: `rules-hit ${h.ruleId} ${h.filePath}:${h.startLine}`,
        summary: `${h.title} @ ${h.filePath}:${h.startLine}`,
      });
    }
  } else if (cweId === "CWE-22") {
    const { hits, trace } = scanRepoForCwe22(files);
    explorationTrace.push(...trace);
    rankedFiles = hitsToRankedFiles(hits, cweId);
    for (const h of hits.slice(0, 8)) {
      explorationTrace.push({
        step: explorationTrace.length + 1,
        tool: "grep",
        command: `rules-hit ${h.ruleId} ${h.filePath}:${h.startLine}`,
        summary: `${h.title} @ ${h.filePath}:${h.startLine}`,
      });
    }
  } else {
    unsupportedCwe = true;
    explorationTrace.push({
      step: 1,
      tool: "other",
      command: "rules:unsupported-cwe",
      summary: `No rules pack for ${cweId}; repo NOT scanned for it (not a clean negative).`,
    });
    warnings.push(
      `NOT SCANNED: no rules heuristics registered for ${cweId}. ` +
        `Supported: ${RULES_SUPPORTED_CWES.join(", ")}. Zero findings is not a clean negative.`,
    );
  }

  explorationTrace.push({
    step: explorationTrace.length + 1,
    tool: "submit",
    command: "submit_vulnerable_files",
    summary:
      rankedFiles.length > 0
        ? `Submitted ${rankedFiles.length} ranked file(s) from rules heuristics.`
        : unsupportedCwe
          ? `Not scanned: no rules for ${cweId}.`
          : "No ranked files from rules heuristics (not a claim of cleanliness).",
  });

  return {
    mode: "rules",
    advisory,
    targetRepo: root,
    model: RULES_MODEL_ID,
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
      ...(unsupportedCwe ? { unsupportedCwe: true } : {}),
      terminalCallBudget: explorationTrace.length,
      terminalCallsUsed: explorationTrace.length,
    },
  };
}

export { walkSourceFiles } from "./walk";
export { scanRepoForCwe89, hitsToRankedFiles } from "./cwe-89";
