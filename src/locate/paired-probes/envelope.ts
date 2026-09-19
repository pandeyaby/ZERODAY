/**
 * Envelope + cassette path helpers for DIPTYCH v0.2.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  CassetteFormat,
  ControlRole,
  Coupling,
  DiptychOperator,
  DiptychPairedProbeEnvelope,
  ExpectedVerdict,
  PairedProbeTrace,
} from "./types";
import { DIPTYCH_SCHEMA, PAIRED_PROBE_SOURCE } from "./types";

export function cassetteRelPath(
  op: DiptychOperator,
  role: ControlRole,
  ext: "json" | "bin" = "json",
): string {
  return `diptych-probes/${op}/${role}/cassette.${ext}`;
}

export function artifactRelPath(op: DiptychOperator, role: ControlRole): string {
  return `paired-probe/${op}/${role}.json`;
}

export function buildEnvelope(opts: {
  operator: DiptychOperator;
  coupling: Coupling;
  control_role: ControlRole;
  expected_verdict: ExpectedVerdict;
  probe_id: string;
  fixture_id: string;
  cassette: { format: CassetteFormat; bytes_or_path: string };
  traces: PairedProbeTrace[];
  horizon?: { unit: "steps" | "ms" | "events"; length: number };
}): DiptychPairedProbeEnvelope {
  if (opts.traces.length < 2) {
    throw new Error(
      `${opts.operator}/${opts.control_role}: traces.length must be ≥2 (got ${opts.traces.length})`,
    );
  }
  return {
    diptych_schema: DIPTYCH_SCHEMA,
    source: PAIRED_PROBE_SOURCE,
    operator: opts.operator,
    coupling: opts.coupling,
    horizon: opts.horizon ?? { unit: "steps", length: opts.traces.length },
    probe_id: opts.probe_id,
    fixture_id: opts.fixture_id,
    control_role: opts.control_role,
    cassette: opts.cassette,
    traces: opts.traces,
    expected_verdict: opts.expected_verdict,
    limits: {
      localizationOnly: true,
      notExploitability: true,
      noPoC: true,
    },
  };
}

export function writeEnvelope(
  outputRoot: string,
  envelope: DiptychPairedProbeEnvelope,
): string {
  const rel = artifactRelPath(envelope.operator, envelope.control_role);
  const abs = path.join(outputRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(envelope, null, 2) + "\n");
  return abs;
}

export function writeCassetteBytes(
  outputRoot: string,
  op: DiptychOperator,
  role: ControlRole,
  payload: unknown,
  ext: "json" | "bin" = "json",
): { abs: string; rel: string } {
  const rel = cassetteRelPath(op, role, ext);
  const abs = path.join(outputRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (ext === "json") {
    fs.writeFileSync(abs, JSON.stringify(payload, null, 2) + "\n");
  } else {
    const buf = Buffer.from(
      typeof payload === "string" ? payload : JSON.stringify(payload),
      "utf8",
    );
    fs.writeFileSync(abs, buf);
  }
  return { abs, rel };
}

export function assertNoForbiddenFields(blob: string): void {
  const lower = blob.toLowerCase();
  // Hard omit exploit/PoC/payload/AUROC as graded fields — allow negation phrases.
  if (/"auroc"\s*:/.test(lower) || /"model_auroc"\s*:/.test(lower)) {
    throw new Error("Forbidden AUROC field in paired-probe artifact");
  }
  if (/"poc"\s*:\s*"/.test(lower) || /"exploit_payload"\s*:/.test(lower)) {
    throw new Error("Forbidden exploit/PoC field in paired-probe artifact");
  }
}
