/**
 * SIGNFLIP — open_loop
 * Hyperproperty: odd-symmetric order invariant under score_margin sign flip.
 * Witness: channels.score_margin.values = score(top1)−score(top2) from evidence
 * weights (can be negative). Conforming: flip + re-sort → same sign-normalized fp.
 * Violating: flip without re-order → fp breaks.
 * Forbidden: SARIF level rename; negate ranks only.
 * Optional freeze_channels: ["clock"] only (not polarity).
 */

import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import { FIXTURE_CASSETTE_MULTI, loadRecordingResult } from "../fixtures";
import { freezePacket } from "../packet";
import {
  flipAndResort,
  flipMarginKeepOrder,
  scoreMargin,
  scoredFromResult,
  signNormalizedInvariant,
} from "../score-margin";
import { SARIF_FINGERPRINT_KEYS } from "../fingerprint";

const FREEZE = ["clock"] as const;
const CHANNEL = "score_margin";

export function runSignflip(outputRoot: string): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const ordered = scoredFromResult(base);
  const paths = ordered.map((f) => f.filePath);
  const m = scoreMargin(ordered);
  if (!(m > 0)) {
    throw new Error(
      `SIGNFLIP expected positive natural margin from evidence weights, got ${m}`,
    );
  }
  const invA = signNormalizedInvariant(paths, m);

  // Conforming twin B: flip scores + re-sort → reverse order, negative margin;
  // sign-normalized invariant must match.
  const flipped = flipAndResort(ordered);
  const pathsB = flipped.map((f) => f.filePath);
  const mB = scoreMargin(flipped);
  if (!(mB < 0)) {
    throw new Error(
      `SIGNFLIP conforming: expected negative margin after flip+resort, got ${mB}`,
    );
  }
  if (pathsB.join(",") === paths.join(",")) {
    throw new Error(
      "SIGNFLIP conforming power failure: flip+resort must change reported order",
    );
  }
  const invB = signNormalizedInvariant(pathsB, mB);
  if (invA !== invB) {
    throw new Error(
      "SIGNFLIP conforming power failure: odd-symmetric invariant must hold under flip+resort",
    );
  }

  writeCassetteBytes(
    outputRoot,
    "SIGNFLIP",
    "conforming",
    freezePacket(base, [...FREEZE]),
  );

  const conforming = buildEnvelope({
    operator: "SIGNFLIP",
    coupling: "open_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.signflip.conforming",
    fixture_id: "fixture-cwe-89-multi",
    cassette: {
      format: "serialize_restore",
      bytes_or_path: "diptych-probes/SIGNFLIP/conforming/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          score_margin: { values: [m] },
          decisions: {
            values: [{ order: paths, scores: ordered.map((f) => f.score) }],
          },
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
        },
        meta: {
          freeze_channels: [...FREEZE],
          signflip_channel: CHANNEL,
          decision_fingerprint: invA as `sha256:${string}`,
          rule_ids: [],
          sarif_result_count: ordered.length,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          score_margin: { values: [mB] },
          decisions: {
            values: [{ order: pathsB, scores: flipped.map((f) => f.score) }],
          },
          sarif_fingerprint: { keys: [...SARIF_FINGERPRINT_KEYS] },
        },
        meta: {
          freeze_channels: [...FREEZE],
          signflip_channel: CHANNEL,
          decision_fingerprint: invB as `sha256:${string}`,
          rule_ids: [],
          sarif_result_count: flipped.length,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, conforming);

  // Violating: flip margin sign without updating ranked order → invariant breaks
  const kept = flipMarginKeepOrder(ordered);
  const invViol = signNormalizedInvariant(kept.paths, kept.margin);
  if (invViol === invA) {
    throw new Error(
      "SIGNFLIP violating power failure: flip-without-reorder must break invariant",
    );
  }

  writeCassetteBytes(
    outputRoot,
    "SIGNFLIP",
    "violating",
    freezePacket(base, [...FREEZE]),
  );

  const violating = buildEnvelope({
    operator: "SIGNFLIP",
    coupling: "open_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.signflip.violating",
    fixture_id: "fixture-cwe-89-multi",
    cassette: {
      format: "serialize_restore",
      bytes_or_path: "diptych-probes/SIGNFLIP/violating/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          score_margin: { values: [m] },
          decisions: { values: [{ order: paths, polarity_ok: true }] },
        },
        meta: {
          freeze_channels: [...FREEZE],
          signflip_channel: CHANNEL,
          decision_fingerprint: invA as `sha256:${string}`,
          rule_ids: [],
          sarif_result_count: ordered.length,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          score_margin: { values: [kept.margin] },
          decisions: {
            values: [{ order: kept.paths, polarity_broken: true }],
          },
        },
        meta: {
          freeze_channels: [...FREEZE],
          signflip_channel: CHANNEL,
          decision_fingerprint: invViol as `sha256:${string}`,
          rule_ids: [],
          sarif_result_count: ordered.length,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  return { conforming, violating };
}
