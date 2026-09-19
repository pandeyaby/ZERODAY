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
import {
  runSignflip,
  runTrajswap,
  runVarscale,
} from "./operators/deferred";
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
    status: "deferred",
    justification:
      "No signed continuous polarity channel (levels categorical; ranks positive). deferred_without_semantic_witness — not green.",
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
    status: "deferred",
    justification:
      "No closed_loop_residual / CRN trajectory witness on open-loop locate. deferred_without_semantic_witness — coupling tagged crn_closed_loop but inconclusive.",
  },
  VARSCALE: {
    status: "deferred",
    justification:
      "No variance_proxy channel; rank scale ≠ variance; AUROC omitted. deferred_without_semantic_witness.",
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
