/**
 * FREEZEDRY — open_loop
 * Hyperproperty: freeze rng+clock → bit-identical decision/SARIF fingerprints.
 * Witness: serialize_restore of LocalizationResult; freeze_channels ["rng","clock"].
 * Power: freeze on → identical; freeze off (clock/rng leak) → diverge.
 */

import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import {
  FIXTURE_CASSETTE_MULTI,
  loadRecordingResult,
} from "../fixtures";
import {
  deserializePacket,
  freezePacket,
  gradeFromResult,
  restorePacket,
  serializePacket,
} from "../packet";
import { leakClockRngIntoSarif } from "../fingerprint";
import { decisionFingerprintFromSarif, SARIF_FINGERPRINT_KEYS } from "../fingerprint";
import type { PairedProbeTrace } from "../types";

function traceFromGrade(
  id: string,
  freeze: string[],
  grade: ReturnType<typeof gradeFromResult>,
): PairedProbeTrace {
  return {
    trace_id: id,
    events: [],
    channels: {
      sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
      decisions: {
        values: grade.rows.map((r) => ({
          ruleId: r.ruleId,
          uri: r.uri,
          level: r.level,
        })),
      },
    },
    meta: {
      freeze_channels: freeze,
      decision_fingerprint: grade.fingerprint,
      rule_ids: grade.rule_ids,
      sarif_result_count: grade.sarif_result_count,
      grade_sarif_keys: [...SARIF_FINGERPRINT_KEYS],
    },
  };
}

export function runFreezedry(outputRoot: string): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const frozen = freezePacket(base, ["rng", "clock"]);
  const bytes = serializePacket(frozen);

  // Conforming: two restore paths from identical frozen bytes → identical fingerprints
  const a = restorePacket(deserializePacket(bytes));
  const b = restorePacket(deserializePacket(bytes));
  const gradeA = gradeFromResult(a);
  const gradeB = gradeFromResult(b);
  if (gradeA.fingerprint !== gradeB.fingerprint) {
    throw new Error(
      `FREEZEDRY conforming power failure: expected identical fingerprints, got ${gradeA.fingerprint} vs ${gradeB.fingerprint}`,
    );
  }

  const confCassette = writeCassetteBytes(
    outputRoot,
    "FREEZEDRY",
    "conforming",
    frozen,
  );
  const conforming = buildEnvelope({
    operator: "FREEZEDRY",
    coupling: "open_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.freezedry.conforming",
    fixture_id: "fixture-cwe-89-multi",
    cassette: {
      format: "serialize_restore",
      bytes_or_path: confCassette.rel,
    },
    traces: [
      traceFromGrade("a", ["rng", "clock"], gradeA),
      traceFromGrade("b", ["rng", "clock"], gradeB),
    ],
  });
  writeEnvelope(outputRoot, conforming);

  // Violating: same packet bytes but unfrozen exec leaks clock+rng into graded fp
  const unfrozenBase = restorePacket(deserializePacket(bytes));
  // Deterministic distinct leaks (unfrozen clock/rng axis) — CI-stable divergence.
  const leak1 = leakClockRngIntoSarif(gradeFromResult(unfrozenBase).sarif, {
    clock: "t-unfrozen-1",
    rng: "r-unfrozen-1",
  });
  const leak2 = leakClockRngIntoSarif(gradeFromResult(unfrozenBase).sarif, {
    clock: "t-unfrozen-2",
    rng: "r-unfrozen-2",
  });
  const g1 = decisionFingerprintFromSarif(leak1);
  const g2 = decisionFingerprintFromSarif(leak2);
  if (g1.fingerprint === g2.fingerprint) {
    throw new Error(
      "FREEZEDRY violating power failure: leaked clock/rng twins must diverge",
    );
  }

  const violCassette = writeCassetteBytes(
    outputRoot,
    "FREEZEDRY",
    "violating",
    frozen,
  );
  const violating = buildEnvelope({
    operator: "FREEZEDRY",
    coupling: "open_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.freezedry.violating",
    fixture_id: "fixture-cwe-89-multi",
    cassette: {
      format: "serialize_restore",
      bytes_or_path: violCassette.rel,
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
          decisions: { values: g1.rows },
        },
        meta: {
          freeze_channels: [],
          decision_fingerprint: g1.fingerprint,
          rule_ids: g1.rule_ids,
          sarif_result_count: g1.sarif_result_count,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
          decisions: { values: g2.rows },
        },
        meta: {
          freeze_channels: [],
          decision_fingerprint: g2.fingerprint,
          rule_ids: g2.rule_ids,
          sarif_result_count: g2.sarif_result_count,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  return { conforming, violating };
}
