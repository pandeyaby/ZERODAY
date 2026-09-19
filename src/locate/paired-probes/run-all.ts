/**
 * Run all 8 DIPTYCH paired probes → zeroday-reports artifacts + coverage matrix.
 * Keyless / offline. Fail closed on GATING violations for claimed-green ops.
 */

import path from "node:path";
import { runFreezedry } from "./operators/freezedry";
import { runReseed } from "./operators/reseed";
import { runSchemax } from "./operators/schemax";
import { runSatextend } from "./operators/satextend";
import { runHistswap } from "./operators/histswap";
import { runSignflip } from "./operators/signflip";
import { runTrajswap } from "./operators/trajswap";
import { runVarscale } from "./operators/varscale";
import { buildMatrix, gateEnvelopes, writeMatrix } from "./gate";
import type { DiptychOperator, ZerodayCoverageMatrix } from "./types";

export const JUSTIFICATIONS: Record<
  DiptychOperator,
  { status: "green" | "deferred"; justification: string }
> = {
  FREEZEDRY: {
    status: "green",
    justification:
      "Freeze rng+clock via serialize_restore of LocalizationResult → identical decision_fingerprint; unfrozen clock/rng leak diverges. Valid witness: frozen decision packet + SARIF graded keys.",
  },
  RESEED: {
    status: "green",
    justification:
      "meta.seed reshuffles multi-finding ranks; seed-independent grade stays ≤ε; seed-leaking policy exceeds ε. Valid witness: mulberry32 seed on rankedFiles + stability.values.",
  },
  SCHEMAX: {
    status: "green",
    justification:
      "Documented result.* + sarif.* required key sets equal across rules vs recording fixtures; drop/rename fails. Valid witness: real telemetry/SARIF schema keys (not renamed cosmetics).",
  },
  SIGNFLIP: {
    status: "green",
    justification:
      "Signed score_margin=score(top1)−score(top2) from evidence weights; flip+re-sort preserves odd-symmetric invariant; flip-without-reorder breaks it. Not SARIF level rename / rank negate.",
  },
  SATEXTEND: {
    status: "green",
    justification:
      "Antares/ZERODAY tool-budget clip [1,50] via resolveLiveToolBudget is a real saturation bound; unsaturated leak (999) enters violation region. Valid witness: sat_lo/sat_hi on tool_budget channel.",
  },
  HISTSWAP: {
    status: "green",
    justification:
      "explorationTrace is the real history delay-line; clean self-splice preserves digest; alt-history corrupt splice diverges. Valid witness: channels.history + hist_splice_at.",
  },
  TRAJSWAP: {
    status: "green",
    justification:
      "crn_closed_loop: explorationTrace trajectory + nonempty closed_loop_residual=1−Jaccard(proposed,verified); mid traj_swap_at keeps residual≤eps vs poison swap >eps.",
  },
  VARSCALE: {
    status: "green",
    justification:
      "crn_closed_loop: meta.var_scale jitters evidence weights; variance_proxy mean-matched on mean_finding_count; ≤var_eps vs break. Not AUROC / rank-scale-as-variance.",
  },
};

export async function runAllPairedProbes(outputRoot: string): Promise<{
  matrix: ZerodayCoverageMatrix;
  matrixPath: string;
}> {
  const root = path.resolve(outputRoot);

  runFreezedry(root);
  runReseed(root);
  await runSchemax(root);
  runSatextend(root);
  runHistswap(root);
  runSignflip(root);
  runTrajswap(root);
  runVarscale(root);

  const matrix = buildMatrix(JUSTIFICATIONS);
  const matrixPath = writeMatrix(root, matrix);
  const failures = gateEnvelopes(root, matrix);
  if (failures.length > 0) {
    const msg = failures
      .map((f) => `- ${f.op}${f.role ? "/" + f.role : ""}: ${f.message}`)
      .join("\n");
    throw new Error(`Paired-probe GATING failed:\n${msg}`);
  }
  return { matrix, matrixPath };
}
