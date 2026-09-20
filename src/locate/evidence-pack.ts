/**
 * Design-partner evidence pack — local folder from EXISTING keyless doors.
 *
 * Reuses `runProveDoors` + `loadGpuEvidence` (no reimplementation).
 * Historical gpu-evidence only — does not start RunPod / not live GPU.
 * Fail-closed: any door or evidence load failure → no partial pack claim.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Buffer } from "../evidence/vault.ts";
import {
  loadGpuEvidence,
  runProveDoors,
  GpuEvidenceError,
  GPU_EVIDENCE_SCHEMA,
  PROVE_DOORS_SCHEMA,
  type GpuEvidenceOk,
  type ProveDoorsResult,
} from "../desk/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EVIDENCE_PACK_REPO_ROOT = path.resolve(HERE, "../..");

export const EVIDENCE_PACK_SCHEMA = "zeroday.evidence_pack/v1" as const;
export const EVIDENCE_PACK_VERSION = "1" as const;
export const EVIDENCE_PACK_DEFAULT_OUT = "out/evidence" as const;

export const EVIDENCE_PACK_PROVE_DOORS_FILE = "prove-doors.json" as const;
export const EVIDENCE_PACK_GPU_EVIDENCE_FILE = "gpu-evidence.json" as const;
export const EVIDENCE_PACK_MANIFEST_FILE = "manifest.json" as const;

export type EvidencePackErrorCode =
  | "PROVE_DOORS_FAILED"
  | "GPU_EVIDENCE_FAILED"
  | "WRITE_FAILED";

export class EvidencePackError extends Error {
  code: EvidencePackErrorCode;
  cause?: unknown;
  constructor(message: string, code: EvidencePackErrorCode, cause?: unknown) {
    super(message);
    this.name = "EvidencePackError";
    this.code = code;
    this.cause = cause;
  }
}

export interface EvidencePackFileEntry {
  name: string;
  sha256: string;
}

export interface EvidencePackManifest {
  schemaVersion: typeof EVIDENCE_PACK_SCHEMA;
  created_at: string;
  pack_version: typeof EVIDENCE_PACK_VERSION;
  files: EvidencePackFileEntry[];
  notes: string[];
  ok: true;
  outDir: string;
  historicalGpuEvidenceOnly: true;
  startsRunPod: false;
}

export interface EvidencePackResult {
  ok: true;
  outDir: string;
  proveDoorsPath: string;
  gpuEvidencePath: string;
  manifestPath: string;
  manifest: EvidencePackManifest;
  proveDoors: ProveDoorsResult;
  gpuEvidence: GpuEvidenceOk;
}

export interface EvidencePackOptions {
  /** Output directory (default: out/evidence). Relative → resolved from cwd. */
  out?: string;
  /** Repo / process cwd for runners (tests). */
  cwd?: string;
  /**
   * Override Measured A40 evidence path for `loadGpuEvidence`
   * (same as `zeroday gpu-evidence --from`). Default: checked-in fixture.
   */
  gpuEvidenceFrom?: string;
}

const NOTES: string[] = [
  "gpu-evidence is historical Measured A40 only — not live GPU",
  "does not start RunPod / no GPU spend from evidence-pack",
  "prove-doors: keyless Door A + cassette + Door D + Door E (Door B skipped without live URL)",
  "localization ≠ exploitability · needs_human · no invented metrics · no PoC",
];

function writeJson(abs: string, value: unknown): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(value, null, 2) + "\n", "utf8");
}

/**
 * Build `out/evidence/` (or `--out`) with prove-doors.json, gpu-evidence.json,
 * and manifest.json. Fail-closed if either existing runner would fail.
 */
export async function runEvidencePack(
  opts: EvidencePackOptions = {},
): Promise<EvidencePackResult> {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : EVIDENCE_PACK_REPO_ROOT;
  const outRel = opts.out?.trim() || EVIDENCE_PACK_DEFAULT_OUT;
  const outDir = path.isAbsolute(outRel) ? outRel : path.resolve(cwd, outRel);

  let proveDoors: ProveDoorsResult;
  try {
    proveDoors = await runProveDoors({ cwd });
  } catch (e) {
    throw new EvidencePackError(
      `evidence-pack prove-doors failed: ${(e as Error).message}`,
      "PROVE_DOORS_FAILED",
      e,
    );
  }
  if (!proveDoors.ok) {
    throw new EvidencePackError(
      "evidence-pack prove-doors failed: required doors not ok (A + cassette + D + E)",
      "PROVE_DOORS_FAILED",
      proveDoors,
    );
  }
  if (proveDoors.schemaVersion !== PROVE_DOORS_SCHEMA) {
    throw new EvidencePackError(
      `evidence-pack prove-doors schema mismatch: ${proveDoors.schemaVersion}`,
      "PROVE_DOORS_FAILED",
    );
  }

  let gpuEvidence: GpuEvidenceOk;
  try {
    const from = opts.gpuEvidenceFrom?.trim();
    gpuEvidence = loadGpuEvidence({
      cwd,
      ...(from ? { relativePath: path.isAbsolute(from) ? from : path.resolve(cwd, from) } : {}),
    });
  } catch (e) {
    const msg =
      e instanceof GpuEvidenceError
        ? `evidence-pack gpu-evidence failed (${e.code}): ${e.message}`
        : `evidence-pack gpu-evidence failed: ${(e as Error).message}`;
    throw new EvidencePackError(msg, "GPU_EVIDENCE_FAILED", e);
  }
  if (!gpuEvidence.ok || gpuEvidence.schemaVersion !== GPU_EVIDENCE_SCHEMA) {
    throw new EvidencePackError(
      "evidence-pack gpu-evidence failed: invalid result",
      "GPU_EVIDENCE_FAILED",
      gpuEvidence,
    );
  }

  const proveDoorsPath = path.join(outDir, EVIDENCE_PACK_PROVE_DOORS_FILE);
  const gpuEvidencePath = path.join(outDir, EVIDENCE_PACK_GPU_EVIDENCE_FILE);
  const manifestPath = path.join(outDir, EVIDENCE_PACK_MANIFEST_FILE);

  try {
    writeJson(proveDoorsPath, proveDoors);
    writeJson(gpuEvidencePath, gpuEvidence);

    const proveBody = fs.readFileSync(proveDoorsPath);
    const gpuBody = fs.readFileSync(gpuEvidencePath);
    const created_at = new Date().toISOString();
    const files: EvidencePackFileEntry[] = [
      {
        name: EVIDENCE_PACK_PROVE_DOORS_FILE,
        sha256: sha256Buffer(proveBody),
      },
      {
        name: EVIDENCE_PACK_GPU_EVIDENCE_FILE,
        sha256: sha256Buffer(gpuBody),
      },
    ];

    // files[] hashes payload artifacts only (prove-doors + gpu-evidence).
    // manifest.json is the catalog — no circular self-hash.
    const manifest: EvidencePackManifest = {
      schemaVersion: EVIDENCE_PACK_SCHEMA,
      created_at,
      pack_version: EVIDENCE_PACK_VERSION,
      files,
      notes: [...NOTES],
      ok: true,
      outDir,
      historicalGpuEvidenceOnly: true,
      startsRunPod: false,
    };

    writeJson(manifestPath, manifest);

    return {
      ok: true,
      outDir,
      proveDoorsPath,
      gpuEvidencePath,
      manifestPath,
      manifest,
      proveDoors,
      gpuEvidence,
    };
  } catch (e) {
    if (e instanceof EvidencePackError) throw e;
    throw new EvidencePackError(
      `evidence-pack write failed: ${(e as Error).message}`,
      "WRITE_FAILED",
      e,
    );
  }
}

/** Human summary for `zeroday evidence-pack` (not `--json`). */
export function formatEvidencePackBanner(result: EvidencePackResult): string {
  const lines: string[] = [
    "",
    "ZERODAY evidence-pack (keyless · design-partner)",
    "───────────────────────────────────────────────",
    `schema   : ${result.manifest.schemaVersion}`,
    `ok       : ${result.ok}`,
    `out      : ${result.outDir}`,
    `prove    : ${result.proveDoorsPath}`,
    `gpu      : ${result.gpuEvidencePath}`,
    `manifest : ${result.manifestPath}`,
    `historicalGpuEvidenceOnly: ${result.manifest.historicalGpuEvidenceOnly} · startsRunPod: ${result.manifest.startsRunPod}`,
    "",
    "Historical gpu-evidence only — does not start RunPod / not live GPU.",
    "Reuse of prove-doors + gpu-evidence · localization ≠ exploitability · needs_human",
    "",
  ];
  return lines.join("\n");
}
