/**
 * Live Antares path guards — refuse silent fixture/mock fallback.
 *
 * When an operator asks for live locate (--live / --endpoint), ZERODAY must
 * either run real Antares against a healthy completions endpoint or fail loud.
 * Never degrade to fixture recordings without an explicit --fixture (alone).
 *
 * Non-loopback / remote CUDA endpoints require explicit remote-inference ACK so
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
  REMOTE_DOCS_HINT,
} from "../factory/provider";

export type LocateRunMode =
  | "fixture"
  | "live"
  | "rules"
  | "ingest"
  | "recording";

export interface ModeResolveInput {
  fixture?: boolean;
  live?: boolean;
  /** Explicit keyless real-repo heuristics (Keyless K1). Incompatible with fixture/live/ingest/recording. */
  rules?: boolean;
  /** Local SARIF path (Keyless K2). Incompatible with fixture/rules/live/recording. */
  fromSarif?: string;
  /** Redacted org cassette path (Keyless K3). Replay door — incompatible with other doors. */
  recording?: string;
  /** Raw or normalized endpoint (ANTARES_ENDPOINT / --endpoint) */
  endpoint?: string;
  /** Opt-in: allow prompts/repo-derived context to a remote GPU endpoint */
  remoteInference?: boolean;
}

export const LIVE_ENDPOINT_REQUIRED =
  "Live locate requires --endpoint pointing at a completions server " +
  "(e.g. http://127.0.0.1:8000/v1 or a RunPod proxy). Antares CLI expects " +
  "POST /v1/completions — not chat. Refusing to continue without an endpoint " +
  "(no silent fixture fallback). For remote CUDA see docs/runpod-antares.md " +
  "(requires --remote-inference).";

export const MIXED_MODE_REFUSED =
  "Refusing mixed mode: --fixture, --rules, --from-sarif, --recording, and --live/--endpoint are mutually exclusive. " +
  "--fixture is CI / no-GPU recorded smoke only; --rules is keyless real-repo heuristics; " +
  "--from-sarif ingests a local SARIF file (no network); " +
  "--recording replays a redacted org CI cassette (Keyless K3); " +
  "live Antares needs a healthy --endpoint (see scripts/quickstart-live.sh). " +
  "Do not combine these doors.";

export function liveEndpointUnhealthyMessage(detail: string): string {
  return (
    `Live locate refused: completions endpoint unhealthy (${detail}). ` +
    `No fixture/mock fallback. Accept HF terms for fdtn-ai/antares-1b, serve with vLLM ` +
    `(completions-only /v1/completions) on CUDA — recommended remote host: RunPod ` +
    `(Mac MPS is unsupported for schema-faithful live locate). ` +
    `Helper: bash scripts/quickstart-live.sh <repo> [CWE] · docs/runpod-antares.md`
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
 * Resolve fixture vs rules vs ingest vs recording vs live.
 * Throws on ambiguous / unsafe combinations.
 * Default (no flags) → fixture (CI-safe). --rules → rules. --from-sarif → ingest.
 * --recording → org cassette replay. --endpoint or --live → live (hard).
 * Remote endpoints need --remote-inference.
 */
export function resolveLocateMode(input: ModeResolveInput): LocateRunMode {
  const endpoint = input.endpoint?.trim() || "";
  const hasEndpoint = endpoint.length > 0;
  const wantsLive = Boolean(input.live) || hasEndpoint;
  const wantsRules = Boolean(input.rules);
  const wantsIngest = Boolean(input.fromSarif?.trim());
  const wantsRecording = Boolean(input.recording?.trim());
  const wantsFixture = Boolean(input.fixture);

  // Mutual exclusion: fixture / rules / ingest / recording / live
  const doors = [
    wantsFixture,
    wantsRules,
    wantsIngest,
    wantsRecording,
    wantsLive,
  ].filter(Boolean).length;
  if (doors > 1) {
    throw new Error(MIXED_MODE_REFUSED);
  }

  if (input.live && !hasEndpoint) {
    throw new Error(LIVE_ENDPOINT_REQUIRED);
  }
  if (wantsLive) {
    assertNotChatCompletions(endpoint);
    if (hasEndpoint && !isLoopbackEndpoint(endpoint)) {
      if (!remoteInferenceAcked({ remoteInference: input.remoteInference })) {
        throw new Error(`${REMOTE_INFERENCE_REQUIRED} ${REMOTE_DOCS_HINT}`);
      }
    }
    return "live";
  }
  if (wantsRecording) {
    return "recording";
  }
  if (wantsIngest) {
    return "ingest";
  }
  if (wantsRules) {
    return "rules";
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
