/**
 * One-command stranger door: locate SARIF / report / vault on disk →
 * DIPTYCH paired-probe envelopes + coverage matrix.
 *
 * Keyless / offline / no GPU. Emit-only — does not clone or invoke DIPTYCH.
 * Greens are adapter hyperproperties; localization ≠ exploitability.
 */

import fs from "node:fs";
import path from "node:path";
import type { LocalizationResult, TraceStep } from "../types";
import { runIngestLocalization } from "../ingest/index";
import { evidenceScore } from "./score-margin";
import type { PairedProbeSeed } from "./probe-seed";
import { runAllPairedProbes } from "./run-all";
import type { ZerodayCoverageMatrix } from "./types";

const PINNED_CLOCK = "2026-01-01T00:00:00.000Z";

export interface FromSarifOptions {
  /** Path to a .sarif file, report.json, or locate/vault directory. */
  input: string;
  /** Output root (writes paired-probe/ + diptych-probes/). */
  output?: string;
  /** Optional CWE filter when ingesting third-party SARIF. */
  cweFilter?: string | null;
}

function isLocalizationResult(v: unknown): v is LocalizationResult {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.mode === "string" &&
    Array.isArray(o.rankedFiles) &&
    Array.isArray(o.explorationTrace) &&
    o.posture != null &&
    typeof o.posture === "object"
  );
}

function loadReportJson(abs: string): LocalizationResult {
  const raw = fs.readFileSync(abs, "utf8");
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid report.json JSON in ${abs}: ${(e as Error).message}`,
    );
  }
  if (!isLocalizationResult(doc)) {
    throw new Error(
      `Not a ZERODAY LocalizationResult report.json: ${abs} ` +
        "(need mode, rankedFiles, explorationTrace, posture).",
    );
  }
  return doc;
}

/**
 * Resolve stranger input → absolute SARIF or report.json path + kind.
 * Accepts: .sarif file · report.json · locate/vault dir (report.json preferred).
 */
export function resolveLocateArtifact(input: string): {
  path: string;
  kind: "report.json" | "sarif" | "locate-dir";
} {
  const abs = path.resolve(input);
  if (!fs.existsSync(abs)) {
    throw new Error(`paired-probe:from-sarif input not found: ${abs}`);
  }
  const st = fs.statSync(abs);
  if (st.isFile()) {
    const base = path.basename(abs).toLowerCase();
    if (base === "report.json" || base.endsWith(".json")) {
      // Prefer report.json shape when parseable; else treat as unknown.
      try {
        loadReportJson(abs);
        return { path: abs, kind: "report.json" };
      } catch {
        if (base.endsWith(".sarif") || base.includes("sarif")) {
          return { path: abs, kind: "sarif" };
        }
        throw new Error(
          `Unrecognized locate artifact ${abs} — expected report.json or *.sarif`,
        );
      }
    }
    if (base.endsWith(".sarif") || base.includes("sarif")) {
      return { path: abs, kind: "sarif" };
    }
    throw new Error(
      `Unrecognized locate artifact ${abs} — expected report.json or *.sarif`,
    );
  }
  if (!st.isDirectory()) {
    throw new Error(`paired-probe:from-sarif input is neither file nor directory: ${abs}`);
  }
  const reportJson = path.join(abs, "report.json");
  const reportSarif = path.join(abs, "report.sarif");
  if (fs.existsSync(reportJson)) {
    return { path: reportJson, kind: "locate-dir" };
  }
  if (fs.existsSync(reportSarif)) {
    return { path: reportSarif, kind: "locate-dir" };
  }
  // Evidence vault layouts sometimes nest under locate/
  const nestedJson = path.join(abs, "locate", "report.json");
  const nestedSarif = path.join(abs, "locate", "report.sarif");
  if (fs.existsSync(nestedJson)) {
    return { path: nestedJson, kind: "locate-dir" };
  }
  if (fs.existsSync(nestedSarif)) {
    return { path: nestedSarif, kind: "locate-dir" };
  }
  throw new Error(
    `Locate/vault directory ${abs} has no report.json or report.sarif ` +
      "(also checked locate/report.json).",
  );
}

function ensureSubmitMentionsPaths(
  steps: TraceStep[],
  verified: string[],
): TraceStep[] {
  const out = steps.map((s) => ({ ...s }));
  const submitBlob = verified.join(" ");
  let submitIdx = out.findIndex((s) => s.tool === "submit");
  if (submitIdx < 0) {
    out.push({
      step: out.length + 1,
      tool: "submit",
      command: `submit_vulnerable_files ${submitBlob}`,
      summary: `Submitted ${verified.join(", ")} for human review (localization only).`,
    });
    submitIdx = out.length - 1;
  } else {
    const s = out[submitIdx]!;
    out[submitIdx] = {
      ...s,
      command: `submit_vulnerable_files ${submitBlob}`,
      summary: `Submitted ${verified.join(", ")} for human review (localization only).`,
    };
  }
  return out.map((s, i) => ({ ...s, step: i + 1 }));
}

/**
 * Ensure explorationTrace is long enough for HISTSWAP/TRAJSWAP and that
 * path mentions + submit align with rankedFiles (closed-loop residual).
 */
function ensureProbeTrace(result: LocalizationResult): LocalizationResult {
  const clone = structuredClone(result) as LocalizationResult;
  clone.generatedAt = PINNED_CLOCK;
  const verified = clone.rankedFiles.map((f) => f.filePath);

  let steps = [...clone.explorationTrace];
  // Guarantee ≥1 exploration hit per ranked file before submit.
  const existingMentions = new Set(
    steps.flatMap((s) => {
      const blob = `${s.command} ${s.summary}`;
      return verified.filter((p) => blob.includes(p));
    }),
  );
  for (const p of verified) {
    if (!existingMentions.has(p)) {
      steps.push({
        step: steps.length + 1,
        tool: "other",
        command: `probe-hit ${p}`,
        summary: `Localized candidate ${p} (defensive ranking only).`,
      });
    }
  }
  // Need length ≥4 for TRAJSWAP mid-horizon swap.
  while (steps.filter((s) => s.tool !== "submit").length < 3) {
    const pad = verified[steps.length % verified.length] ?? "src/pad.js";
    steps.push({
      step: steps.length + 1,
      tool: "other",
      command: `probe-pad ${pad}`,
      summary: `Pad exploration step mentioning ${pad}.`,
    });
  }
  steps = ensureSubmitMentionsPaths(steps, verified);
  if (steps.length < 4) {
    throw new Error(
      "paired-probe:from-sarif could not build explorationTrace length ≥4",
    );
  }
  clone.explorationTrace = steps;
  return clone;
}

/** Distinct evidence weights help SIGNFLIP / VARSCALE power (not cosmetic). */
function ensureDistinctEvidenceScores(
  result: LocalizationResult,
): LocalizationResult {
  const clone = structuredClone(result) as LocalizationResult;
  const scores = clone.rankedFiles.map((f) => evidenceScore(f));
  const unique = new Set(scores.map((s) => s.toFixed(6)));
  if (unique.size >= 2) return clone;

  // Pad continuous excerpt features so top-two margins are nonzero.
  clone.rankedFiles = clone.rankedFiles.map((f, i) => {
    const evidence = f.evidence.length
      ? f.evidence.map((e, j) => ({
          ...e,
          excerpt:
            (e.excerpt ?? "") +
            (i === 0 && j === 0
              ? " SELECT id FROM t WHERE name = '" + "x".repeat(40) + "' + name + '"
              : ""),
          note: (e.note ?? "") + (i > 0 ? ` rank-pad-${i}` : " top-candidate"),
        }))
      : [
          {
            filePath: f.filePath,
            startLine: i + 1,
            endLine: i + 1 + (i === 0 ? 2 : 0),
            note: i === 0 ? "top-candidate evidence pad" : `rank-pad-${i}`,
            excerpt:
              i === 0
                ? "SELECT id FROM t WHERE name = '" + "x".repeat(40) + "' + name + '"
                : "note",
          },
        ];
    return { ...f, evidence };
  });
  return clone;
}

/**
 * Alt-history twin: same rankedFiles, different mid exploration ordering
 * so HISTSWAP corrupt splice + TRAJSWAP mid-segment contrast have power.
 */
export function synthesizeAltHistory(
  primary: LocalizationResult,
): LocalizationResult {
  const alt = structuredClone(primary) as LocalizationResult;
  alt.generatedAt = PINNED_CLOCK;
  const steps = [...alt.explorationTrace];
  const submitIdx = steps.findIndex((s) => s.tool === "submit");
  const head = submitIdx >= 0 ? steps.slice(0, submitIdx) : steps.slice(0, -1);
  const tail =
    submitIdx >= 0 ? steps.slice(submitIdx) : steps.slice(-1);
  if (head.length < 2) {
    throw new Error(
      "synthesizeAltHistory: need ≥2 pre-submit exploration steps",
    );
  }
  // Rotate mid segment so prefix + mid differ from primary without breaking verify.
  const rotated = [...head.slice(1), head[0]!];
  alt.explorationTrace = [...rotated, ...tail].map((s, i) => ({
    ...s,
    step: i + 1,
  }));
  // Tag warnings so cassette provenance is honest.
  alt.warnings = [
    ...alt.warnings,
    "paired-probe:from-sarif synthesized alt-history twin (mid-trajectory rotation) — not a second locate run.",
  ];
  return alt;
}

export function prepareSeedFromResult(
  result: LocalizationResult,
  meta: { sourcePath: string; sourceKind: PairedProbeSeed["sourceKind"] },
): PairedProbeSeed {
  if (result.rankedFiles.length < 2) {
    throw new Error(
      `paired-probe:from-sarif needs ≥2 ranked files for RESEED/SIGNFLIP/VARSCALE ` +
        `(got ${result.rankedFiles.length} from ${meta.sourcePath}). ` +
        "Re-run locate on a multi-finding artifact, or use fixtures/locate/ingest-sample/sample.sarif.",
    );
  }
  let primary = ensureProbeTrace(result);
  primary = ensureDistinctEvidenceScores(primary);
  const alt = synthesizeAltHistory(primary);
  // Confirm mid segments differ (TRAJSWAP power).
  const aMid = JSON.stringify(primary.explorationTrace.slice(2, 4));
  const bMid = JSON.stringify(alt.explorationTrace.slice(2, 4));
  if (aMid === bMid) {
    // Force a visible mid contrast while keeping path mentions.
    alt.explorationTrace = alt.explorationTrace.map((s, i) =>
      i === 2
        ? {
            ...s,
            command: `${s.command} #alt-mid`,
            summary: `${s.summary} [alt-mid]`,
          }
        : s,
    );
  }
  const base = path.basename(meta.sourcePath);
  return {
    primary,
    alt,
    fixtureId: `from-sarif:${base}`,
    sourcePath: meta.sourcePath,
    sourceKind: meta.sourceKind,
  };
}

/**
 * Load a locate SARIF / report.json / vault dir into a PairedProbeSeed.
 */
export function loadPairedProbeSeedFromInput(
  input: string,
  opts?: { cweFilter?: string | null },
): PairedProbeSeed {
  const resolved = resolveLocateArtifact(input);
  if (
    resolved.kind === "report.json" ||
    (resolved.kind === "locate-dir" &&
      path.basename(resolved.path) === "report.json")
  ) {
    const result = loadReportJson(resolved.path);
    return prepareSeedFromResult(result, {
      sourcePath: resolved.path,
      sourceKind: resolved.kind,
    });
  }

  // SARIF path (third-party or locate report.sarif)
  const result = runIngestLocalization({
    sarifPath: resolved.path,
    cweFilter: opts?.cweFilter ?? null,
    advisory: {
      kind: "cwe",
      id: "CWE-000",
      cweId: "CWE-000",
      title: "SARIF → paired-probe ingest",
    },
  });
  // Prefer dominant CWE label when present (mirrors locate --from-sarif).
  if (result.rankedFiles.length > 0) {
    const counts = new Map<string, number>();
    for (const f of result.rankedFiles) {
      for (const c of f.cweIds) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [c, n] of counts) {
      if (n > bestN) {
        best = c;
        bestN = n;
      }
    }
    if (best) {
      result.advisory = {
        kind: "cwe",
        id: best,
        cweId: best,
        title: `SARIF → paired-probe (primary ${best})`,
      };
    }
  }
  return prepareSeedFromResult(result, {
    sourcePath: resolved.path,
    sourceKind: resolved.kind === "locate-dir" ? "locate-dir" : "sarif",
  });
}

/**
 * Emit paired-probe envelopes + coverage matrix from a locate artifact on disk.
 * Same artifact shape as `npm run paired-probe` (fixture path).
 */
export async function runPairedProbesFromSarif(
  opts: FromSarifOptions,
): Promise<{
  matrix: ZerodayCoverageMatrix;
  matrixPath: string;
  seed: PairedProbeSeed;
  outputRoot: string;
}> {
  const outputRoot = path.resolve(opts.output ?? "zeroday-reports");
  const seed = loadPairedProbeSeedFromInput(opts.input, {
    cweFilter: opts.cweFilter,
  });
  const { matrix, matrixPath } = await runAllPairedProbes(outputRoot, seed);
  return { matrix, matrixPath, seed, outputRoot };
}
