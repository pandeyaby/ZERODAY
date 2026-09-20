/**
 * Desk GPU evidence loader — read-only parse of checked-in A40 live-locate JSON.
 *
 * Fail-closed on missing file / corrupt JSON / schema mismatch.
 * Does not call RunPod, provision pods, or invent AUROC/File-F1/SLA.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const GPU_EVIDENCE_REPO_ROOT = path.resolve(HERE, "../..");

export const GPU_LIVE_LOCATE_EVIDENCE_KIND =
  "zeroday.gpu_live_locate_evidence/v1" as const;

export const GPU_EVIDENCE_REL =
  "docs/reports/a40-live-locate-20260920.json" as const;

export const GPU_EVIDENCE_SCHEMA = "zeroday-gpu-evidence/v1" as const;

export interface A40LiveLocateEvidence {
  kind: typeof GPU_LIVE_LOCATE_EVIDENCE_KIND;
  label: string;
  session: string;
  measured: boolean;
  checked_in_cassette: boolean;
  ci_live_gpu: boolean;
  pod: {
    id: string;
    tier: string;
    gpu: string;
    dataCenter: string;
    image: string;
    model: string;
    maxModelLen: number;
    rateUsdPerHourAtCreate: number;
  };
  timelineUtc: {
    startedAt: string;
    modelsGet200Approx: string;
    locateFinishedApprox: string;
    terminateDeletePod204Approx: string;
    wallStartToTerminateMinutesApprox: number;
  };
  spend: {
    estimatedUsd: number;
    formula: string;
    billingApiSettled: boolean;
    label: string;
  };
  smoke: {
    modelsGetHttp: number;
    completionsPostHttp: number;
  };
  liveLocate: {
    tree: string;
    commandShape: string;
    cwe: string;
    repo: string;
    rankedFile: string;
    rank: number;
    findingCount: number;
    incompleteReason: null | string;
    terminalCallsUsed: number;
    toolBudget: number;
    fullerLocateWithRealToolCalls: boolean;
    sarifResults: number;
    sarifSha256: string;
  };
  posture: {
    localizationOnly: boolean;
    notExploitProof: boolean;
    noPoC: boolean;
    noAutoMerge: boolean;
    needsHuman: boolean;
  };
  non_claims: string[];
  related?: {
    gpuClaimsDoc?: string;
    gpuClaimsSection?: string;
    priorA40SmokeSection?: string;
    priorA40SmokePodId?: string;
  };
}

export interface GpuEvidenceNonClaims {
  historicalMeasuredSessionOnly: true;
  notLiveProbe: true;
  notSla: true;
  doesNotStartRunPod: true;
  localizationNotExploitability: true;
  noAurocFileF1Invented: true;
}

export interface GpuEvidenceOk {
  schemaVersion: typeof GPU_EVIDENCE_SCHEMA;
  ok: true;
  source: typeof GPU_EVIDENCE_REL;
  historical: true;
  startsRunPod: false;
  evidence: A40LiveLocateEvidence;
  nonClaims: GpuEvidenceNonClaims;
}

export type GpuEvidenceCode =
  | "EVIDENCE_MISSING"
  | "EVIDENCE_CORRUPT"
  | "EVIDENCE_SCHEMA";

export class GpuEvidenceError extends Error {
  code: GpuEvidenceCode;
  constructor(message: string, code: GpuEvidenceCode) {
    super(message);
    this.name = "GpuEvidenceError";
    this.code = code;
  }
}

const NON_CLAIMS: GpuEvidenceNonClaims = {
  historicalMeasuredSessionOnly: true,
  notLiveProbe: true,
  notSla: true,
  doesNotStartRunPod: true,
  localizationNotExploitability: true,
  noAurocFileF1Invented: true,
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new GpuEvidenceError(
      `evidence.${key} must be a non-empty string`,
      "EVIDENCE_SCHEMA",
    );
  }
  return v;
}

function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== "boolean") {
    throw new GpuEvidenceError(
      `evidence.${key} must be a boolean`,
      "EVIDENCE_SCHEMA",
    );
  }
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new GpuEvidenceError(
      `evidence.${key} must be a finite number`,
      "EVIDENCE_SCHEMA",
    );
  }
  return v;
}

function requireObject(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const v = obj[key];
  if (!isPlainObject(v)) {
    throw new GpuEvidenceError(
      `evidence.${key} must be an object`,
      "EVIDENCE_SCHEMA",
    );
  }
  return v;
}

/**
 * Validate unknown JSON against zeroday.gpu_live_locate_evidence/v1.
 * Fail-closed — invent nothing beyond required structural fields.
 */
export function parseGpuLiveLocateEvidence(
  raw: unknown,
): A40LiveLocateEvidence {
  if (!isPlainObject(raw)) {
    throw new GpuEvidenceError(
      "evidence root must be a JSON object",
      "EVIDENCE_SCHEMA",
    );
  }

  const kind = requireString(raw, "kind");
  if (kind !== GPU_LIVE_LOCATE_EVIDENCE_KIND) {
    throw new GpuEvidenceError(
      `evidence.kind must be ${GPU_LIVE_LOCATE_EVIDENCE_KIND}`,
      "EVIDENCE_SCHEMA",
    );
  }

  const label = requireString(raw, "label");
  const session = requireString(raw, "session");
  const measured = requireBoolean(raw, "measured");
  const checked_in_cassette = requireBoolean(raw, "checked_in_cassette");
  const ci_live_gpu = requireBoolean(raw, "ci_live_gpu");

  const podRaw = requireObject(raw, "pod");
  const pod = {
    id: requireString(podRaw, "id"),
    tier: requireString(podRaw, "tier"),
    gpu: requireString(podRaw, "gpu"),
    dataCenter: requireString(podRaw, "dataCenter"),
    image: requireString(podRaw, "image"),
    model: requireString(podRaw, "model"),
    maxModelLen: requireNumber(podRaw, "maxModelLen"),
    rateUsdPerHourAtCreate: requireNumber(podRaw, "rateUsdPerHourAtCreate"),
  };

  const timelineRaw = requireObject(raw, "timelineUtc");
  const timelineUtc = {
    startedAt: requireString(timelineRaw, "startedAt"),
    modelsGet200Approx: requireString(timelineRaw, "modelsGet200Approx"),
    locateFinishedApprox: requireString(timelineRaw, "locateFinishedApprox"),
    terminateDeletePod204Approx: requireString(
      timelineRaw,
      "terminateDeletePod204Approx",
    ),
    wallStartToTerminateMinutesApprox: requireNumber(
      timelineRaw,
      "wallStartToTerminateMinutesApprox",
    ),
  };

  const spendRaw = requireObject(raw, "spend");
  const spend = {
    estimatedUsd: requireNumber(spendRaw, "estimatedUsd"),
    formula: requireString(spendRaw, "formula"),
    billingApiSettled: requireBoolean(spendRaw, "billingApiSettled"),
    label: requireString(spendRaw, "label"),
  };

  const smokeRaw = requireObject(raw, "smoke");
  const smoke = {
    modelsGetHttp: requireNumber(smokeRaw, "modelsGetHttp"),
    completionsPostHttp: requireNumber(smokeRaw, "completionsPostHttp"),
  };

  const liveRaw = requireObject(raw, "liveLocate");
  const incompleteReason =
    liveRaw.incompleteReason === null
      ? null
      : typeof liveRaw.incompleteReason === "string"
        ? liveRaw.incompleteReason
        : (() => {
            throw new GpuEvidenceError(
              "evidence.liveLocate.incompleteReason must be null or string",
              "EVIDENCE_SCHEMA",
            );
          })();

  const liveLocate = {
    tree: requireString(liveRaw, "tree"),
    commandShape: requireString(liveRaw, "commandShape"),
    cwe: requireString(liveRaw, "cwe"),
    repo: requireString(liveRaw, "repo"),
    rankedFile: requireString(liveRaw, "rankedFile"),
    rank: requireNumber(liveRaw, "rank"),
    findingCount: requireNumber(liveRaw, "findingCount"),
    incompleteReason,
    terminalCallsUsed: requireNumber(liveRaw, "terminalCallsUsed"),
    toolBudget: requireNumber(liveRaw, "toolBudget"),
    fullerLocateWithRealToolCalls: requireBoolean(
      liveRaw,
      "fullerLocateWithRealToolCalls",
    ),
    sarifResults: requireNumber(liveRaw, "sarifResults"),
    sarifSha256: requireString(liveRaw, "sarifSha256"),
  };

  const postureRaw = requireObject(raw, "posture");
  const posture = {
    localizationOnly: requireBoolean(postureRaw, "localizationOnly"),
    notExploitProof: requireBoolean(postureRaw, "notExploitProof"),
    noPoC: requireBoolean(postureRaw, "noPoC"),
    noAutoMerge: requireBoolean(postureRaw, "noAutoMerge"),
    needsHuman: requireBoolean(postureRaw, "needsHuman"),
  };

  const nonClaimsRaw = raw.non_claims;
  if (
    !Array.isArray(nonClaimsRaw) ||
    nonClaimsRaw.length === 0 ||
    !nonClaimsRaw.every((c) => typeof c === "string" && c.trim())
  ) {
    throw new GpuEvidenceError(
      "evidence.non_claims must be a non-empty string array",
      "EVIDENCE_SCHEMA",
    );
  }
  const non_claims = nonClaimsRaw as string[];

  let related: A40LiveLocateEvidence["related"];
  if (raw.related !== undefined) {
    if (!isPlainObject(raw.related)) {
      throw new GpuEvidenceError(
        "evidence.related must be an object when present",
        "EVIDENCE_SCHEMA",
      );
    }
    related = {};
    for (const key of [
      "gpuClaimsDoc",
      "gpuClaimsSection",
      "priorA40SmokeSection",
      "priorA40SmokePodId",
    ] as const) {
      const v = raw.related[key];
      if (v === undefined) continue;
      if (typeof v !== "string") {
        throw new GpuEvidenceError(
          `evidence.related.${key} must be a string`,
          "EVIDENCE_SCHEMA",
        );
      }
      related[key] = v;
    }
  }

  return {
    kind: GPU_LIVE_LOCATE_EVIDENCE_KIND,
    label,
    session,
    measured,
    checked_in_cassette,
    ci_live_gpu,
    pod,
    timelineUtc,
    spend,
    smoke,
    liveLocate,
    posture,
    non_claims,
    ...(related ? { related } : {}),
  };
}

export interface LoadGpuEvidenceOptions {
  /** Override repo root (tests). */
  cwd?: string;
  /** Override relative path to evidence JSON (tests). */
  relativePath?: string;
}

/**
 * Load + validate checked-in A40 live-locate evidence.
 * Missing file → EVIDENCE_MISSING; corrupt JSON → EVIDENCE_CORRUPT; schema → EVIDENCE_SCHEMA.
 */
export function loadGpuEvidence(
  opts: LoadGpuEvidenceOptions = {},
): GpuEvidenceOk {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : GPU_EVIDENCE_REPO_ROOT;
  const rel = opts.relativePath?.trim() || GPU_EVIDENCE_REL;
  const file = path.isAbsolute(rel) ? rel : path.join(cwd, rel);

  if (!fs.existsSync(file)) {
    throw new GpuEvidenceError(
      `GPU evidence file missing: ${rel}`,
      "EVIDENCE_MISSING",
    );
  }

  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new GpuEvidenceError(
      `GPU evidence unreadable: ${(e as Error).message}`,
      "EVIDENCE_MISSING",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new GpuEvidenceError(
      `GPU evidence corrupt JSON: ${(e as Error).message}`,
      "EVIDENCE_CORRUPT",
    );
  }

  const evidence = parseGpuLiveLocateEvidence(parsed);

  return {
    schemaVersion: GPU_EVIDENCE_SCHEMA,
    ok: true,
    source: GPU_EVIDENCE_REL,
    historical: true,
    startsRunPod: false,
    evidence,
    nonClaims: NON_CLAIMS,
  };
}

export function gpuEvidenceCatalog() {
  return {
    kind: "gpu-evidence-catalog" as const,
    schemaVersion: GPU_EVIDENCE_SCHEMA,
    endpoint: "GET /api/gpu-evidence",
    source: GPU_EVIDENCE_REL,
    evidenceKind: GPU_LIVE_LOCATE_EVIDENCE_KIND,
    honesty: [
      "Historical measured A40 session only — not a live probe",
      "Does not start RunPod / no GPU spend from this endpoint",
      "Cite only fields in the checked-in JSON — no AUROC / File-F1 / SLA",
      "Fail-closed: missing → 404 · corrupt/schema → 422",
      "Localization ≠ exploitability · needs_human",
    ],
  };
}
