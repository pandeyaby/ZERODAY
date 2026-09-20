/**
 * Desk Prove Door B — live-url probe (GET /v1/models only).
 *
 * Sibling to stranger-verify / cassette-replay: operator-supplied OpenAI-compatible
 * /v1 base → structured probe JSON. Fail-closed on unreachable / non-200.
 * Never RunPod create / HF pull. spendUsd always null.
 * Probe ≠ measured Secure A40 re-proof (cite docs/gpu-claims.md).
 */

import {
  probeOperatorEndpoint,
  StrangerVerifyError,
  type StrangerVerifyProbe,
} from "./stranger-verify";

export const LIVE_URL_PROBE_SCHEMA = "zeroday-live-url-probe/v1" as const;

const GPU_CLAIMS = "docs/gpu-claims.md";

/** Historical citation only — invent nothing; probe does not re-measure A40. */
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

export interface LiveUrlProbeNonClaims {
  localizationNotExploitability: true;
  needsHuman: true;
  probeNotMeasuredA40ReProof: true;
  noRunPodCreateFromLiveUrlProbe: true;
  noSpendClaimsFromDoorBProbe: true;
  noAurocFileF1OrgLatencySla: true;
  ciBadgeNotVulnProof: true;
}

export interface LiveUrlProbeResult {
  schemaVersion: typeof LIVE_URL_PROBE_SCHEMA;
  ok: true;
  mode: "operator_endpoint";
  provisioned: false;
  spendUsd: null;
  probe: StrangerVerifyProbe;
  citation: typeof DOOR_B_CITATION;
  note: string;
  nonClaims: LiveUrlProbeNonClaims;
}

export interface LiveUrlProbeOptions {
  /** Required OpenAI-compatible /v1 base (or host that normalizes to /v1/models). */
  liveUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class LiveUrlProbeError extends Error {
  code: string;
  probe?: StrangerVerifyProbe;
  constructor(
    message: string,
    code = "LIVE_URL_PROBE",
    probe?: StrangerVerifyProbe,
  ) {
    super(message);
    this.name = "LiveUrlProbeError";
    this.code = code;
    this.probe = probe;
  }
}

const NON_CLAIMS: LiveUrlProbeNonClaims = {
  localizationNotExploitability: true,
  needsHuman: true,
  probeNotMeasuredA40ReProof: true,
  noRunPodCreateFromLiveUrlProbe: true,
  noSpendClaimsFromDoorBProbe: true,
  noAurocFileF1OrgLatencySla: true,
  ciBadgeNotVulnProof: true,
};

/**
 * Run Door B live-url probe. Fail-closed: throws LiveUrlProbeError when
 * unreachable (httpStatus null) or non-200 (!ok).
 */
export async function runLiveUrlProbe(
  opts: LiveUrlProbeOptions,
): Promise<LiveUrlProbeResult> {
  const liveUrl = opts.liveUrl?.trim();
  if (!liveUrl) {
    throw new LiveUrlProbeError(
      "liveUrl is required — OpenAI-compatible /v1 base for GET /v1/models",
      "LIVE_URL_REQUIRED",
    );
  }

  let probe: StrangerVerifyProbe;
  try {
    probe = await probeOperatorEndpoint(liveUrl, {
      fetchImpl: opts.fetchImpl,
      timeoutMs: opts.timeoutMs,
    });
  } catch (e) {
    if (e instanceof StrangerVerifyError) {
      throw new LiveUrlProbeError(e.message, e.code);
    }
    throw e;
  }

  if (!probe.ok) {
    const code =
      probe.httpStatus == null ? "PROBE_UNREACHABLE" : "PROBE_HTTP_FAILED";
    throw new LiveUrlProbeError(
      probe.detail ||
        (probe.httpStatus == null
          ? `GET ${probe.modelsUrl} unreachable`
          : `GET ${probe.modelsUrl} → ${probe.httpStatus}`),
      code,
      probe,
    );
  }

  return {
    schemaVersion: LIVE_URL_PROBE_SCHEMA,
    ok: true,
    mode: "operator_endpoint",
    provisioned: false,
    spendUsd: null,
    probe,
    citation: DOOR_B_CITATION,
    note: "Operator-supplied endpoint probe only (GET /v1/models) — not measured Secure A40 re-proof; cite docs/gpu-claims.md § Live re-proof for historical facts. No pod create / no HF pull / spendUsd null.",
    nonClaims: NON_CLAIMS,
  };
}

export function liveUrlProbeCatalog() {
  return {
    kind: "live-url-probe-catalog" as const,
    schemaVersion: LIVE_URL_PROBE_SCHEMA,
    endpoint: "POST /api/live-url-probe",
    body: {
      liveUrl: {
        required: true,
        description:
          "OpenAI-compatible /v1 base — GET /v1/models only; fail-closed on unreachable / non-200; provisioned:false; never RunPod create / HF pull",
      },
    },
    returns: {
      ok: true,
      probe: "httpStatus · latencyMs · modelCount · detail",
      provisioned: false,
      spendUsd: null,
    },
    honesty: [
      "needs_human · localization ≠ exploitability",
      "probe ≠ measured Secure A40 re-proof",
      "no spend claims from Door B probe · spendUsd: null",
      "no AUROC / File-F1 / org-scale latency SLAs",
      "fail-closed on unreachable / non-200",
    ],
  };
}
