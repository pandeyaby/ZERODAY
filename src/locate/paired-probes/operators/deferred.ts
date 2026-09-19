/**
 * Deferred Wave B/C operators without a valid ZeroDay semantic witness.
 * Emit honest inconclusive twins (≠ green). Never hardcoded pass.
 *
 * SIGNFLIP — no signed continuous polarity channel (SARIF level is categorical;
 * ranks are positive ordinals). Cosmetic note↔error rename ≠ asymmetric gain.
 *
 * TRAJSWAP — requires crn_closed_loop + closed_loop_residual; locate is open-loop
 * desk localization with no closed-loop residual channel. RankedFile permute alone
 * is not a valid CRN trajectory witness.
 *
 * VARSCALE — no variance_proxy / noise-scale channel on localization decisions.
 * Rank/score scale ≠ workload variance. AUROC forbidden.
 */

import type {
  Coupling,
  DiptychOperator,
  DiptychPairedProbeEnvelope,
} from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";

const DEFER_REASONS: Record<
  "SIGNFLIP" | "TRAJSWAP" | "VARSCALE",
  { coupling: Coupling; reason: string }
> = {
  SIGNFLIP: {
    coupling: "open_loop",
    reason:
      "deferred_without_semantic_witness: ZeroDay SARIF levels are categorical " +
      "(note/warning/error) and ranks are positive ordinals — no signed continuous " +
      "polarity channel for SIGNFLIP asymmetric-gain hyperproperty. Cosmetic severity " +
      "rename would fail axis-power.",
  },
  TRAJSWAP: {
    coupling: "crn_closed_loop",
    reason:
      "deferred_without_semantic_witness: TRAJSWAP requires crn_closed_loop with " +
      "channels.trajectory.* and channels.closed_loop_residual.values. ZeroDay locate " +
      "is open-loop desk localization — no closed-loop residual witness. rankedFiles " +
      "permute alone is not a valid CRN trajectory swap.",
  },
  VARSCALE: {
    coupling: "crn_closed_loop",
    reason:
      "deferred_without_semantic_witness: no variance_proxy / noise-scale channel on " +
      "localization decisions. Rank or score scale ≠ mean-matched variance. Lab AUROC " +
      "is hard-omitted and not a hyperproperty grade.",
  },
};

function emitDeferred(
  outputRoot: string,
  op: "SIGNFLIP" | "TRAJSWAP" | "VARSCALE",
): {
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
} {
  const { coupling, reason } = DEFER_REASONS[op];

  const mk = (role: "conforming" | "violating") => {
    writeCassetteBytes(outputRoot, op, role, {
      deferred_without_semantic_witness: true,
      reason,
    });
    const envelope = buildEnvelope({
      operator: op as DiptychOperator,
      coupling,
      control_role: role,
      expected_verdict: "inconclusive",
      probe_id: `zeroday.${op.toLowerCase()}.${role}`,
      fixture_id: "deferred-no-witness",
      cassette: {
        format: "none",
        bytes_or_path: `diptych-probes/${op}/${role}/cassette.json`,
      },
      traces: [
        {
          trace_id: "a",
          events: [],
          channels: {},
          meta: {
            inconclusive_reason: reason,
            deferred_without_semantic_witness: true,
          },
        },
        {
          trace_id: "b",
          events: [],
          channels: {},
          meta: {
            inconclusive_reason: reason,
            deferred_without_semantic_witness: true,
          },
        },
      ],
    });
    writeEnvelope(outputRoot, envelope);
    return envelope;
  };

  return { conforming: mk("conforming"), violating: mk("violating") };
}

export function runSignflip(outputRoot: string) {
  return emitDeferred(outputRoot, "SIGNFLIP");
}

export function runTrajswap(outputRoot: string) {
  return emitDeferred(outputRoot, "TRAJSWAP");
}

export function runVarscale(outputRoot: string) {
  return emitDeferred(outputRoot, "VARSCALE");
}
