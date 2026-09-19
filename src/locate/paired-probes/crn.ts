/**
 * CRN helpers for TRAJSWAP — locate→verify closed-loop residual (1 − Jaccard).
 */

import type { TraceStep } from "../types";

/** Extract repo-relative paths mentioned in exploration tool commands / summaries. */
export function pathsMentionedInStep(step: TraceStep): string[] {
  const blob = `${step.command} ${step.summary}`;
  const found = new Set<string>();
  const re = /(?:^|[\s`"'(])((?:src|lib|app|test|tests|fixtures)\/[\w./-]+\.\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    found.add(m[1].replace(/\\/g, "/"));
  }
  return [...found].sort();
}

/** Cumulative proposed file set along a trajectory (union of path mentions). */
export function cumulativeProposed(steps: TraceStep[]): string[][] {
  const acc = new Set<string>();
  const series: string[][] = [];
  for (const step of steps) {
    for (const p of pathsMentionedInStep(step)) acc.add(p);
    series.push([...acc].sort());
  }
  return series;
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union === 0 ? 1 : inter / union;
}

/** closed_loop_residual = 1 − Jaccard(proposed, verified); lower is better. */
export function closedLoopResidual(
  proposed: Iterable<string>,
  verified: Iterable<string>,
): number {
  return 1 - jaccard(proposed, verified);
}

export function residualSeries(
  proposedSeries: string[][],
  verified: string[],
): number[] {
  return proposedSeries.map((p) => closedLoopResidual(p, verified));
}

export function swapTrajectorySegment(
  a: TraceStep[],
  b: TraceStep[],
  at: number,
  length: number,
): { a: TraceStep[]; b: TraceStep[] } {
  if (at < 0 || length < 1) {
    throw new Error("traj_swap_at/length invalid");
  }
  if (at + length > a.length || at + length > b.length) {
    throw new Error("traj swap segment out of range");
  }
  const segA = a.slice(at, at + length);
  const segB = b.slice(at, at + length);
  const nextA = [...a.slice(0, at), ...segB, ...a.slice(at + length)];
  const nextB = [...b.slice(0, at), ...segA, ...b.slice(at + length)];
  // Re-number steps for cassette readability
  return {
    a: nextA.map((s, i) => ({ ...s, step: i + 1 })),
    b: nextB.map((s, i) => ({ ...s, step: i + 1 })),
  };
}

export function maxResidual(values: number[]): number {
  return values.reduce((m, v) => Math.max(m, v), 0);
}
