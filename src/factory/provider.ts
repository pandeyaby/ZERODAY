/**
 * Inference provider resolution — local-first by default.
 * Nebius / remote CUDA vLLM is opt-in and requires explicit ACK
 * (--remote-inference or ZERODAY_REMOTE_INFERENCE_ACK).
 *
 * Customer source must not leave the machine unless the operator opts in.
 */

import type { InferenceProvider } from "./types";

export const REMOTE_INFERENCE_REQUIRED =
  "Remote / Nebius inference requires explicit opt-in: pass --remote-inference " +
  "or set ZERODAY_REMOTE_INFERENCE_ACK=1. This may send prompts and repo-derived " +
  "context to the GPU endpoint. Local-first remains the default.";

export const NEBIUS_DOCS_HINT =
  "See docs/nebius-antares.md and scripts/nebius-vllm-antares.sh " +
  "(operator-run scaffold — ZERODAY never creates paid Nebius resources).";

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

export function resolveInferenceProvider(
  opts?: {
    provider?: string;
    endpoint?: string;
    remoteInference?: boolean;
    env?: NodeJS.ProcessEnv;
  },
): ResolvedInference {
  const env = opts?.env ?? process.env;
  const rawProvider = (
    opts?.provider ||
    env.ZERODAY_INFERENCE_PROVIDER ||
    "local"
  )
    .trim()
    .toLowerCase();

  if (rawProvider !== "local" && rawProvider !== "nebius") {
    throw new Error(
      `Unknown ZERODAY_INFERENCE_PROVIDER='${rawProvider}'. Use local|nebius.`,
    );
  }
  const provider = rawProvider as InferenceProvider;

  const endpoint =
    opts?.endpoint?.trim() ||
    env.ZERODAY_ANTARES_BASE_URL?.trim() ||
    env.ANTARES_ENDPOINT?.trim() ||
    undefined;

  const apiKey =
    env.ZERODAY_ANTARES_API_KEY?.trim() ||
    env.ANTARES_API_KEY?.trim() ||
    undefined;

  const localLoopback = endpoint ? isLoopbackHost(endpoint) : true;
  const remote =
    provider === "nebius" || (Boolean(endpoint) && !localLoopback);

  if (remote && !remoteInferenceAcked({ remoteInference: opts?.remoteInference, env })) {
    throw new Error(
      `${REMOTE_INFERENCE_REQUIRED} ${NEBIUS_DOCS_HINT}`,
    );
  }

  if (provider === "nebius" && !endpoint) {
    throw new Error(
      "Nebius provider selected but no endpoint set. " +
        "Set ZERODAY_ANTARES_BASE_URL (or --endpoint) to your vLLM OpenAI-compatible " +
        `base URL exposing POST /v1/completions. ${NEBIUS_DOCS_HINT}`,
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
# Opt-in Nebius / remote CUDA vLLM (requires ACK — may leave the machine):
# ZERODAY_INFERENCE_PROVIDER=nebius
# ZERODAY_ANTARES_BASE_URL=https://<your-nebius-vllm-host>/v1
# ZERODAY_ANTARES_API_KEY=
# ZERODAY_REMOTE_INFERENCE_ACK=1
# HF token belongs on the GPU host that loads gated weights (not required for fixture CI)
# HUGGING_FACE_HUB_TOKEN=
`.trim();
