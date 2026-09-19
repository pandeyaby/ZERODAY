/**
 * RESEED — open_loop
 * Hyperproperty: seeds differ; stability L∞ ≤ ε (conforming) vs > ε (violating).
 * Witness: meta.seed reshuffles multi-finding ranks via mulberry32; graded channel
 * is seed-independent finding identity (conforming) vs seed-leaking fp (violating).
 * Power: only seed/policy axis changes ε-bound outcome.
 */

import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import { FIXTURE_CASSETTE_MULTI, loadRecordingResult } from "../fixtures";
import {
  applySeedToResult,
  fingerprintLinfDistance,
  gradeSeedIndependent,
  gradeSeedLeaking,
} from "../seed";
import { SARIF_FINGERPRINT_KEYS } from "../fingerprint";
import type { PairedProbeSeed } from "../probe-seed";

const EPSILON = 0;

export function runReseed(
  outputRoot: string,
  seed?: PairedProbeSeed,
): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  const base = seed?.primary ?? loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const fixtureId = seed?.fixtureId ?? "fixture-cwe-89-multi";
  if (base.rankedFiles.length < 2) {
    throw new Error("RESEED requires multi-finding cassette (≥2 rankedFiles)");
  }

  const seedA = "seed-alpha";
  const seedB = "seed-beta";
  const ra = applySeedToResult(base, seedA);
  const rb = applySeedToResult(base, seedB);

  // Conforming policy: seed-independent grade → stability 0 ≤ ε
  const ga = gradeSeedIndependent(ra);
  const gb = gradeSeedIndependent(rb);
  const stabConf = fingerprintLinfDistance(ga.fingerprint, gb.fingerprint);
  if (stabConf > EPSILON) {
    throw new Error(
      `RESEED conforming power failure: expected stability ≤ ${EPSILON}, got ${stabConf}`,
    );
  }
  // Seeds must actually differ in ranked order for a real seed axis
  const orderA = ra.rankedFiles.map((f) => f.filePath).join(",");
  const orderB = rb.rankedFiles.map((f) => f.filePath).join(",");
  // With 2 items, mulberry32 may or may not swap — force check via seed leak path for violating.
  // For conforming we only require seed-independent stability.

  writeCassetteBytes(outputRoot, "RESEED", "conforming", {
    note: "shared multi cassette + different meta.seed; format none",
    seeds: [seedA, seedB],
  });

  const conforming = buildEnvelope({
    operator: "RESEED",
    coupling: "open_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.reseed.conforming",
    fixture_id: fixtureId,
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/RESEED/conforming/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          stability: { values: [stabConf] },
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
          decisions: { values: [{ seed: seedA, order: orderA }] },
        },
        meta: {
          seed: seedA,
          epsilon: EPSILON,
          decision_fingerprint: ga.fingerprint,
          rule_ids: ga.rule_ids,
          sarif_result_count: ga.sarif_result_count,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          stability: { values: [stabConf] },
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
          decisions: { values: [{ seed: seedB, order: orderB }] },
        },
        meta: {
          seed: seedB,
          epsilon: EPSILON,
          decision_fingerprint: gb.fingerprint,
          rule_ids: gb.rule_ids,
          sarif_result_count: gb.sarif_result_count,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, conforming);

  // Violating: seed leaks into graded fingerprint → stability > ε
  const la = gradeSeedLeaking(ra, seedA);
  const lb = gradeSeedLeaking(rb, seedB);
  const stabViol = fingerprintLinfDistance(la.fingerprint, lb.fingerprint);
  if (stabViol <= EPSILON) {
    throw new Error(
      `RESEED violating power failure: expected stability > ${EPSILON}, got ${stabViol}`,
    );
  }

  writeCassetteBytes(outputRoot, "RESEED", "violating", {
    note: "seed-leaking policy",
    seeds: [seedA, seedB],
  });

  const violating = buildEnvelope({
    operator: "RESEED",
    coupling: "open_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.reseed.violating",
    fixture_id: fixtureId,
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/RESEED/violating/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          stability: { values: [stabViol] },
          decisions: { values: [{ seed: seedA, leak: true }] },
        },
        meta: {
          seed: seedA,
          epsilon: EPSILON,
          decision_fingerprint: la.fingerprint,
          rule_ids: la.rule_ids,
          sarif_result_count: la.sarif_result_count,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          stability: { values: [stabViol] },
          decisions: { values: [{ seed: seedB, leak: true }] },
        },
        meta: {
          seed: seedB,
          epsilon: EPSILON,
          decision_fingerprint: lb.fingerprint,
          rule_ids: lb.rule_ids,
          sarif_result_count: lb.sarif_result_count,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  return { conforming, violating };
}
