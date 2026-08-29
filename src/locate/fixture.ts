/**
 * Fixture / recorded-run localization — works without GPU weights or HF gate.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdvisoryRef, LocalizationResult, RankedFile, TraceStep } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Package-relative fixtures root (repo fixtures/locate). */
export function fixturesRoot(): string {
  // src/locate → ../../fixtures/locate
  return path.resolve(here, "../../fixtures/locate");
}

export function defaultFixtureRepo(): string {
  return path.join(fixturesRoot(), "demo-app");
}

interface Recording {
  cweId: string;
  model: string;
  rankedFiles: RankedFile[];
  explorationTrace: TraceStep[];
  terminalCallBudget: number;
  terminalCallsUsed: number;
  warnings?: string[];
}

function loadRecording(cweId: string): Recording {
  const file = path.join(
    fixturesRoot(),
    "recordings",
    `${cweId.toLowerCase()}.json`,
  );
  if (!fs.existsSync(file)) {
    // Fallback empty recording with informative warning
    return {
      cweId,
      model: "fixture/antares-1b-recorded",
      rankedFiles: [],
      explorationTrace: [
        {
          step: 1,
          tool: "other",
          command: "fixture",
          summary: `No recording for ${cweId}; emitting empty localization.`,
        },
      ],
      terminalCallBudget: 15,
      terminalCallsUsed: 0,
      warnings: [
        `No fixture recording at fixtures/locate/recordings/${cweId.toLowerCase()}.json`,
      ],
    };
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as Recording;
}

export function runFixtureLocalization(
  advisory: AdvisoryRef,
  targetRepo: string,
): LocalizationResult {
  const recording = loadRecording(advisory.cweId);

  return {
    mode: "fixture",
    advisory,
    targetRepo: path.resolve(targetRepo),
    model: recording.model,
    generatedAt: new Date().toISOString(),
    rankedFiles: recording.rankedFiles,
    explorationTrace: recording.explorationTrace,
    warnings: [
      ...(recording.warnings ?? []),
      "Fixture mode: results come from a recorded Antares-style localization, not live model inference.",
    ],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: recording.rankedFiles.length,
      incompleteReason: null,
      terminalCallBudget: recording.terminalCallBudget,
      terminalCallsUsed: recording.terminalCallsUsed,
    },
  };
}
