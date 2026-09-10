/**
 * Live Antares path guards — refuse silent fixture/mock fallback.
 *
 * When an operator asks for live locate (--live / --endpoint), ZERODAY must
 * either run real Antares against a healthy completions endpoint or fail loud.
 * Never degrade to fixture recordings without an explicit --fixture (alone).
 *
 * Non-loopback / Nebius endpoints require explicit remote-inference ACK so
 * customer source does not leave the machine by default.
 */

import {
  assertNotChatCompletions,
  normalizeCompletionsEndpoint,
  probeCompletionsEndpoint,
  type CompletionsProbeResult,
} from "./completions";
import {
  remoteInferenceAcked,
  REMOTE_INFERENCE_REQUIRED,
  NEBIUS_DOCS_HINT,
} from "../factory/provider";

export type LocateRunMode = "fixture" | "live";

export interface ModeResolveInput {
  fixture?: boolean;
  live?: boolean;
  /** Raw or normalized endpoint (ANTARES_ENDPOINT / --endpoint) */
  endpoint?: string;
  /** Opt-in: allow prompts/repo-derived context to a remote GPU endpoint */
  remoteInference?: boolean;
}

export const LIVE_ENDPOINT_REQUIRED =
  "Live locate requires --endpoint pointing at a local completions server " +
  "(e.g. http://127.0.0.1:8000/v1). Antares CLI expects POST /v1/completions — " +
  "not chat. Refusing to continue without an endpoint (no silent fixture fallback). " +
  "For Nebius/CUDA org path see docs/nebius-antares.md (requires --remote-inference).";

export const MIXED_MODE_REFUSED =
  "Refusing mixed mode: --fixture cannot be combined with --live or --endpoint. " +
  "--fixture is the CI / no-GPU path only. For live Antares → SARIF, omit --fixture " +
  "and pass a healthy --endpoint (see scripts/quickstart-live.sh).";

export function liveEndpointUnhealthyMessage(detail: string): string {
  return (
    `Live locate refused: completions endpoint unhealthy (${detail}). ` +
    `No fixture/mock fallback. Accept HF terms for fdtn-ai/antares-1b, serve with vLLM ` +
    `(completions-only /v1/completions) on CUDA/Nebius (Mac MPS is unsupported for ` +
    `schema-faithful live locate). ` +
    `Helper: bash scripts/quickstart-live.sh <repo> [CWE] · docs/nebius-antares.md`
  );
}

function isLoopbackEndpoint(endpoint: string): boolean {
  try {
    const normalized = endpoint.includes("://") ? endpoint : `http://${endpoint}`;
    const host = new URL(normalized).hostname.toLowerCase();
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host === "0.0.0.0"
    );
  } catch {
    return /127\.0\.0\.1|localhost/i.test(endpoint);
  }
}

/**
 * Resolve fixture vs live. Throws on ambiguous / unsafe combinations.
 * Default (no flags) → fixture (CI-safe). --endpoint or --live → live (hard).
 * Remote (non-loopback) endpoints require --remote-inference / ACK env.
 */
export function resolveLocateMode(input: ModeResolveInput): LocateRunMode {
  const endpoint = input.endpoint?.trim() || "";
  const hasEndpoint = endpoint.length > 0;
  const wantsLive = Boolean(input.live) || hasEndpoint;

  if (input.fixture && wantsLive) {
    throw new Error(MIXED_MODE_REFUSED);
  }
  if (input.live && !hasEndpoint) {
    throw new Error(LIVE_ENDPOINT_REQUIRED);
  }
  if (wantsLive) {
    assertNotChatCompletions(endpoint);
    if (hasEndpoint && !isLoopbackEndpoint(endpoint)) {
      if (!remoteInferenceAcked({ remoteInference: input.remoteInference })) {
        throw new Error(`${REMOTE_INFERENCE_REQUIRED} ${NEBIUS_DOCS_HINT}`);
      }
    }
    return "live";
  }
  return "fixture";
}

export interface LiveEndpointGateOptions {
  endpoint: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Test seam — skip network and inject probe result */
  probeResult?: CompletionsProbeResult;
}

/**
 * Hard-fail when the live completions endpoint is unreachable.
 * Does not send repository source.
 */
export async function assertLiveEndpointHealthy(
  opts: LiveEndpointGateOptions,
): Promise<CompletionsProbeResult> {
  assertNotChatCompletions(opts.endpoint);
  const normalized = normalizeCompletionsEndpoint(opts.endpoint);

  const probe =
    opts.probeResult ??
    (await probeCompletionsEndpoint(normalized, {
      timeoutMs: opts.timeoutMs,
      fetchImpl: opts.fetchImpl,
    }));

  if (!probe.ok) {
    throw new Error(liveEndpointUnhealthyMessage(probe.detail));
  }
  return probe;
}
