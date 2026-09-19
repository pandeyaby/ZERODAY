/**
 * TRAJSWAP — crn_closed_loop (required)
 * Hyperproperty: mid-horizon trajectory segment swap; closed-loop residual
 * (1 − Jaccard(proposed, verified)) stays ≤ residual_eps vs exceeds it.
 * Witness: explorationTrace trajectory + nonempty closed_loop_residual.
 * May freeze [rng, clock]. Forbidden: empty residual; rankedFiles-only permute; open_loop.
 */

import type { TraceStep } from "../../types";
import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import {
  FIXTURE_CASSETTE_ALT_HISTORY,
  FIXTURE_CASSETTE_MULTI,
  loadRecordingResult,
} from "../fixtures";
import {
  closedLoopResidual,
  pathsMentionedInStep,
  swapTrajectorySegment,
} from "../crn";
import { decisionFingerprintFromPacket } from "../fingerprint";
import type { PairedProbeSeed } from "../probe-seed";

const FREEZE = ["rng", "clock"] as const;
const RESIDUAL_EPS = 0.25;

/** Poison segment: explores + submits outside the verify oracle set. */
function poisonSteps(): TraceStep[] {
  return [
    {
      step: 1,
      tool: "find",
      command: "find . -type f -name 'harmless.js'",
      summary: "Listed decoy sources under fixtures/harmless.js.",
    },
    {
      step: 2,
      tool: "grep",
      command: "grep -Rni 'NOTE' fixtures/",
      summary: "Found marker notes in fixtures/decoy/notes.md.",
    },
    {
      step: 3,
      tool: "cat",
      command: "cat fixtures/decoy/notes.md",
      summary: "Read fixtures/decoy/notes.md — not a localization candidate.",
    },
    {
      step: 4,
      tool: "cat",
      command: "cat lib/unrelated.js",
      summary: "Read lib/unrelated.js outside the verify oracle set.",
    },
    {
      step: 5,
      tool: "other",
      command: "rank-files",
      summary: "Ranked lib/unrelated.js as sole proposal.",
    },
    {
      step: 6,
      tool: "submit",
      command: "submit_vulnerable_files",
      summary: "Submitted lib/unrelated.js (rank 1).",
    },
  ];
}

/** Proposed file set at closed-loop verify = paths named by the submit step. */
function proposedAtVerify(steps: TraceStep[]): string[] {
  const submit = [...steps].reverse().find((s) => s.tool === "submit");
  if (submit) {
    const fromSubmit = pathsMentionedInStep(submit);
    if (fromSubmit.length > 0) return fromSubmit;
  }
  // Fallback: union of path mentions (still nonempty for valid locate traces)
  const acc = new Set<string>();
  for (const s of steps) {
    for (const p of pathsMentionedInStep(s)) acc.add(p);
  }
  return [...acc].sort();
}

/**
 * Nonempty residual series at CRN verify checkpoints (submit + final).
 * Exploration steps before a proposal do not emit residual=1 noise.
 */
function verifyResidualSeries(
  steps: TraceStep[],
  verified: string[],
): number[] {
  const residuals: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].tool === "submit" || i === steps.length - 1) {
      const proposed = proposedAtVerify(steps.slice(0, i + 1));
      if (proposed.length > 0) {
        residuals.push(closedLoopResidual(proposed, verified));
      }
    }
  }
  if (residuals.length === 0) {
    throw new Error("closed_loop_residual must be non-empty after verify");
  }
  return residuals;
}

function trajChannel(steps: TraceStep[], verified: string[]) {
  const proposed = proposedAtVerify(steps);
  return {
    steps: steps.map((s) => ({
      step: s.step,
      tool: s.tool,
      command: s.command,
      summary: s.summary,
    })),
    verify_targets: verified,
    proposed_files: proposed,
  };
}

export function runTrajswap(
  outputRoot: string,
  seed?: PairedProbeSeed,
): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  const primary = seed?.primary ?? loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const alt =
    seed?.alt ?? loadRecordingResult(FIXTURE_CASSETTE_ALT_HISTORY);
  const fixtureId = seed?.fixtureId ?? "fixture-cwe-89-multi+alt-history";
  const fixtureIdPoison =
    seed != null
      ? `${seed.fixtureId}+poison-traj`
      : "fixture-cwe-89-multi+poison-traj";
  const verified = primary.rankedFiles.map((f) => f.filePath).sort();
  const trajA = primary.explorationTrace.map((s) => ({ ...s }));
  const trajB = alt.explorationTrace.map((s) => ({ ...s }));
  if (trajA.length < 4 || trajB.length < 4) {
    throw new Error("TRAJSWAP requires explorationTrace length ≥4");
  }

  // Mid-horizon exploration segment (exclude submit) — both rollouts still verify.
  const swapAt = 2;
  const swapLen = 2;
  const segA = JSON.stringify(trajA.slice(swapAt, swapAt + swapLen));
  const segB = JSON.stringify(trajB.slice(swapAt, swapAt + swapLen));
  if (segA === segB) {
    throw new Error(
      "TRAJSWAP conforming power failure: mid segments must differ before swap",
    );
  }

  const swapped = swapTrajectorySegment(trajA, trajB, swapAt, swapLen);
  const resA = verifyResidualSeries(swapped.a, verified);
  const resB = verifyResidualSeries(swapped.b, verified);
  const maxConf = Math.max(...resA, ...resB);
  if (maxConf > RESIDUAL_EPS) {
    throw new Error(
      `TRAJSWAP conforming power failure: residual ${maxConf} > eps ${RESIDUAL_EPS}`,
    );
  }

  const fpConf = decisionFingerprintFromPacket({
    operator: "TRAJSWAP",
    traj_swap_at: swapAt,
    residual_eps: RESIDUAL_EPS,
    residual_max: maxConf,
    verified,
  });

  writeCassetteBytes(outputRoot, "TRAJSWAP", "conforming", {
    format: "vcr_json",
    freeze_channels: [...FREEZE],
    traj_swap_at: swapAt,
    swap_len: swapLen,
    verified,
    rollout_a: trajChannel(swapped.a, verified),
    rollout_b: trajChannel(swapped.b, verified),
    closed_loop_residual: { a: resA, b: resB },
  });

  const conforming = buildEnvelope({
    operator: "TRAJSWAP",
    coupling: "crn_closed_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.trajswap.conforming",
    fixture_id: fixtureId,
    horizon: { unit: "steps", length: swapped.a.length },
    cassette: {
      format: "vcr_json",
      bytes_or_path: "diptych-probes/TRAJSWAP/conforming/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          trajectory: trajChannel(swapped.a, verified),
          closed_loop_residual: { values: resA },
        },
        meta: {
          freeze_channels: [...FREEZE],
          traj_swap_at: swapAt,
          residual_eps: RESIDUAL_EPS,
          decision_fingerprint: fpConf,
          rule_ids: [],
          sarif_result_count: verified.length,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          trajectory: trajChannel(swapped.b, verified),
          closed_loop_residual: { values: resB },
        },
        meta: {
          freeze_channels: [...FREEZE],
          traj_swap_at: swapAt,
          residual_eps: RESIDUAL_EPS,
          decision_fingerprint: fpConf,
          rule_ids: [],
          sarif_result_count: verified.length,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, conforming);

  // Violating: mid-horizon swap that includes the verify/submit segment from poison
  // → proposed set leaves the oracle → residual > eps.
  const poison = poisonSteps();
  const violSwapAt = trajA.length - 2; // last two steps: rank-files + submit
  const broken = swapTrajectorySegment(trajA, poison, violSwapAt, 2);
  const resV = verifyResidualSeries(broken.a, verified);
  const resVb = verifyResidualSeries(broken.b, verified);
  const maxViol = Math.max(...resV);
  if (maxViol <= RESIDUAL_EPS) {
    throw new Error(
      `TRAJSWAP violating power failure: expected residual > ${RESIDUAL_EPS}, got ${maxViol}`,
    );
  }

  const fpViol = decisionFingerprintFromPacket({
    operator: "TRAJSWAP",
    traj_swap_at: violSwapAt,
    residual_eps: RESIDUAL_EPS,
    residual_max: maxViol,
    verified,
    poison: true,
  });

  writeCassetteBytes(outputRoot, "TRAJSWAP", "violating", {
    format: "vcr_json",
    freeze_channels: [...FREEZE],
    traj_swap_at: violSwapAt,
    swap_len: 2,
    verified,
    rollout_a: trajChannel(broken.a, verified),
    rollout_b: trajChannel(broken.b, verified),
    closed_loop_residual: { a: resV, b: resVb },
  });

  const violating = buildEnvelope({
    operator: "TRAJSWAP",
    coupling: "crn_closed_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.trajswap.violating",
    fixture_id: fixtureIdPoison,
    horizon: { unit: "steps", length: broken.a.length },
    cassette: {
      format: "vcr_json",
      bytes_or_path: "diptych-probes/TRAJSWAP/violating/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          trajectory: trajChannel(broken.a, verified),
          closed_loop_residual: { values: resV },
        },
        meta: {
          freeze_channels: [...FREEZE],
          traj_swap_at: violSwapAt,
          residual_eps: RESIDUAL_EPS,
          decision_fingerprint: fpViol,
          rule_ids: [],
          sarif_result_count: verified.length,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          trajectory: trajChannel(broken.b, verified),
          closed_loop_residual: { values: resVb },
        },
        meta: {
          freeze_channels: [...FREEZE],
          traj_swap_at: violSwapAt,
          residual_eps: RESIDUAL_EPS,
          decision_fingerprint: fpViol,
          rule_ids: [],
          sarif_result_count: verified.length,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  return { conforming, violating };
}
