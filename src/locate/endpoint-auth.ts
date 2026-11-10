/**
 * API key for an Antares endpoint that asks for one.
 *
 * `zeroday antares up` starts vLLM with a random `--api-key`, so the pod's
 * public proxy URL does not answer strangers. The key is kept with the pod in
 * .zeroday/antares-pod.json (mode 0600) and is useless once the pod is gone.
 * ZERODAY_ENDPOINT_API_KEY / ANTARES_API_KEY override it; when ANTARES_ENDPOINT
 * (or LOCATE_BASE_URL / ZERODAY_ANTARES_BASE_URL) is set too, only for that host.
 * The Antares CLI reads ANTARES_API_KEY and sends it as `Authorization: Bearer`.
 */

import fs from "node:fs";
import path from "node:path";

function baseOf(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "").replace(/\/completions$/i, "").replace(/\/v1$/i, "").toLowerCase();
}

const ENDPOINT_ENV = ["LOCATE_BASE_URL", "ZERODAY_ANTARES_BASE_URL", "ANTARES_ENDPOINT"] as const;

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint.trim()).host.toLowerCase();
  } catch {
    return baseOf(endpoint);
  }
}

export function endpointApiKey(
  endpoint: string | undefined,
  opts: { env?: Record<string, string | undefined>; cwd?: string } = {},
): string | undefined {
  const env = opts.env ?? process.env;
  const fromEnv = (env.ZERODAY_ENDPOINT_API_KEY || env.ZERODAY_ANTARES_API_KEY || env.ANTARES_API_KEY || "").trim();
  if (fromEnv) {
    // When the environment also names the endpoint, the key belongs to that
    // host: never send it to a different URL (a typed-in probe, another server).
    const named = ENDPOINT_ENV.map((k) => env[k]?.trim()).filter((v): v is string => Boolean(v));
    if (!endpoint || named.length === 0 || named.some((n) => hostOf(n) === hostOf(endpoint))) return fromEnv;
    return undefined;
  }
  if (!endpoint) return undefined;
  try {
    const state = JSON.parse(
      fs.readFileSync(path.join(opts.cwd ?? process.cwd(), ".zeroday", "antares-pod.json"), "utf8"),
    ) as { endpoint?: string; apiKey?: string; deletedAt?: string };
    if (state.apiKey && !state.deletedAt && state.endpoint && baseOf(state.endpoint) === baseOf(endpoint)) {
      return state.apiKey;
    }
  } catch {
    /* no pod */
  }
  return undefined;
}

/** `Authorization` header for requests to the endpoint, when it needs one. */
export function endpointAuthHeaders(endpoint: string | undefined, opts?: Parameters<typeof endpointApiKey>[1]): Record<string, string> {
  const key = endpointApiKey(endpoint, opts);
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/** Environment for the Antares CLI: passes the endpoint's key as ANTARES_API_KEY. */
export function antaresCliEnv(
  endpoint: string | undefined,
  extra: Record<string, string>,
  env: Record<string, string | undefined> = process.env,
): NodeJS.ProcessEnv {
  const key = endpointApiKey(endpoint, { env });
  return { ...env, ...extra, ...(key ? { ANTARES_API_KEY: key } : {}) } as NodeJS.ProcessEnv;
}
