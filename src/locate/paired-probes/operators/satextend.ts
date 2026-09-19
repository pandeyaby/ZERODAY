/**
 * SATEXTEND — open_loop
 * Hyperproperty: saturation/clip bounds on exploration tool-budget channel.
 * Witness: Antares/ZERODAY live tool-budget clip [1, 50] via resolveLiveToolBudget —
 * a real saturation bound on a numeric channel (not result-count cosmetic).
 * Power: bound-respecting values pass; values outside sat_lo/sat_hi fail.
 */

import { resolveLiveToolBudget } from "../../incomplete";
import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import { decisionFingerprintFromPacket } from "../fingerprint";

/** Documented Antares --tool-budget saturation window. */
export const BUDGET_SAT_LO = 1;
export const BUDGET_SAT_HI = 50;

function inBounds(values: number[], lo: number, hi: number): boolean {
  return values.every((v) => v >= lo && v <= hi);
}

export function runSatextend(outputRoot: string): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  // Conforming: resolve clips into [1,50]; property "all clipped ∈ [sat_lo,sat_hi]" holds
  const rawA = 30;
  const rawB = 999; // would violate without clip
  const clippedA = resolveLiveToolBudget(rawA);
  const clippedB = resolveLiveToolBudget(rawB);
  const confValues = [clippedA, clippedB];
  if (!inBounds(confValues, BUDGET_SAT_LO, BUDGET_SAT_HI)) {
    throw new Error(
      `SATEXTEND conforming power failure: clipped values out of bounds ${confValues}`,
    );
  }
  if (clippedB !== BUDGET_SAT_HI) {
    throw new Error(
      `SATEXTEND: expected resolveLiveToolBudget(999)===50, got ${clippedB}`,
    );
  }

  const fpConf = decisionFingerprintFromPacket({
    channel: "tool_budget",
    sat_lo: BUDGET_SAT_LO,
    sat_hi: BUDGET_SAT_HI,
    values: confValues,
  });

  writeCassetteBytes(outputRoot, "SATEXTEND", "conforming", {
    channel: "tool_budget",
    sat_lo: BUDGET_SAT_LO,
    sat_hi: BUDGET_SAT_HI,
    raw: [rawA, rawB],
    clipped: confValues,
  });

  const conforming = buildEnvelope({
    operator: "SATEXTEND",
    coupling: "open_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.satextend.conforming",
    fixture_id: "tool-budget-sat-1-50",
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/SATEXTEND/conforming/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          tool_budget: { values: [clippedA] },
          decisions: { values: [{ raw: rawA, clipped: clippedA }] },
        },
        meta: {
          sat_lo: BUDGET_SAT_LO,
          sat_hi: BUDGET_SAT_HI,
          decision_fingerprint: fpConf,
          rule_ids: [],
          sarif_result_count: 0,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          tool_budget: { values: [clippedB] },
          decisions: { values: [{ raw: rawB, clipped: clippedB }] },
        },
        meta: {
          sat_lo: BUDGET_SAT_LO,
          sat_hi: BUDGET_SAT_HI,
          decision_fingerprint: fpConf,
          rule_ids: [],
          sarif_result_count: 0,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, conforming);

  // Violating: unsaturated leak — raw values recorded without clip enter violation region
  const violValues = [rawA, rawB]; // 999 > sat_hi
  if (inBounds(violValues, BUDGET_SAT_LO, BUDGET_SAT_HI)) {
    throw new Error(
      "SATEXTEND violating power failure: unsaturated values unexpectedly in bounds",
    );
  }
  const fpViol = decisionFingerprintFromPacket({
    channel: "tool_budget",
    sat_lo: BUDGET_SAT_LO,
    sat_hi: BUDGET_SAT_HI,
    values: violValues,
    unsaturated: true,
  });

  writeCassetteBytes(outputRoot, "SATEXTEND", "violating", {
    channel: "tool_budget",
    sat_lo: BUDGET_SAT_LO,
    sat_hi: BUDGET_SAT_HI,
    unsaturated: violValues,
  });

  const violating = buildEnvelope({
    operator: "SATEXTEND",
    coupling: "open_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.satextend.violating",
    fixture_id: "tool-budget-unsaturated-leak",
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/SATEXTEND/violating/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          tool_budget: { values: [violValues[0]] },
          decisions: { values: [{ raw: rawA, clipped: null }] },
        },
        meta: {
          sat_lo: BUDGET_SAT_LO,
          sat_hi: BUDGET_SAT_HI,
          decision_fingerprint: fpViol,
          rule_ids: [],
          sarif_result_count: 0,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          tool_budget: { values: [violValues[1]] },
          decisions: { values: [{ raw: rawB, clipped: null }] },
        },
        meta: {
          sat_lo: BUDGET_SAT_LO,
          sat_hi: BUDGET_SAT_HI,
          decision_fingerprint: fpViol,
          rule_ids: [],
          sarif_result_count: 0,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  return { conforming, violating };
}
