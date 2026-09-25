/**
 * Desk prove-doors runner — in-process stranger:verify (Door A + optional Door B).
 *
 * Mirrors scripts/stranger-verify.sh JSON shape (zeroday-stranger-verify/v1).
 * Door A: fixture SARIF → paired-probe:from-sarif (same as trust-loop default).
 * Door B default: citation only. Opt-in liveUrl → GET /v1/models only
 * (provisioned: false · spendUsd: null · never RunPod create · never HF pull).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  completionsBaseUrl,
  normalizeCompletionsEndpoint,
} from "../locate/completions";
import { runPairedProbesFromSarif } from "../locate/paired-probes/from-sarif";
import {
  assertAllowedReadPath,
  PathPolicyError,
} from "../lib/path-policy";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STRANGER_VERIFY_REPO_ROOT = path.resolve(HERE, "../..");

export const STRANGER_VERIFY_SCHEMA = "zeroday-stranger-verify/v1" as const;

const SAMPLE_SARIF = "fixtures/locate/ingest-sample/sample.sarif";
const SAMPLE_GRADE_MD = "docs/reports/diptych-sample-grade.md";
const GPU_CLAIMS = "docs/gpu-claims.md";

/** Facts already on docs/gpu-claims.md § Live re-proof — invent nothing. */
const DOOR_B_CITATION = {
  doc: GPU_CLAIMS,
  section: "Live re-proof (2026-09-19 PT)",
  factsDocumented: {
    podId: "d65ny3xqf7bwza",
    tierGpu: "RunPod Secure Cloud · NVIDIA A40",
    estimatedSpend: "~$0.034",
    modelsHttp: 200,
    completionsHttp: 200,
    liveLocateRankedFile: "src/users.js",
  },
} as const;

export interface StrangerVerifyDoorA {
  status: "pass";
  ran: true;
  command: string;
  artifacts: {
    envelopes: string;
    matrix: string;
    sampleGradeMd: string;
  };
}

export interface StrangerVerifyProbe {
  modelsUrl: string;
  endpoint: string;
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  /** Count of `data[]` entries when body parses; null if body absent/unparsed. */
  modelCount: number | null;
  detail: string;
  provisioned: false;
  spendUsd: null;
  mode: "operator_endpoint";
}

export interface StrangerVerifyDoorBCitation {
  mode: "citation";
  ran: false;
  citation: typeof DOOR_B_CITATION;
  note: string;
}

export interface StrangerVerifyDoorBProbe {
  mode: "operator_endpoint";
  ran: true;
  provisioned: false;
  spendUsd: null;
  probe: StrangerVerifyProbe;
  citation: typeof DOOR_B_CITATION;
  note: string;
}

export type StrangerVerifyDoorB =
  | StrangerVerifyDoorBCitation
  | StrangerVerifyDoorBProbe;

export interface StrangerVerifyNonClaims {
  localizationNotExploitability: true;
  needsHuman: true;
  noAurocFileF1OrgLatencySla: true;
  ciBadgeNotVulnProof: true;
  diptychGradesSeparately: true;
  sampleGradeIllustrative: true;
  probeNotMeasuredA40ReProof: true;
  noRunPodCreateFromStrangerVerify: true;
}

export interface StrangerVerifyResult {
  schemaVersion: typeof STRANGER_VERIFY_SCHEMA;
  doorA: StrangerVerifyDoorA;
  doorB: StrangerVerifyDoorB;
  nonClaims: StrangerVerifyNonClaims;
}

export interface StrangerVerifyOptions {
  /** Opt-in Door B: OpenAI-compatible /v1 base (GET /v1/models only). */
  liveUrl?: string;
  /** Output root for paired-probe (default: unique zeroday-reports/trust-loop-* dir). */
  outputDir?: string;
  /** Working directory / repo root (default: package root). */
  cwd?: string;
  /** Inject fetch for tests (mock live URL). */
  fetchImpl?: typeof fetch;
  /** Probe timeout (default 5000ms). */
  timeoutMs?: number;
}

export class StrangerVerifyError extends Error {
  code: string;
  constructor(message: string, code = "STRANGER_VERIFY") {
    super(message);
    this.name = "StrangerVerifyError";
    this.code = code;
  }
}

const NON_CLAIMS: StrangerVerifyNonClaims = {
  localizationNotExploitability: true,
  needsHuman: true,
  noAurocFileF1OrgLatencySla: true,
  ciBadgeNotVulnProof: true,
  diptychGradesSeparately: true,
  sampleGradeIllustrative: true,
  probeNotMeasuredA40ReProof: true,
  noRunPodCreateFromStrangerVerify: true,
};

/**
 * Normalize operator-supplied URL → GET /v1/models target.
 * Same conventions as scripts/stranger-verify.sh + completionsBaseUrl.
 */
export function modelsUrlFromLiveUrl(raw: string): {
  endpoint: string;
  modelsUrl: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new StrangerVerifyError(
      "liveUrl is empty — pass an OpenAI-compatible /v1 base",
      "LIVE_URL_EMPTY",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new StrangerVerifyError(
      `liveUrl is not a valid URL: ${trimmed}`,
      "LIVE_URL_INVALID",
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new StrangerVerifyError(
      `liveUrl must be http(s): ${trimmed}`,
      "LIVE_URL_SCHEME",
    );
  }
  const endpoint = completionsBaseUrl(normalizeCompletionsEndpoint(trimmed));
  return { endpoint, modelsUrl: `${endpoint}/v1/models` };
}

/**
 * Opt-in Door B probe: GET /v1/models only.
 * Never reads HF_TOKEN / RUNPOD_API_KEY. Never creates pods. spendUsd always null.
 */
export async function probeOperatorEndpoint(
  liveUrl: string,
  opts?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<StrangerVerifyProbe> {
  const { endpoint, modelsUrl } = modelsUrlFromLiveUrl(liveUrl);
  const fetchFn = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? 5000;
  const started = Date.now();

  try {
    const res = await fetchFn(modelsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - started;
    let modelCount: number | null = null;
    try {
      const body = (await res.json()) as { data?: unknown[] };
      if (body && Array.isArray(body.data)) modelCount = body.data.length;
    } catch {
      /* body optional for health */
    }
    return {
      modelsUrl,
      endpoint,
      ok: res.ok,
      httpStatus: res.status,
      latencyMs,
      modelCount,
      detail: res.ok
        ? `GET ${modelsUrl} → ${res.status} (${latencyMs}ms${
            modelCount != null ? `; ${modelCount} model(s)` : ""
          })`
        : `GET ${modelsUrl} → ${res.status} (${latencyMs}ms)`,
      provisioned: false,
      spendUsd: null,
      mode: "operator_endpoint",
    };
  } catch (e) {
    return {
      modelsUrl,
      endpoint,
      ok: false,
      httpStatus: null,
      latencyMs: Date.now() - started,
      modelCount: null,
      detail: `GET ${modelsUrl} failed: ${
        e && (e as Error).message ? (e as Error).message : String(e)
      }`,
      provisioned: false,
      spendUsd: null,
      mode: "operator_endpoint",
    };
  }
}

function buildDoorBCitation(): StrangerVerifyDoorBCitation {
  return {
    mode: "citation",
    ran: false,
    citation: DOOR_B_CITATION,
    note: "Door B was not executed by this command — quote docs/gpu-claims.md only; do not invent $ / pod / latency.",
  };
}

function buildDoorBProbe(probe: StrangerVerifyProbe): StrangerVerifyDoorBProbe {
  return {
    mode: "operator_endpoint",
    ran: true,
    provisioned: false,
    spendUsd: null,
    probe,
    citation: DOOR_B_CITATION,
    note: "Operator-supplied endpoint probe only (GET /v1/models) — not measured Secure A40 re-proof; cite docs/gpu-claims.md § Live re-proof for historical facts. No pod create / no HF pull / spendUsd null.",
  };
}

/**
 * Run prove-doors in-process (Desk API / tests). Same JSON as
 * `npm run --silent stranger:verify -- --json` [+ optional --live-url].
 */
export async function runStrangerVerify(
  opts: StrangerVerifyOptions = {},
): Promise<StrangerVerifyResult> {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : STRANGER_VERIFY_REPO_ROOT;
  /**
   * Isolate concurrent Desk/API/prove-doors Door A callers from stomping the
   * shared trust-loop dir (Node test runner runs files in parallel). Explicit
   * outputDir wins; otherwise create a unique dir under zeroday-reports/.
   */
  let outRel = opts.outputDir?.trim();
  if (!outRel) {
    const base = path.join(cwd, "zeroday-reports");
    fs.mkdirSync(base, { recursive: true });
    outRel = path.relative(
      cwd,
      fs.mkdtempSync(path.join(base, "trust-loop-")),
    );
  }
  // Output may be tmp (Desk/API tests). Fixture SARIF read is allowlisted.
  const outputRoot = path.isAbsolute(outRel) ? outRel : path.join(cwd, outRel);
  let sampleSarif: string;
  try {
    sampleSarif = assertAllowedReadPath(cwd, SAMPLE_SARIF, {
      mustExist: true,
      kind: "file",
      label: "sampleSarif",
    });
  } catch (e) {
    if (e instanceof PathPolicyError) {
      throw new StrangerVerifyError(e.message, "PATH_POLICY");
    }
    throw e;
  }

  // Door A — keyless paired-probe from in-repo fixture SARIF (trust-loop default).
  try {
    await runPairedProbesFromSarif({
      input: sampleSarif,
      output: outputRoot,
    });
  } catch (e) {
    const msg = (e as Error).message;
    throw new StrangerVerifyError(
      `Door A paired-probe failed: ${msg}`,
      "DOOR_A_FAILED",
    );
  }

  const outRelPosix = path.relative(cwd, outputRoot).split(path.sep).join("/") || ".";
  // Honest artifact paths for the actual output root (isolated or caller-supplied).
  const doorA: StrangerVerifyDoorA = {
    status: "pass",
    ran: true,
    command: "npm run trust-loop",
    artifacts: {
      envelopes: path.posix.join(outRelPosix, "paired-probe/"),
      matrix: path.posix.join(outRelPosix, "paired-probe/coverage/matrix.json"),
      sampleGradeMd: SAMPLE_GRADE_MD,
    },
  };

  let doorB: StrangerVerifyDoorB = buildDoorBCitation();
  const liveUrl = opts.liveUrl?.trim();
  if (liveUrl) {
    // Probe only — do not read HF / RunPod secrets for create or weight pull.
    const probe = await probeOperatorEndpoint(liveUrl, {
      fetchImpl: opts.fetchImpl,
      timeoutMs: opts.timeoutMs,
    });
    doorB = buildDoorBProbe(probe);
  }

  return {
    schemaVersion: STRANGER_VERIFY_SCHEMA,
    doorA,
    doorB,
    nonClaims: NON_CLAIMS,
  };
}

export function strangerVerifyCatalog() {
  return {
    kind: "stranger-verify-catalog" as const,
    schemaVersion: STRANGER_VERIFY_SCHEMA,
    endpoint: "POST /api/stranger-verify",
    body: {
      liveUrl: {
        optional: true,
        description:
          "OpenAI-compatible /v1 base — GET /v1/models only; provisioned:false; never RunPod create / HF pull",
      },
    },
    doors: {
      doorA: "keyless trust-loop (fixture SARIF → paired-probe:from-sarif)",
      doorBDefault: "citation only (docs/gpu-claims.md § Live re-proof)",
      doorBLiveUrl: "operator_endpoint probe (GET /v1/models)",
    },
    honesty: [
      "needs_human · localization ≠ exploitability",
      "no AUROC / File-F1 / org-scale latency SLAs",
      "provisioned: false · spendUsd: null when probing",
      "probe ≠ measured Secure A40 re-proof",
      "no PoC · no auto GPU spend",
    ],
  };
}
