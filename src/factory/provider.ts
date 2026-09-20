/**
 * Inference provider resolution — local-first by default.
 * Remote CUDA vLLM (any host exposing OpenAI-compatible /v1/completions) is
 * opt-in and requires explicit ACK (--remote-inference or ZERODAY_REMOTE_INFERENCE_ACK).
 * Recommended remote host in product docs: RunPod (see docs/runpod-antares.md).
 *
 * Customer source must not leave the machine unless the operator opts in.
 */

import type { InferenceProvider } from "./types";

export const REMOTE_INFERENCE_REQUIRED =
  "Remote Antares inference requires explicit opt-in: pass --remote-inference " +
  "or set ZERODAY_REMOTE_INFERENCE_ACK=1. This may send prompts and repo-derived " +
  "context to the GPU endpoint. Local-first remains the default.";

export const REMOTE_DOCS_HINT =
  "See docs/runpod-antares.md (recommended CUDA path) and docs/remote-antares-vllm.md " +
  "(host-agnostic). Scaffold only — ZERODAY never creates paid GPU pods.";

/** @deprecated Use REMOTE_DOCS_HINT — kept as alias for older imports/tests */
export const NEBIUS_DOCS_HINT = REMOTE_DOCS_HINT;

export interface ResolvedInference {
  provider: InferenceProvider;
  endpoint?: string;
  apiKey?: string;
  remote: boolean;
  /** True when endpoint is clearly loopback */
  localLoopback: boolean;
}

function isLoopbackHost(url: string): boolean {
  try {
    const u = new URL(url.includes("://") ? url : `http://${url}`);
    const host = u.hostname.toLowerCase();
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host === "0.0.0.0"
    );
  } catch {
    return /127\.0\.0\.1|localhost/i.test(url);
  }
}

export function remoteInferenceAcked(opts?: {
  remoteInference?: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = opts?.env ?? process.env;
  if (opts?.remoteInference === true) return true;
  const v = (env.ZERODAY_REMOTE_INFERENCE_ACK || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Normalize provider tokens. Host-agnostic: local | remote.
 * Legacy "nebius" / "runpod" aliases map to "remote".
 */
export function normalizeInferenceProvider(
  raw: string,
): InferenceProvider {
  const v = raw.trim().toLowerCase();
  if (v === "local") return "local";
  if (v === "remote" || v === "runpod" || v === "nebius") return "remote";
  throw new Error(
    `Unknown ZERODAY_INFERENCE_PROVIDER='${raw}'. Use local|remote ` +
      `(aliases: runpod, nebius → remote).`,
  );
}

export function resolveInferenceProvider(
  opts?: {
    provider?: string;
    endpoint?: string;
    remoteInference?: boolean;
    env?: NodeJS.ProcessEnv;
  },
): ResolvedInference {
  const env = opts?.env ?? process.env;
  const provider = normalizeInferenceProvider(
    opts?.provider || env.ZERODAY_INFERENCE_PROVIDER || "local",
  );

  const endpoint =
    opts?.endpoint?.trim() ||
    env.LOCATE_BASE_URL?.trim() ||
    env.ZERODAY_ANTARES_BASE_URL?.trim() ||
    env.ANTARES_ENDPOINT?.trim() ||
    undefined;

  const apiKey =
    env.ZERODAY_ANTARES_API_KEY?.trim() ||
    env.ANTARES_API_KEY?.trim() ||
    undefined;

  const localLoopback = endpoint ? isLoopbackHost(endpoint) : true;
  const remote =
    provider === "remote" || (Boolean(endpoint) && !localLoopback);

  if (remote && !remoteInferenceAcked({ remoteInference: opts?.remoteInference, env })) {
    throw new Error(`${REMOTE_INFERENCE_REQUIRED} ${REMOTE_DOCS_HINT}`);
  }

  if (provider === "remote" && !endpoint) {
    throw new Error(
      "Remote provider selected but no endpoint set. " +
        "Set ZERODAY_ANTARES_BASE_URL (or --endpoint) to your vLLM OpenAI-compatible " +
        `base URL exposing POST /v1/completions. ${REMOTE_DOCS_HINT}`,
    );
  }

  return {
    provider,
    endpoint,
    apiKey,
    remote,
    localLoopback,
  };
}

/** Env var documentation block for .env.example / docs. */
export const INFERENCE_ENV_DOC = `
# Inference provider (local-first default)
# ZERODAY_INFERENCE_PROVIDER=local
# Opt-in remote CUDA vLLM — recommended host: RunPod (docs/runpod-antares.md)
# Requires ACK — prompts/repo-derived context may leave the machine:
# ZERODAY_INFERENCE_PROVIDER=remote
# ZERODAY_ANTARES_BASE_URL=https://<runpod-proxy-or-host>/v1
# ZERODAY_ANTARES_API_KEY=
# ZERODAY_REMOTE_INFERENCE_ACK=1
# HF token belongs on the GPU host that loads gated weights (not required for fixture CI)
# HUGGING_FACE_HUB_TOKEN=
`.trim();
