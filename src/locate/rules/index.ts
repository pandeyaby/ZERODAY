/**
 * Rules locate — keyless in-repo CWE analysis (Keyless K1).
 *
 * JS/TS, Python, Java and Go files go through the tree-sitter engine
 * (src/locate/engine: request-input → sink value tracking). Other source files
 * fall back to the thin line heuristics for CWE-89 / CWE-79 / CWE-22.
 *
 * Explicit mode: "rules". No Semgrep binary, no Antares, no network, no Docker.
 * Honest: not Antares File F1; localization ≠ exploitability.
 */

import fs from "node:fs";
import path from "node:path";
import type { AdvisoryRef, LocalizationResult, TraceStep } from "../types";
import { analyzeSource } from "../engine/analyze";
import { langForPath } from "../engine/grammar";
import { walkSourceFiles, type WalkedFile } from "./walk";
import { hitsToRankedFiles, scanRepoForCwe89, type RuleHit } from "./cwe-89";
import { scanRepoForCwe79 } from "./cwe-79";
import { scanRepoForCwe22 } from "./cwe-22";

export const RULES_MODEL_ID = "zeroday/rules-heuristics";

/** CWEs with rules. Anything else is reported as not scanned. */
export const RULES_SUPPORTED_CWES = [
  "CWE-89",
  "CWE-79",
  "CWE-22",
  "CWE-78",
  "CWE-94",
  "CWE-502",
  "CWE-918",
  "CWE-611",
  "CWE-798",
  "CWE-601",
] as const;

/** Languages the tree-sitter engine understands (by extension). */
export const RULES_ENGINE_LANGUAGES = ["JavaScript", "TypeScript", "Python", "Java", "Go"] as const;

/** Line-heuristic fallbacks for files the engine does not parse (Ruby, PHP, C#, SQL…). */
const FALLBACK: Record<string, (files: WalkedFile[]) => { hits: RuleHit[] }> = {
  "CWE-89": scanRepoForCwe89,
  "CWE-79": scanRepoForCwe79,
  "CWE-22": scanRepoForCwe22,
};

const HONEST_WARNINGS = [
  "Rules mode: in-repo syntax-tree analysis + heuristics — not Antares inference and not Antares File F1.",
  "Localization only: ranked files are candidates for human review — not proof of exploitability.",
  "No Semgrep binary dependency; network=none; Docker not required (CI-safe).",
  "No PoC / exploit / payload content is emitted.",
];

function normalizeCwe(cweId: string): string {
  const m = String(cweId).match(/CWE-?(\d{1,4})/i);
  return m ? `CWE-${m[1]}` : cweId.toUpperCase();
}

function excerpt(lines: string[], startLine: number, endLine: number): string {
  const from = Math.max(0, startLine - 2);
  const to = Math.min(lines.length, Math.max(endLine, startLine) + 1);
  return lines.slice(from, to).join("\n").slice(0, 400);
}

/** Run the tree-sitter engine over every file it can parse. */
async function runEngine(
  files: WalkedFile[],
  cweId: string,
): Promise<{ hits: RuleHit[]; parsed: number; failed: number }> {
  const hits: RuleHit[] = [];
  let parsed = 0;
  let failed = 0;
  const cwes = new Set([cweId]);
  for (const f of files) {
    const lang = langForPath(f.relPath);
    if (!lang) continue;
    let source: string;
    try {
      source = fs.readFileSync(f.absPath, "utf8");
    } catch {
      failed += 1;
      continue;
    }
    try {
      const found = await analyzeSource(lang, source, cwes);
      parsed += 1;
      if (found.length === 0) continue;
      const lines = source.split(/\r?\n/);
      for (const h of found) {
        hits.push({
          ruleId: h.ruleId,
          filePath: f.relPath,
          startLine: h.startLine,
          endLine: h.endLine,
          title: h.title,
          note: h.note,
          excerpt: excerpt(lines, h.startLine, h.endLine),
          score: h.score,
        });
      }
    } catch {
      failed += 1;
    }
  }
  return { hits, parsed, failed };
}

/**
 * Run rules against a local repo (or snapshot path).
 */
export async function runRulesLocalization(
  advisory: AdvisoryRef,
  targetRepo: string,
): Promise<LocalizationResult> {
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

  if ((RULES_SUPPORTED_CWES as readonly string[]).includes(cweId)) {
    explorationTrace.push({
      step: 1,
      tool: "find",
      command: "rules-walk source extensions",
      summary: `Rules walk listed ${files.length} source file(s).`,
    });

    const engine = await runEngine(files, cweId);
    explorationTrace.push({
      step: explorationTrace.length + 1,
      tool: "grep",
      command: `rules:engine ${cweId} (tree-sitter: JS/TS, Python, Java, Go)`,
      summary: `Parsed ${engine.parsed} file(s) and tracked request input to ${cweId} sinks.`,
    });
    if (engine.failed > 0) {
      warnings.push(`Rules engine could not analyze ${engine.failed} file(s) (unreadable or parse failure).`);
    }

    const hits = [...engine.hits];
    const fallback = FALLBACK[cweId];
    const otherFiles = files.filter((f) => !langForPath(f.relPath));
    if (fallback && otherFiles.length > 0) {
      hits.push(...fallback(otherFiles).hits);
      explorationTrace.push({
        step: explorationTrace.length + 1,
        tool: "grep",
        command: `rules:${cweId.toLowerCase()} line heuristics (other languages)`,
        summary: `Applied line heuristics to ${otherFiles.length} file(s) the engine does not parse.`,
      });
    }

    hits.sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));
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
        ? `Submitted ${rankedFiles.length} ranked file(s) from rules analysis.`
        : unsupportedCwe
          ? `Not scanned: no rules for ${cweId}.`
          : "No ranked files from rules analysis (not a claim of cleanliness).",
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

export { walkSourceFiles, readFileLines } from "./walk";
export { scanRepoForCwe89, hitsToRankedFiles } from "./cwe-89";
