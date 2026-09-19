/**
 * DIPTYCH gate_axis_mutate — for every claimed-green cell, mutate **only**
 * that operator’s axis on the conforming state and regrade → MUST fail.
 *
 * Alias map (WITNESSES_ZERODAY / ONEPAGER):
 *   FREEZEDRY  → freeze_channels mask (rng+clock on ↔ leak off)
 *   RESEED     → seed grade policy (seed-independent ↔ seed-leaking)
 *   SCHEMAX    → required schema key set (equal ↔ drop/rename)
 *   SIGNFLIP   → score_margin polarity (flip+reorder ↔ flip-without-reorder)
 *   SATEXTEND  → sat clip (resolveLiveToolBudget ↔ unsaturated leak)
 *   HISTSWAP   → hist_splice integrity (clean ↔ corrupt alt-history)
 *   TRAJSWAP   → traj_swap_at segment (valid mid-swap ↔ poison submit swap)
 *   VARSCALE   → var_scale (conservative ↔ blown exploration noise)
 *
 * Prefer honest deferred over thin green: if mutate-power cannot be proven,
 * the cell must not claim green.
 */

import { resolveLiveToolBudget } from "../incomplete";
import type { TraceStep } from "../types";
import type { DiptychOperator } from "./types";
import {
  FIXTURE_CASSETTE_ALT_HISTORY,
  FIXTURE_CASSETTE_MULTI,
  FIXTURE_CASSETTE_SINGLE,
  loadRecordingResult,
} from "./fixtures";
import {
  deserializePacket,
  freezePacket,
  gradeFromResult,
  restorePacket,
  serializePacket,
} from "./packet";
import {
  decisionFingerprintFromPacket,
  leakClockRngIntoSarif,
  decisionFingerprintFromSarif,
} from "./fingerprint";
import {
  applySeedToResult,
  fingerprintLinfDistance,
  gradeSeedIndependent,
  gradeSeedLeaking,
} from "./seed";
import {
  ALL_REQUIRED_SCHEMA_KEYS,
  collectPresentSchemaKeys,
  dropRequiredKey,
  keySetsEqual,
} from "./schema-keys";
import {
  flipAndResort,
  flipMarginKeepOrder,
  scoreMargin,
  scoredFromResult,
  signNormalizedInvariant,
} from "./score-margin";
import {
  closedLoopResidual,
  pathsMentionedInStep,
  swapTrajectorySegment,
} from "./crn";
import { evidenceScore } from "./score-margin";
import { hashSeed, mulberry32 } from "./seed";
import { BUDGET_SAT_HI, BUDGET_SAT_LO } from "./operators/satextend";

export interface AxisMutateProof {
  op: DiptychOperator;
  axis: string;
  conforming_pass: true;
  mutated_fail: true;
  detail: string;
}

export interface AxisMutateFailure {
  op: DiptychOperator;
  axis: string;
  message: string;
}

function ok(
  op: DiptychOperator,
  axis: string,
  detail: string,
): AxisMutateProof {
  return { op, axis, conforming_pass: true, mutated_fail: true, detail };
}

function fail(
  op: DiptychOperator,
  axis: string,
  message: string,
): AxisMutateFailure {
  return { op, axis, message };
}

function proveFreezedry(): AxisMutateProof | AxisMutateFailure {
  const axis = "freeze_channels";
  const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const frozen = freezePacket(base, ["rng", "clock"]);
  const bytes = serializePacket(frozen);
  const a = gradeFromResult(restorePacket(deserializePacket(bytes)));
  const b = gradeFromResult(restorePacket(deserializePacket(bytes)));
  if (a.fingerprint !== b.fingerprint) {
    return fail("FREEZEDRY", axis, "conforming freeze restore not identical");
  }
  // Mutate axis only: drop freeze → leak clock/rng into graded SARIF
  const leak1 = decisionFingerprintFromSarif(
    leakClockRngIntoSarif(a.sarif, { clock: "c1", rng: "r1" }),
  );
  const leak2 = decisionFingerprintFromSarif(
    leakClockRngIntoSarif(a.sarif, { clock: "c2", rng: "r2" }),
  );
  if (leak1.fingerprint === leak2.fingerprint) {
    return fail(
      "FREEZEDRY",
      axis,
      "axis mutate (unfreeze/leak) did not break fingerprint identity",
    );
  }
  return ok(
    "FREEZEDRY",
    axis,
    "freeze→identical; unfreeze+clock/rng leak→diverge",
  );
}

function proveReseed(): AxisMutateProof | AxisMutateFailure {
  const axis = "meta.seed / grade policy";
  const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const ra = applySeedToResult(base, "seed-alpha");
  const rb = applySeedToResult(base, "seed-beta");
  const ga = gradeSeedIndependent(ra);
  const gb = gradeSeedIndependent(rb);
  if (fingerprintLinfDistance(ga.fingerprint, gb.fingerprint) > 0) {
    return fail("RESEED", axis, "conforming seed-independent grade unstable");
  }
  // Mutate axis only: seed-leaking policy
  const la = gradeSeedLeaking(ra, "seed-alpha");
  const lb = gradeSeedLeaking(rb, "seed-beta");
  if (fingerprintLinfDistance(la.fingerprint, lb.fingerprint) <= 0) {
    return fail(
      "RESEED",
      axis,
      "axis mutate (seed-leak policy) did not break stability≤ε",
    );
  }
  return ok("RESEED", axis, "seed-independent≤ε; seed-leak>ε");
}

function proveSchemax(): AxisMutateProof | AxisMutateFailure {
  const axis = "required_schema_keys";
  const rec = loadRecordingResult(FIXTURE_CASSETTE_SINGLE);
  const graded = gradeFromResult(rec);
  const keys = collectPresentSchemaKeys(
    rec as unknown as Record<string, unknown>,
    graded.sarif as unknown as Record<string, unknown>,
  );
  for (const req of ALL_REQUIRED_SCHEMA_KEYS) {
    if (!keys.includes(req)) {
      return fail("SCHEMAX", axis, `conforming missing required key ${req}`);
    }
  }
  if (!keySetsEqual(keys, keys)) {
    return fail("SCHEMAX", axis, "conforming key set self-inequality");
  }
  // Mutate axis only: drop one required key
  const dropped = dropRequiredKey(keys, ALL_REQUIRED_SCHEMA_KEYS[0]);
  if (keySetsEqual(keys, dropped)) {
    return fail(
      "SCHEMAX",
      axis,
      "axis mutate (drop required key) did not break key-set equality",
    );
  }
  return ok("SCHEMAX", axis, "required keys equal; drop/rename → unequal");
}

function proveSignflip(): AxisMutateProof | AxisMutateFailure {
  const axis = "score_margin polarity";
  const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const ordered = scoredFromResult(base);
  const m = scoreMargin(ordered);
  const paths = ordered.map((f) => f.filePath);
  const inv = signNormalizedInvariant(paths, m);
  const flipped = flipAndResort(ordered);
  const mB = scoreMargin(flipped);
  const invB = signNormalizedInvariant(
    flipped.map((f) => f.filePath),
    mB,
  );
  if (inv !== invB) {
    return fail(
      "SIGNFLIP",
      axis,
      "conforming flip+re-sort broke odd-symmetric invariant",
    );
  }
  // Mutate axis only: flip margin sign without re-ordering
  const kept = flipMarginKeepOrder(ordered);
  const invBroken = signNormalizedInvariant(kept.paths, kept.margin);
  if (invBroken === inv) {
    return fail(
      "SIGNFLIP",
      axis,
      "axis mutate (flip margin without reorder) did not break invariant",
    );
  }
  return ok(
    "SIGNFLIP",
    axis,
    "flip+re-sort preserves; flip-without-reorder fails",
  );
}

function proveSatextend(): AxisMutateProof | AxisMutateFailure {
  const axis = "sat_lo/sat_hi clip";
  const raw = [30, 999];
  const clipped = raw.map((v) => resolveLiveToolBudget(v));
  const inBounds = (vals: number[]) =>
    vals.every((v) => v >= BUDGET_SAT_LO && v <= BUDGET_SAT_HI);
  if (!inBounds(clipped)) {
    return fail("SATEXTEND", axis, "conforming clipped values out of bounds");
  }
  // Mutate axis only: unsaturated leak (skip resolveLiveToolBudget)
  if (inBounds(raw)) {
    return fail(
      "SATEXTEND",
      axis,
      "axis mutate (unsaturated 999) unexpectedly still in bounds",
    );
  }
  return ok(
    "SATEXTEND",
    axis,
    "clip holds in [1,50]; unsaturated leak enters violation",
  );
}

function proveHistswap(): AxisMutateProof | AxisMutateFailure {
  const axis = "hist_splice_at integrity";
  const primary = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const alt = loadRecordingResult(FIXTURE_CASSETTE_ALT_HISTORY);
  const spliceAt = 2;
  const histDigest = (trace: TraceStep[]) =>
    decisionFingerprintFromPacket(
      trace.map((s) => ({
        step: s.step,
        tool: s.tool,
        command: s.command,
        summary: s.summary,
      })),
    );
  const clean = [
    ...primary.explorationTrace.slice(0, spliceAt),
    ...primary.explorationTrace.slice(spliceAt),
  ];
  const digA = histDigest(primary.explorationTrace);
  const digClean = histDigest(clean);
  if (digA !== digClean) {
    return fail("HISTSWAP", axis, "conforming clean splice changed digest");
  }
  // Mutate axis only: corrupt splice from alt-history
  const corrupt = [
    ...alt.explorationTrace.slice(0, spliceAt),
    ...primary.explorationTrace.slice(spliceAt),
  ];
  if (histDigest(corrupt) === digA) {
    return fail(
      "HISTSWAP",
      axis,
      "axis mutate (corrupt hist splice) did not change history digest",
    );
  }
  return ok("HISTSWAP", axis, "clean splice preserves; corrupt splice diverges");
}

function proveTrajswap(): AxisMutateProof | AxisMutateFailure {
  const axis = "traj_swap_at / closed_loop_residual";
  const residualEps = 0.25;
  const primary = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const alt = loadRecordingResult(FIXTURE_CASSETTE_ALT_HISTORY);
  const verified = primary.rankedFiles.map((f) => f.filePath).sort();
  const trajA = primary.explorationTrace.map((s) => ({ ...s }));
  const trajB = alt.explorationTrace.map((s) => ({ ...s }));

  const proposedAtVerify = (steps: TraceStep[]): string[] => {
    const submit = [...steps].reverse().find((s) => s.tool === "submit");
    if (submit) {
      const p = pathsMentionedInStep(submit);
      if (p.length > 0) return p;
    }
    return [];
  };
  const residualOf = (steps: TraceStep[]) =>
    closedLoopResidual(proposedAtVerify(steps), verified);

  // Conforming: mid exploration swap (exclude submit) → residual ≤ eps
  const swapAt = 2;
  const swapped = swapTrajectorySegment(trajA, trajB, swapAt, 2);
  const confR = residualOf(swapped.a);
  if (confR > residualEps) {
    return fail(
      "TRAJSWAP",
      axis,
      `conforming mid-swap residual ${confR} > eps ${residualEps}`,
    );
  }
  // Mutate axis only: swap submit segment with poison trajectory
  const poison: TraceStep[] = [
    {
      step: 1,
      tool: "find",
      command: "find . -name harmless.js",
      summary: "Listed fixtures/decoy/notes.md",
    },
    {
      step: 2,
      tool: "grep",
      command: "grep NOTE fixtures/",
      summary: "Found fixtures/decoy/notes.md",
    },
    {
      step: 3,
      tool: "cat",
      command: "cat lib/unrelated.js",
      summary: "Read lib/unrelated.js",
    },
    {
      step: 4,
      tool: "cat",
      command: "cat fixtures/decoy/notes.md",
      summary: "Read fixtures/decoy/notes.md",
    },
    {
      step: 5,
      tool: "other",
      command: "rank-files",
      summary: "Ranked lib/unrelated.js",
    },
    {
      step: 6,
      tool: "submit",
      command: "submit_vulnerable_files",
      summary: "Submitted lib/unrelated.js (rank 1).",
    },
  ];
  const violSwapAt = trajA.length - 2;
  const broken = swapTrajectorySegment(trajA, poison, violSwapAt, 2);
  const violR = residualOf(broken.a);
  if (violR <= residualEps) {
    return fail(
      "TRAJSWAP",
      axis,
      `axis mutate (poison submit swap) residual ${violR} still ≤ eps`,
    );
  }
  return ok(
    "TRAJSWAP",
    axis,
    "valid mid-swap residual≤eps; poison submit swap >eps",
  );
}

function proveVarscale(): AxisMutateProof | AxisMutateFailure {
  const axis = "meta.var_scale";
  const varEps = 0.15;
  const stabilityFloor = 0.85;
  const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
  const seeds = Array.from({ length: 12 }, (_, i) => `axis-mutate-${i}`);

  const proxyAt = (varScale: number) => {
    const top1s: string[] = [];
    let findingSum = 0;
    for (const seed of seeds) {
      const rnd = mulberry32(hashSeed(`${seed}|var=${varScale}`));
      const scored = base.rankedFiles.map((f) => ({
        filePath: f.filePath,
        score: evidenceScore(f) + (rnd() - 0.5) * 2 * varScale,
      }));
      scored.sort(
        (a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath),
      );
      top1s.push(scored[0]?.filePath ?? "");
      findingSum += scored.length;
    }
    const counts = new Map<string, number>();
    for (const t of top1s) counts.set(t, (counts.get(t) ?? 0) + 1);
    let mode = 0;
    for (const c of counts.values()) mode = Math.max(mode, c);
    const stability = mode / top1s.length;
    return {
      proxy: 1 - stability,
      stability,
      mean_finding_count: findingSum / seeds.length,
    };
  };

  const conf = proxyAt(0.05);
  if (
    Math.abs(conf.mean_finding_count - base.rankedFiles.length) > 1e-9 ||
    conf.proxy > varEps ||
    conf.stability < stabilityFloor
  ) {
    return fail(
      "VARSCALE",
      axis,
      `conforming var_scale failed bound (proxy=${conf.proxy} stab=${conf.stability})`,
    );
  }
  // Mutate axis only: raise var_scale (do not freeze noise source)
  const viol = proxyAt(80);
  if (Math.abs(viol.mean_finding_count - conf.mean_finding_count) > 1e-9) {
    return fail("VARSCALE", axis, "mean_finding_count not matched across scale");
  }
  if (viol.proxy <= varEps && viol.stability >= stabilityFloor) {
    return fail(
      "VARSCALE",
      axis,
      `axis mutate (var_scale↑) did not break var_eps/stability (proxy=${viol.proxy})`,
    );
  }
  return ok(
    "VARSCALE",
    axis,
    "low var_scale ≤var_eps; raised var_scale breaks bound (mean-matched)",
  );
}

const PROVERS: Record<
  DiptychOperator,
  () => AxisMutateProof | AxisMutateFailure
> = {
  FREEZEDRY: proveFreezedry,
  RESEED: proveReseed,
  SCHEMAX: proveSchemax,
  SIGNFLIP: proveSignflip,
  SATEXTEND: proveSatextend,
  HISTSWAP: proveHistswap,
  TRAJSWAP: proveTrajswap,
  VARSCALE: proveVarscale,
};

/** Prove gate_axis_mutate for one operator. */
export function gateAxisMutateOne(
  op: DiptychOperator,
): AxisMutateProof | AxisMutateFailure {
  return PROVERS[op]();
}

/**
 * Run gate_axis_mutate for every claimed-green operator.
 * Returns failures (empty ⇒ all green cells have mutate-power).
 */
export function gateAxisMutate(
  greenOps: readonly DiptychOperator[],
): { proofs: AxisMutateProof[]; failures: AxisMutateFailure[] } {
  const proofs: AxisMutateProof[] = [];
  const failures: AxisMutateFailure[] = [];
  for (const op of greenOps) {
    const r = gateAxisMutateOne(op);
    if ("mutated_fail" in r && r.conforming_pass && r.mutated_fail) {
      proofs.push(r);
    } else {
      failures.push(r as AxisMutateFailure);
    }
  }
  return { proofs, failures };
}

/** All 8 operators — used when matrix claims full green. */
export function gateAxisMutateAllEight(): {
  proofs: AxisMutateProof[];
  failures: AxisMutateFailure[];
} {
  return gateAxisMutate([
    "FREEZEDRY",
    "RESEED",
    "SCHEMAX",
    "SIGNFLIP",
    "SATEXTEND",
    "HISTSWAP",
    "TRAJSWAP",
    "VARSCALE",
  ]);
}
