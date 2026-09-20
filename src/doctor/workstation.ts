/**
 * Fail-closed local workstation readiness doctor (design-partner Day-1).
 *
 * Honest filesystem / package checks only. Never provisions RunPod, never
 * talks to live Antares GPU, never requires network. Reuses existing
 * loadGpuEvidence + loadOrgCassette loaders — no reimplementation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadGpuEvidence,
  GpuEvidenceError,
  GPU_EVIDENCE_REL,
} from "../desk/gpu-evidence.ts";
import {
  loadOrgCassette,
  RULES_CWE_89_CASSETTE,
} from "../locate/record/index.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DOCTOR_REPO_ROOT = path.resolve(HERE, "../..");

export const DOCTOR_SCHEMA = "zeroday.doctor/v1" as const;

/** Key npm scripts that design-partner / Day-1 doors already ship. */
export const DOCTOR_REQUIRED_SCRIPTS = [
  "prove-doors",
  "gpu-evidence",
  "evidence-pack",
  "cassette:replay",
  "stranger:verify",
] as const;

export interface DoctorCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface DoctorResult {
  schemaVersion: typeof DOCTOR_SCHEMA;
  ok: boolean;
  checks: DoctorCheck[];
  /** Doctor itself never provisions RunPod. */
  runpod: false;
  startsRunPod: false;
  networkRequired: false;
}

export interface RunDoctorOptions {
  /** Repo root (default: package root). Injectable for fail-closed tests. */
  cwd?: string;
  /** Override package.json path (tests). */
  packageJsonPath?: string;
  /** Override gpu-evidence relative/absolute path (tests). */
  gpuEvidencePath?: string;
  /** Override cassette path (tests). Default: RULES_CWE_89_CASSETTE.recording */
  cassettePath?: string;
  /** Override Node version string (tests). Default: process.version */
  nodeVersion?: string;
  /** Minimum major Node from package engines (default: 20). */
  minNodeMajor?: number;
}

function checkNodeRuntime(
  nodeVersion: string,
  minMajor: number,
): DoctorCheck {
  const m = /^v?(\d+)/.exec(nodeVersion.trim());
  if (!m) {
    return {
      id: "node_runtime",
      ok: false,
      detail: `Unparseable Node version: ${nodeVersion}`,
    };
  }
  const major = Number(m[1]);
  if (!Number.isFinite(major) || major < minMajor) {
    return {
      id: "node_runtime",
      ok: false,
      detail: `Node ${nodeVersion} below required >=${minMajor} (package engines.node)`,
    };
  }
  return {
    id: "node_runtime",
    ok: true,
    detail: `Node ${nodeVersion} usable (>=${minMajor})`,
  };
}

function checkPackageScripts(
  packageJsonPath: string,
): DoctorCheck {
  if (!fs.existsSync(packageJsonPath)) {
    return {
      id: "package_scripts",
      ok: false,
      detail: `package.json missing: ${packageJsonPath}`,
    };
  }
  let pkg: { scripts?: Record<string, unknown> };
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, unknown>;
    };
  } catch (e) {
    return {
      id: "package_scripts",
      ok: false,
      detail: `package.json unreadable: ${(e as Error).message}`,
    };
  }
  const scripts = pkg.scripts ?? {};
  const missing = DOCTOR_REQUIRED_SCRIPTS.filter((name) => {
    const v = scripts[name];
    return typeof v !== "string" || !v.trim();
  });
  if (missing.length > 0) {
    return {
      id: "package_scripts",
      ok: false,
      detail: `Missing package.json scripts: ${missing.join(", ")}`,
    };
  }
  return {
    id: "package_scripts",
    ok: true,
    detail: `Key doors present: ${DOCTOR_REQUIRED_SCRIPTS.join(", ")}`,
  };
}

function checkGpuEvidence(
  cwd: string,
  gpuEvidencePath?: string,
): DoctorCheck {
  try {
    const result = loadGpuEvidence({
      cwd,
      ...(gpuEvidencePath ? { relativePath: gpuEvidencePath } : {}),
    });
    return {
      id: "gpu_evidence",
      ok: true,
      detail: `Historical gpu-evidence loads (${result.source}; startsRunPod=${result.startsRunPod})`,
    };
  } catch (e) {
    const err = e as Error;
    const code = err instanceof GpuEvidenceError ? err.code : undefined;
    return {
      id: "gpu_evidence",
      ok: false,
      detail: code
        ? `gpu-evidence failed (${code}): ${err.message}`
        : `gpu-evidence failed: ${err.message}`,
    };
  }
}

function checkCassetteFixture(
  cwd: string,
  cassettePath?: string,
): DoctorCheck {
  const rel = cassettePath?.trim() || RULES_CWE_89_CASSETTE.recording;
  const abs = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
  if (!fs.existsSync(abs)) {
    return {
      id: "cassette_fixture",
      ok: false,
      detail: `Cassette fixture missing: ${rel}`,
    };
  }
  try {
    const cassette = loadOrgCassette(abs);
    return {
      id: "cassette_fixture",
      ok: true,
      detail: `Cassette loads for replay (${rel}; cwe=${cassette.advisory.cweId}; ranked=${cassette.rankedFiles.length})`,
    };
  } catch (e) {
    return {
      id: "cassette_fixture",
      ok: false,
      detail: `Cassette load failed: ${(e as Error).message}`,
    };
  }
}

function checkProveDoorsEntrypoints(cwd: string): DoctorCheck {
  const cliEntry = path.join(cwd, "cli", "index.ts");
  const strangerScript = path.join(cwd, "scripts", "stranger-verify.sh");
  const missing: string[] = [];
  if (!fs.existsSync(cliEntry)) missing.push("cli/index.ts");
  if (!fs.existsSync(strangerScript)) missing.push("scripts/stranger-verify.sh");
  if (missing.length > 0) {
    return {
      id: "prove_doors_entry",
      ok: false,
      detail: `Prove-doors / stranger-verify entrypoints missing: ${missing.join(", ")}`,
    };
  }
  return {
    id: "prove_doors_entry",
    ok: true,
    detail:
      "Entrypoints resolvable: cli/index.ts (prove-doors) + scripts/stranger-verify.sh",
  };
}

function checkNoLiveGpu(): DoctorCheck {
  return {
    id: "no_live_gpu",
    ok: true,
    detail:
      "runpod=false — doctor itself requires no live GPU / RunPod / network",
  };
}

/**
 * Run local workstation readiness checks. Fail-closed: overall ok only when
 * every check passes. Never invents metrics; never starts RunPod.
 */
export function runDoctor(opts: RunDoctorOptions = {}): DoctorResult {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : DOCTOR_REPO_ROOT;
  const packageJsonPath =
    opts.packageJsonPath?.trim() || path.join(cwd, "package.json");
  const nodeVersion = opts.nodeVersion?.trim() || process.version;
  const minMajor = opts.minNodeMajor ?? 20;

  const checks: DoctorCheck[] = [
    checkNodeRuntime(nodeVersion, minMajor),
    checkPackageScripts(packageJsonPath),
    checkGpuEvidence(cwd, opts.gpuEvidencePath),
    checkCassetteFixture(cwd, opts.cassettePath),
    checkProveDoorsEntrypoints(cwd),
    checkNoLiveGpu(),
  ];

  return {
    schemaVersion: DOCTOR_SCHEMA,
    ok: checks.every((c) => c.ok),
    checks,
    runpod: false,
    startsRunPod: false,
    networkRequired: false,
  };
}

/** Honesty catalog for Desk GET /api/doctor (no RunPod). */
export function doctorCatalog() {
  return {
    kind: "doctor-catalog" as const,
    schemaVersion: DOCTOR_SCHEMA,
    endpoint: "POST /api/doctor",
    getEndpoint: "GET /api/doctor",
    cli: "zeroday doctor · npm run doctor",
    defaultOut: "out/doctor.json",
    honesty: [
      "Reuses runDoctor (workstation) — does not reimplement checks",
      "Historical / local only — does not start RunPod / no GPU spend / no network",
      "Fail-closed: overall ok only when every check passes",
      "Desk returns zeroday.doctor/v1 JSON for browser download (CLI --out shape)",
      "Localization ≠ exploitability · needs_human · no invented metrics · no PoC",
    ],
  };
}

/** Human summary for `zeroday doctor` (not `--json`). */
export function formatDoctorBanner(result: DoctorResult): string {
  const lines: string[] = [
    "",
    "ZERODAY doctor (local workstation readiness · Day-1)",
    "────────────────────────────────────────────────────",
    `schema   : ${result.schemaVersion}`,
    `ok       : ${result.ok}`,
    `runpod   : ${result.runpod} · networkRequired: ${result.networkRequired}`,
    "",
  ];
  for (const c of result.checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    lines.push(`  [${mark}] ${c.id}`);
    lines.push(`         ${c.detail}`);
  }
  lines.push("");
  lines.push(
    "Honesty: fail-closed · historical gpu-evidence only · no RunPod · no live GPU · localization ≠ exploitability",
  );
  lines.push(
    `Keyless local-brain checklist: npm run zeroday -- doctor --local-brain · default evidence: ${GPU_EVIDENCE_REL}`,
  );
  lines.push("");
  return lines.join("\n");
}
