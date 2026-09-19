/**
 * Local GATING mirror (DIPTYCH GATING.md) — fail CI on thin implementations.
 */

import fs from "node:fs";
import path from "node:path";
import {
  OPERATORS,
  type ControlRole,
  type CoverageCellStatus,
  type DiptychOperator,
  type DiptychPairedProbeEnvelope,
  type ZerodayCoverageMatrix,
  DIPTYCH_SCHEMA,
  PAIRED_PROBE_SOURCE,
} from "./types";
import { artifactRelPath } from "./envelope";

const STUB_MARKERS = [
  /\bTODO\b/,
  /\bNotImplemented\b/i,
  /\bstub\b/i,
  /\bnot_implemented\b/i,
  /\bhardcoded\s+pass\b/i,
];

export interface GateFailure {
  op: DiptychOperator | "*";
  role?: ControlRole;
  message: string;
}

export function loadEnvelope(
  outputRoot: string,
  op: DiptychOperator,
  role: ControlRole,
): DiptychPairedProbeEnvelope {
  const abs = path.join(outputRoot, artifactRelPath(op, role));
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing artifact: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8")) as DiptychPairedProbeEnvelope;
}

export function gateEnvelopes(
  outputRoot: string,
  matrix: ZerodayCoverageMatrix,
): GateFailure[] {
  const failures: GateFailure[] = [];

  for (const op of OPERATORS) {
    let conf: DiptychPairedProbeEnvelope;
    let viol: DiptychPairedProbeEnvelope;
    try {
      conf = loadEnvelope(outputRoot, op, "conforming");
      viol = loadEnvelope(outputRoot, op, "violating");
    } catch (e) {
      failures.push({
        op,
        message: `Missing twin: ${(e as Error).message}`,
      });
      continue;
    }

    for (const env of [conf, viol]) {
      if (env.diptych_schema !== DIPTYCH_SCHEMA) {
        failures.push({
          op,
          role: env.control_role,
          message: `diptych_schema must be "0.2" (got ${env.diptych_schema})`,
        });
      }
      if (env.source !== PAIRED_PROBE_SOURCE) {
        failures.push({
          op,
          role: env.control_role,
          message: `source must be "zeroday"`,
        });
      }
      if (!env.traces || env.traces.length < 2) {
        failures.push({
          op,
          role: env.control_role,
          message: `traces.length must be ≥2`,
        });
      }
      if (!env.control_role || !env.expected_verdict || !env.probe_id) {
        failures.push({
          op,
          role: env.control_role,
          message: `Hard keys missing (control_role/expected_verdict/probe_id)`,
        });
      }
      const blob = JSON.stringify(env);
      for (const re of STUB_MARKERS) {
        if (re.test(blob) && !/deferred_without_semantic_witness/.test(blob)) {
          // Allow the word in inconclusive_reason docs only when deferred flagged
          if (
            env.expected_verdict !== "inconclusive" ||
            !env.traces.some((t) => t.meta?.deferred_without_semantic_witness)
          ) {
            failures.push({
              op,
              role: env.control_role,
              message: `Stub marker detected: ${re}`,
            });
          }
        }
      }
      if (/"auroc"\s*:/.test(blob.toLowerCase())) {
        failures.push({
          op,
          role: env.control_role,
          message: "Forbidden AUROC field",
        });
      }
    }

    // Coupling requirements
    if (op === "TRAJSWAP" || op === "VARSCALE") {
      if (conf.coupling !== "crn_closed_loop" || viol.coupling !== "crn_closed_loop") {
        failures.push({
          op,
          message: `${op} must use coupling crn_closed_loop`,
        });
      }
    }

    const cell = matrix.operators[op];
    if (!cell) {
      failures.push({ op, message: "Missing coverage matrix cell" });
      continue;
    }

    if (cell.status === "green") {
      if (conf.expected_verdict !== "pass") {
        failures.push({
          op,
          role: "conforming",
          message: `green cell requires conforming→pass (got ${conf.expected_verdict})`,
        });
      }
      if (viol.expected_verdict !== "fail") {
        failures.push({
          op,
          role: "violating",
          message: `green cell requires violating→fail (got ${viol.expected_verdict})`,
        });
      }
      if (conf.expected_verdict === viol.expected_verdict) {
        failures.push({
          op,
          message: "Identical expected_verdict on twins — no contrast",
        });
      }
      // Axis power: traces must not be identical twins with no channel contrast
      const ta = JSON.stringify(conf.traces);
      const tb = JSON.stringify(viol.traces);
      if (ta === tb) {
        failures.push({
          op,
          message: "Conforming and violating traces identical — no axis power",
        });
      }

      // WITNESSES_ZERODAY shape — reject thin/empty channels on claimed green
      if (op === "SIGNFLIP") {
        for (const env of [conf, viol]) {
          const ch = env.traces[0]?.meta?.signflip_channel;
          const vals = (
            env.traces[0]?.channels?.score_margin as
              | { values?: number[] }
              | undefined
          )?.values;
          if (ch !== "score_margin" || !vals || vals.length < 1) {
            failures.push({
              op,
              role: env.control_role,
              message:
                "SIGNFLIP green requires meta.signflip_channel=score_margin + channels.score_margin.values",
            });
          }
        }
      }
      if (op === "TRAJSWAP") {
        for (const env of [conf, viol]) {
          const residual = env.traces[0]?.channels?.closed_loop_residual?.values;
          const swapAt = env.traces[0]?.meta?.traj_swap_at;
          if (!residual || residual.length < 1) {
            failures.push({
              op,
              role: env.control_role,
              message:
                "TRAJSWAP green requires non-empty channels.closed_loop_residual.values",
            });
          }
          if (typeof swapAt !== "number") {
            failures.push({
              op,
              role: env.control_role,
              message: "TRAJSWAP green requires meta.traj_swap_at",
            });
          }
        }
      }
      if (op === "VARSCALE") {
        for (const env of [conf, viol]) {
          const scale = env.traces[0]?.meta?.var_scale;
          const proxy = env.traces[0]?.channels?.variance_proxy?.values;
          const mean = env.traces[0]?.meta?.mean_finding_count;
          if (typeof scale !== "number" || !proxy || proxy.length < 1) {
            failures.push({
              op,
              role: env.control_role,
              message:
                "VARSCALE green requires meta.var_scale + channels.variance_proxy.values",
            });
          }
          if (typeof mean !== "number") {
            failures.push({
              op,
              role: env.control_role,
              message:
                "VARSCALE green requires meta.mean_finding_count (mean-matched)",
            });
          }
        }
      }
    } else if (cell.status === "deferred") {
      if (
        conf.expected_verdict !== "inconclusive" ||
        viol.expected_verdict !== "inconclusive"
      ) {
        failures.push({
          op,
          message:
            "deferred cell requires both roles inconclusive with documented reason",
        });
      }
      for (const env of [conf, viol]) {
        const reason =
          env.traces[0]?.meta?.inconclusive_reason ||
          env.traces[0]?.meta?.deferred_without_semantic_witness;
        if (!reason) {
          failures.push({
            op,
            role: env.control_role,
            message: "deferred inconclusive missing meta.inconclusive_reason",
          });
        }
      }
    } else if (cell.status === "stub" || cell.status === "pending") {
      failures.push({
        op,
        message: `Coverage status ${cell.status} is not allowed in CI (≠ green|deferred)`,
      });
    }
  }

  return failures;
}

export function buildMatrix(
  cells: Record<DiptychOperator, { status: CoverageCellStatus; justification: string }>,
): ZerodayCoverageMatrix {
  const operators = {} as ZerodayCoverageMatrix["operators"];
  for (const op of OPERATORS) {
    const c = cells[op];
    operators[op] = {
      status: c.status,
      justification: c.justification,
      conforming_path: artifactRelPath(op, "conforming"),
      violating_path: artifactRelPath(op, "violating"),
    };
  }
  return {
    diptych_schema: DIPTYCH_SCHEMA,
    source: PAIRED_PROBE_SOURCE,
    operators,
  };
}

export function writeMatrix(outputRoot: string, matrix: ZerodayCoverageMatrix): string {
  const abs = path.join(outputRoot, "paired-probe/coverage/matrix.json");
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(matrix, null, 2) + "\n");
  return abs;
}
