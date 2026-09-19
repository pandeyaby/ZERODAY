/**
 * Build a DIPTYCH-shaped **sample / illustrative** grade report from local
 * ZeroDay paired-probe emit envelopes + gate_axis_mutate proofs.
 *
 * Keyless. No DIPTYCH package dependency. Not a live DIPTYCH harness claim.
 * Greens are hyperproperty adapter cells — localization ≠ exploitability.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  OPERATORS,
  type ControlRole,
  type DiptychOperator,
  type DiptychPairedProbeEnvelope,
  type ZerodayCoverageMatrix,
} from "./types";
import { loadEnvelope } from "./gate";
import {
  gateAxisMutateAllEight,
  type AxisMutateProof,
} from "./gate-axis-mutate";
import { JUSTIFICATIONS } from "./run-all";

export const SAMPLE_GRADE_KIND = "zeroday.diptych_sample_grade/v1" as const;

/** Mirrors DIPTYCH `GradeResult.to_dict()` shape (illustrative). */
export interface SampleGradeCell {
  operator: DiptychOperator;
  probe_id: string;
  control_role: ControlRole;
  expected_verdict: string;
  /** Illustrative: mirrors emit `expected_verdict` (not a live DIPTYCH grade). */
  actual_verdict: string;
  reason: string;
  evidence: Record<string, unknown>;
  matches_expected: boolean;
}

export interface SampleDiptychGradeReport {
  kind: typeof SAMPLE_GRADE_KIND;
  sample: true;
  live_diptych_run: false;
  label: "sample / illustrative";
  diptych_schema: string;
  source: "zeroday";
  emit_root: string;
  emit_content_sha256: string;
  non_claims: string[];
  matrix_summary: {
    operator: DiptychOperator;
    status: string;
    justification: string;
  }[];
  results: SampleGradeCell[];
  axis_power: {
    operator: DiptychOperator;
    axis: string;
    conforming_pass: true;
    mutated_fail: true;
    detail: string;
  }[];
  story: string;
}

const NON_CLAIMS = [
  "Sample ≠ product proof of exploitability",
  "Greens are hyperproperty adapter cells (FREEZEDRY…VARSCALE), not vuln proof",
  "DIPTYCH grades; ZeroDay emits — this file is an illustrative DIPTYCH-shaped mirror",
  "Not a live DIPTYCH harness run unless you clone DIPTYCH and point it at the emit",
  "No PoC / AUROC / attack-procedure theater",
  "needs_human stays true; never auto-merge",
] as const;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function evidenceFromEnvelope(
  env: DiptychPairedProbeEnvelope,
): Record<string, unknown> {
  const t0 = env.traces[0];
  const meta = (t0?.meta ?? {}) as Record<string, unknown>;
  const channels = t0?.channels ?? {};
  const pick = (...keys: string[]) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (meta[k] !== undefined) out[k] = meta[k];
    }
    return out;
  };
  return {
    coupling: env.coupling,
    channel_keys: Object.keys(channels).sort(),
    meta_subset: pick(
      "freeze_channels",
      "decision_fingerprint",
      "seed",
      "epsilon",
      "required_schema_keys",
      "signflip_channel",
      "sat_lo",
      "sat_hi",
      "hist_splice_at",
      "traj_swap_at",
      "residual_eps",
      "var_scale",
      "var_eps",
      "mean_finding_count",
      "stability_floor",
    ),
  };
}

function cellFromEnvelope(env: DiptychPairedProbeEnvelope): SampleGradeCell {
  const expected = env.expected_verdict;
  // Illustrative mirror: well-formed ZeroDay emits already encode the
  // conforming→pass / violating→fail story DIPTYCH would grade.
  const actual = expected;
  const role = env.control_role;
  const reason =
    role === "conforming"
      ? "illustrative: conforming emit expects pass (hyperproperty holds on axis); ZeroDay CI gated twin shape"
      : "illustrative: violating emit expects fail (axis broken); ZeroDay CI gated twin contrast";
  return {
    operator: env.operator,
    probe_id: env.probe_id,
    control_role: role,
    expected_verdict: expected,
    actual_verdict: actual,
    reason,
    evidence: evidenceFromEnvelope(env),
    matches_expected: actual === expected,
  };
}

export function buildSampleDiptychGradeReport(
  emitRoot: string,
  matrix: ZerodayCoverageMatrix,
  proofs: AxisMutateProof[],
): SampleDiptychGradeReport {
  const root = path.resolve(emitRoot);
  const results: SampleGradeCell[] = [];
  const emitBlobs: unknown[] = [];

  for (const op of OPERATORS) {
    for (const role of ["conforming", "violating"] as const) {
      const env = loadEnvelope(root, op, role);
      emitBlobs.push(env);
      results.push(cellFromEnvelope(env));
    }
  }

  const emit_content_sha256 = crypto
    .createHash("sha256")
    .update(stableStringify(emitBlobs))
    .digest("hex");

  const matrix_summary = OPERATORS.map((op) => ({
    operator: op,
    status: matrix.operators[op].status,
    justification: matrix.operators[op].justification,
  }));

  const allGreen = matrix_summary.every((c) => c.status === "green");
  const allAxis = proofs.length === OPERATORS.length;
  const story =
    allGreen && allAxis
      ? "FREEZEDRY…VARSCALE all-green story — emit twins + gate_axis_mutate power on every claimed-green cell."
      : "Partial / deferred coverage — see matrix_summary and axis_power (prefer honest deferral over thin green).";

  return {
    kind: SAMPLE_GRADE_KIND,
    sample: true,
    live_diptych_run: false,
    label: "sample / illustrative",
    diptych_schema: matrix.diptych_schema,
    source: "zeroday",
    emit_root: root,
    emit_content_sha256,
    non_claims: [...NON_CLAIMS],
    matrix_summary,
    results,
    axis_power: proofs.map((p) => ({
      operator: p.op,
      axis: p.axis,
      conforming_pass: true as const,
      mutated_fail: true as const,
      detail: p.detail,
    })),
    story,
  };
}

export function renderSampleGradeMarkdown(
  report: SampleDiptychGradeReport,
): string {
  const lines: string[] = [];
  lines.push("# SAMPLE / ILLUSTRATIVE — DIPTYCH-shaped grade report");
  lines.push("");
  lines.push(
    "> **Not a live DIPTYCH harness run.** Regenerated keyless from ZeroDay",
  );
  lines.push(
    "> `paired-probe` emit envelopes + local `gate_axis_mutate`. DIPTYCH grades;",
  );
  lines.push(
    "> ZeroDay emits. Localization ≠ exploitability. No PoC / AUROC theater.",
  );
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| kind | \`${report.kind}\` |`);
  lines.push(`| sample | \`${report.sample}\` |`);
  lines.push(`| live_diptych_run | \`${report.live_diptych_run}\` |`);
  lines.push(`| diptych_schema | \`${report.diptych_schema}\` |`);
  lines.push(`| emit_content_sha256 | \`${report.emit_content_sha256}\` |`);
  lines.push(`| story | ${report.story} |`);
  lines.push("");
  lines.push("## Stranger path (no DIPTYCH clone required)");
  lines.push("");
  lines.push("```bash");
  lines.push("npm install");
  lines.push("npm run paired-probe");
  lines.push("# → zeroday-reports/paired-probe/  (+ diptych-probes/)");
  lines.push("npm run paired-probe:sample-report");
  lines.push("# → refreshes docs/reports/diptych-sample-grade.md + .json");
  lines.push("```");
  lines.push("");
  lines.push(
    "Optional: clone [DIPTYCH](https://github.com/pandeyaby/DIPTYCH) and point its",
  );
  lines.push(
    "grader at `zeroday-reports/paired-probe/` for a **live** grade — that step is",
  );
  lines.push("not required to read this sample.");
  lines.push("");
  lines.push("## Coverage matrix (ZeroDay emit)");
  lines.push("");
  lines.push("| Operator | Cell | Justification |");
  lines.push("|----------|------|---------------|");
  for (const row of report.matrix_summary) {
    const j =
      row.justification.length > 100
        ? `${row.justification.slice(0, 97)}…`
        : row.justification;
    lines.push(`| **${row.operator}** | ${row.status} | ${j} |`);
  }
  lines.push("");
  lines.push("## Illustrative grade cells (DIPTYCH `GradeResult` shape)");
  lines.push("");
  lines.push(
    "Each cell’s `actual_verdict` **mirrors** the emit `expected_verdict`",
  );
  lines.push(
    "(conforming→pass, violating→fail). That is the design-partner story ZeroDay",
  );
  lines.push(
    "CI already gates — not a claim that `diptych.grade` was executed in this repo.",
  );
  lines.push("");
  lines.push(
    "| Operator | Role | expected | actual (illustrative) | match | probe_id |",
  );
  lines.push(
    "|----------|------|----------|------------------------|-------|----------|",
  );
  for (const r of report.results) {
    lines.push(
      `| ${r.operator} | ${r.control_role} | ${r.expected_verdict} | ${r.actual_verdict} | ${r.matches_expected ? "yes" : "no"} | \`${r.probe_id}\` |`,
    );
  }
  lines.push("");
  lines.push("## Axis power (`gate_axis_mutate`)");
  lines.push("");
  lines.push(
    "Real ZeroDay CI proof: mutate **only** the operator axis on the conforming",
  );
  lines.push("state → grade must flip pass→fail.");
  lines.push("");
  lines.push("| Operator | Axis | conforming→pass | mutate→fail | Detail |");
  lines.push("|----------|------|-----------------|-------------|--------|");
  for (const p of report.axis_power) {
    lines.push(
      `| ${p.operator} | \`${p.axis}\` | yes | yes | ${p.detail} |`,
    );
  }
  lines.push("");
  lines.push("## Honest non-claims");
  lines.push("");
  for (const c of report.non_claims) {
    lines.push(`- ${c}`);
  }
  lines.push("");
  lines.push("## How DIPTYCH would grade these emits");
  lines.push("");
  lines.push(
    "1. Load each `paired-probe/<OP>/{conforming,violating}.json` envelope",
  );
  lines.push("   (`diptych_schema` 0.2, `source=zeroday`).");
  lines.push(
    "2. Run the per-operator substantive grader (FREEZEDRY fingerprint",
  );
  lines.push(
    "   identity, RESEED stability≤ε, …, VARSCALE mean-matched variance).",
  );
  lines.push(
    "3. Require conforming→pass **and** violating→fail for a green cell.",
  );
  lines.push(
    "4. Require `gate_axis_mutate` power (ZeroDay already proves this in CI).",
  );
  lines.push("");
  lines.push("Related: [`docs/paired-probes.md`](../paired-probes.md) ·");
  lines.push("[`docs/diptych-onepager.md`](../diptych-onepager.md) ·");
  lines.push("[DIPTYCH](https://github.com/pandeyaby/DIPTYCH).");
  lines.push("");
  return lines.join("\n");
}

export function writeSampleGradeReport(opts: {
  emitRoot: string;
  outDir: string;
  matrix: ZerodayCoverageMatrix;
}): { report: SampleDiptychGradeReport; mdPath: string; jsonPath: string } {
  const { proofs, failures } = gateAxisMutateAllEight();
  if (failures.length > 0) {
    const msg = failures
      .map((f) => `- ${f.op} [${f.axis}]: ${f.message}`)
      .join("\n");
    throw new Error(
      `Cannot write sample grade: gate_axis_mutate failures:\n${msg}`,
    );
  }
  const report = buildSampleDiptychGradeReport(
    opts.emitRoot,
    opts.matrix,
    proofs,
  );
  const outDir = path.resolve(opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const mdPath = path.join(outDir, "diptych-sample-grade.md");
  const jsonPath = path.join(outDir, "diptych-sample-grade.json");
  fs.writeFileSync(mdPath, renderSampleGradeMarkdown(report));
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, mdPath, jsonPath };
}

/** Load coverage matrix written by `npm run paired-probe`. */
export function loadMatrixOrJustifications(
  emitRoot: string,
): ZerodayCoverageMatrix {
  const abs = path.join(
    path.resolve(emitRoot),
    "paired-probe/coverage/matrix.json",
  );
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Missing coverage matrix: ${abs} (run npm run paired-probe first)`,
    );
  }
  const matrix = JSON.parse(
    fs.readFileSync(abs, "utf8"),
  ) as ZerodayCoverageMatrix;
  // Prefer checked JUSTIFICATIONS text when present (keeps sample aligned with CI story).
  for (const op of OPERATORS) {
    if (JUSTIFICATIONS[op] && matrix.operators[op]) {
      matrix.operators[op].justification = JUSTIFICATIONS[op].justification;
      matrix.operators[op].status = JUSTIFICATIONS[op].status;
    }
  }
  return matrix;
}
