/**
 * VARSCALE — crn_closed_loop (required)
 * Hyperproperty: meta.var_scale on exploration noise; variance_proxy mean-matched
 * on mean_finding_count; conforming ≤ var_eps (stability ≥ floor); violating breaks.
 * Witness: mulberry32 jitter on evidence weights before ranking (RESEED family),
 * graded as dispersion — not identity under seed, not rank/count scale, not AUROC.
 * Do not freeze the noise source being scaled.
 */

import type { LocalizationResult, RankedFile } from "../../types";
import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import { FIXTURE_CASSETTE_MULTI, loadRecordingResult } from "../fixtures";
import { evidenceScore } from "../score-margin";
import { hashSeed, mulberry32 } from "../seed";
import { decisionFingerprintFromPacket } from "../fingerprint";
import { closedLoopResidual } from "../crn";

const VAR_EPS = 0.15;
const STABILITY_FLOOR = 0.85;
const DRAW_COUNT = 12;
const MEAN_TOL = 1e-9;

function jitterRank(
  result: LocalizationResult,
  seed: string,
  varScale: number,
): { top1: string; findingCount: number; order: string[] } {
  const rnd = mulberry32(hashSeed(`${seed}|var=${varScale}`));
  const scored = result.rankedFiles.map((f: RankedFile) => {
    const base = evidenceScore(f);
    // Exploration noise on evidence weights — scaled by var_scale (axis).
    const noise = (rnd() - 0.5) * 2 * varScale;
    return { filePath: f.filePath, score: base + noise };
  });
  scored.sort(
    (a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath),
  );
  return {
    top1: scored[0]?.filePath ?? "",
    findingCount: scored.length,
    order: scored.map((s) => s.filePath),
  };
}

/**
 * variance_proxy: 1 − top-1 identity rate across K mean-matched draws
 * (dispersion of localize decisions under exploration noise).
 */
function varianceProxyAtScale(
  result: LocalizationResult,
  varScale: number,
  seeds: string[],
): {
  variance_proxy: number[];
  stability: number;
  mean_finding_count: number;
  top1s: string[];
} {
  const draws = seeds.map((s) => jitterRank(result, s, varScale));
  const meanFinding =
    draws.reduce((a, d) => a + d.findingCount, 0) / draws.length;
  // Mode top-1 frequency → stability; variance_proxy = 1 − stability
  const counts = new Map<string, number>();
  for (const d of draws) {
    counts.set(d.top1, (counts.get(d.top1) ?? 0) + 1);
  }
  let mode = 0;
  for (const c of counts.values()) mode = Math.max(mode, c);
  const stability = mode / draws.length;
  const proxy = 1 - stability;
  // Length-H series: rolling variance proxy over prefixes of draws
  const series: number[] = [];
  for (let h = 2; h <= draws.length; h++) {
    const slice = draws.slice(0, h);
    const c2 = new Map<string, number>();
    for (const d of slice) c2.set(d.top1, (c2.get(d.top1) ?? 0) + 1);
    let m2 = 0;
    for (const c of c2.values()) m2 = Math.max(m2, c);
    series.push(1 - m2 / slice.length);
  }
  return {
    variance_proxy: series.length > 0 ? series : [proxy],
    stability,
    mean_finding_count: meanFinding,
    top1s: draws.map((d) => d.top1),
  };
}

function maxProxy(values: number[]): number {
  return values.reduce((m, v) => Math.max(m, v), 0);
}

export function runVarscale(outputRoot: string): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  if (base.rankedFiles.length < 2) {
    throw new Error("VARSCALE requires ≥2 rankedFiles");
  }
  const verified = base.rankedFiles.map((f) => f.filePath).sort();
  const seedsA = Array.from(
    { length: DRAW_COUNT },
    (_, i) => `varscale-draw-a-${i}`,
  );
  const seedsB = Array.from(
    { length: DRAW_COUNT },
    (_, i) => `varscale-draw-b-${i}`,
  );

  const confScale = 0.05; // conservative exploration noise
  const violScale = 80; // noise scale breaks top-1 stability

  const confA = varianceProxyAtScale(base, confScale, seedsA);
  const confB = varianceProxyAtScale(base, confScale, seedsB);
  const violA = varianceProxyAtScale(base, violScale, seedsA);
  const violB = varianceProxyAtScale(base, violScale, seedsB);

  // Mean-matched finding counts (within tolerance) across roles + twin traces
  for (const m of [
    confA.mean_finding_count,
    confB.mean_finding_count,
    violA.mean_finding_count,
    violB.mean_finding_count,
  ]) {
    if (Math.abs(m - base.rankedFiles.length) > MEAN_TOL) {
      throw new Error(`VARSCALE mean-match failure: ${m}`);
    }
  }

  const confMax = Math.max(
    maxProxy(confA.variance_proxy),
    maxProxy(confB.variance_proxy),
  );
  const confStab = Math.min(confA.stability, confB.stability);
  if (confMax > VAR_EPS || confStab < STABILITY_FLOOR) {
    throw new Error(
      `VARSCALE conforming power failure: proxy=${confMax} stability=${confStab}`,
    );
  }
  const violMaxA = maxProxy(violA.variance_proxy);
  const violMaxB = maxProxy(violB.variance_proxy);
  const violMax = Math.max(violMaxA, violMaxB);
  if (
    (violMaxA <= VAR_EPS && violA.stability >= STABILITY_FLOOR) ||
    (violMaxB <= VAR_EPS && violB.stability >= STABILITY_FLOOR)
  ) {
    throw new Error(
      `VARSCALE violating power failure: expected both twins to break at scale=${violScale} (proxy a=${violMaxA} b=${violMaxB})`,
    );
  }

  // Closed-loop residual of proposal set vs verify oracle
  const residualConf = closedLoopResidual(
    base.rankedFiles.map((f) => f.filePath),
    verified,
  );
  const residualViol = closedLoopResidual(
    Array.from(new Set([...violA.top1s, ...violB.top1s])),
    verified,
  );

  const fpConf = decisionFingerprintFromPacket({
    operator: "VARSCALE",
    var_scale: confScale,
    var_eps: VAR_EPS,
    mean_finding_count: confA.mean_finding_count,
    variance_max: confMax,
  });
  const fpViol = decisionFingerprintFromPacket({
    operator: "VARSCALE",
    var_scale: violScale,
    var_eps: VAR_EPS,
    mean_finding_count: violA.mean_finding_count,
    variance_max: violMax,
  });

  writeCassetteBytes(outputRoot, "VARSCALE", "conforming", {
    var_scale: confScale,
    var_eps: VAR_EPS,
    stability_floor: STABILITY_FLOOR,
    mean_finding_count: confA.mean_finding_count,
    variance_proxy: { a: confA.variance_proxy, b: confB.variance_proxy },
    stability: { a: confA.stability, b: confB.stability },
    // Noise source intentionally NOT frozen — axis is var_scale on exploration noise
    freeze_channels: ["clock"],
  });

  const conforming = buildEnvelope({
    operator: "VARSCALE",
    coupling: "crn_closed_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.varscale.conforming",
    fixture_id: "fixture-cwe-89-multi",
    horizon: { unit: "steps", length: confA.variance_proxy.length },
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/VARSCALE/conforming/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          variance_proxy: { values: confA.variance_proxy },
          stability: { values: [confA.stability] },
          closed_loop_residual: { values: [residualConf] },
        },
        meta: {
          freeze_channels: ["clock"],
          var_scale: confScale,
          var_eps: VAR_EPS,
          stability_floor: STABILITY_FLOOR,
          mean_finding_count: confA.mean_finding_count,
          decision_fingerprint: fpConf,
          rule_ids: [],
          sarif_result_count: base.rankedFiles.length,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          variance_proxy: { values: confB.variance_proxy },
          stability: { values: [confB.stability] },
          closed_loop_residual: { values: [residualConf] },
        },
        meta: {
          freeze_channels: ["clock"],
          var_scale: confScale,
          var_eps: VAR_EPS,
          stability_floor: STABILITY_FLOOR,
          mean_finding_count: confB.mean_finding_count,
          decision_fingerprint: fpConf,
          rule_ids: [],
          sarif_result_count: base.rankedFiles.length,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, conforming);

  writeCassetteBytes(outputRoot, "VARSCALE", "violating", {
    var_scale: violScale,
    var_eps: VAR_EPS,
    stability_floor: STABILITY_FLOOR,
    mean_finding_count: violA.mean_finding_count,
    variance_proxy: { a: violA.variance_proxy, b: violB.variance_proxy },
    stability: { a: violA.stability, b: violB.stability },
    freeze_channels: ["clock"],
  });

  const violating = buildEnvelope({
    operator: "VARSCALE",
    coupling: "crn_closed_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.varscale.violating",
    fixture_id: "fixture-cwe-89-multi",
    horizon: { unit: "steps", length: violA.variance_proxy.length },
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/VARSCALE/violating/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: {
          variance_proxy: { values: violA.variance_proxy },
          stability: { values: [violA.stability] },
          closed_loop_residual: { values: [residualViol] },
        },
        meta: {
          freeze_channels: ["clock"],
          var_scale: violScale,
          var_eps: VAR_EPS,
          stability_floor: STABILITY_FLOOR,
          mean_finding_count: violA.mean_finding_count,
          decision_fingerprint: fpViol,
          rule_ids: [],
          sarif_result_count: base.rankedFiles.length,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: {
          variance_proxy: { values: violB.variance_proxy },
          stability: { values: [violB.stability] },
          closed_loop_residual: { values: [residualViol] },
        },
        meta: {
          freeze_channels: ["clock"],
          var_scale: violScale,
          var_eps: VAR_EPS,
          stability_floor: STABILITY_FLOOR,
          mean_finding_count: violB.mean_finding_count,
          decision_fingerprint: fpViol,
          rule_ids: [],
          sarif_result_count: base.rankedFiles.length,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  return { conforming, violating };
}
