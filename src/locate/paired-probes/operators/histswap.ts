/**
 * HISTSWAP — open_loop
 * Hyperproperty: history buffer splice integrity on explorationTrace.
 * Witness: explorationTrace is the localize decision packet's real history /
 * delay-line of tool steps (not a renamed field). Clean splice preserves
 * finding fingerprint; corrupt/misaligned history fails the history integrity check.
 * Power: hist_splice_at integrity vs corruption.
 */

import type { TraceStep } from "../../types";
import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import {
  FIXTURE_CASSETTE_ALT_HISTORY,
  FIXTURE_CASSETTE_MULTI,
  loadRecordingResult,
} from "../fixtures";
import { freezePacket, gradeFromResult } from "../packet";
import {
  decisionFingerprintFromPacket,
  SARIF_FINGERPRINT_KEYS,
} from "../fingerprint";

function historyValues(trace: TraceStep[]): unknown[] {
  return trace.map((s) => ({
    step: s.step,
    tool: s.tool,
    command: s.command,
    summary: s.summary,
  }));
}

function spliceHistory(
  hist: TraceStep[],
  at: number,
  insert: TraceStep[],
): TraceStep[] {
  return [...hist.slice(0, at), ...insert, ...hist.slice(at)];
}

function historyDigest(values: unknown[]): string {
  return decisionFingerprintFromPacket(values);
}

export function runHistswap(outputRoot: string): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  const primary = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const alt = loadRecordingResult(FIXTURE_CASSETTE_ALT_HISTORY);
  const spliceAt = 2;

  const prefix = primary.explorationTrace.slice(0, spliceAt);
  const clean = {
    ...primary,
    explorationTrace: spliceHistory(
      primary.explorationTrace.slice(spliceAt),
      0,
      prefix,
    ),
  };
  const histA = historyValues(primary.explorationTrace);
  const histB = historyValues(clean.explorationTrace);
  const digA = historyDigest(histA);
  const digB = historyDigest(histB);
  if (digA !== digB) {
    throw new Error(
      "HISTSWAP conforming power failure: clean self-splice must preserve history digest",
    );
  }
  const findingsA = gradeFromResult(primary);
  const findingsB = gradeFromResult(clean);
  if (findingsA.fingerprint !== findingsB.fingerprint) {
    throw new Error(
      "HISTSWAP conforming: finding fingerprints must stay identical under history-only splice",
    );
  }

  writeCassetteBytes(
    outputRoot,
    "HISTSWAP",
    "conforming",
    freezePacket(primary, ["rng", "clock"]),
  );

  const conforming = buildEnvelope({
    operator: "HISTSWAP",
    coupling: "open_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.histswap.conforming",
    fixture_id: "fixture-cwe-89-multi",
    cassette: {
      format: "serialize_restore",
      bytes_or_path: "diptych-probes/HISTSWAP/conforming/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          history: { values: histA },
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
        },
        meta: {
          hist_splice_at: spliceAt,
          decision_fingerprint: findingsA.fingerprint,
          rule_ids: findingsA.rule_ids,
          sarif_result_count: findingsA.sarif_result_count,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          history: { values: histB },
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
        },
        meta: {
          hist_splice_at: spliceAt,
          decision_fingerprint: findingsB.fingerprint,
          rule_ids: findingsB.rule_ids,
          sarif_result_count: findingsB.sarif_result_count,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, conforming);

  const corrupt = {
    ...primary,
    explorationTrace: spliceHistory(
      primary.explorationTrace.slice(spliceAt),
      0,
      alt.explorationTrace.slice(0, spliceAt),
    ),
  };
  const histV = historyValues(corrupt.explorationTrace);
  const digV = historyDigest(histV);
  if (digA === digV) {
    throw new Error(
      "HISTSWAP violating power failure: corrupt splice must change history digest",
    );
  }
  const findingsV = gradeFromResult(corrupt);

  writeCassetteBytes(
    outputRoot,
    "HISTSWAP",
    "violating",
    freezePacket(corrupt, ["rng", "clock"]),
  );

  const violating = buildEnvelope({
    operator: "HISTSWAP",
    coupling: "open_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.histswap.violating",
    fixture_id: "fixture-cwe-89-multi+alt-history",
    cassette: {
      format: "serialize_restore",
      bytes_or_path: "diptych-probes/HISTSWAP/violating/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: { history: { values: histA } },
        meta: {
          hist_splice_at: spliceAt,
          decision_fingerprint: findingsA.fingerprint,
          rule_ids: findingsA.rule_ids,
          sarif_result_count: findingsA.sarif_result_count,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: { history: { values: histV } },
        meta: {
          hist_splice_at: spliceAt,
          decision_fingerprint: findingsV.fingerprint,
          rule_ids: findingsV.rule_ids,
          sarif_result_count: findingsV.sarif_result_count,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  return { conforming, violating };
}
