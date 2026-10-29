/**
 * API key for an Antares endpoint that asks for one.
 *
 * `zeroday antares up` starts vLLM with a random `--api-key`, so the pod's
 * public proxy URL does not answer strangers. The key is kept with the pod in
 * .zeroday/antares-pod.json (mode 0600) and is useless once the pod is gone.
 * ZERODAY_ENDPOINT_API_KEY / ANTARES_API_KEY override it for any endpoint.
 * The Antares CLI reads ANTARES_API_KEY and sends it as `Authorization: Bearer`.
 */

import fs from "node:fs";
import path from "node:path";

function baseOf(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "").replace(/\/completions$/i, "").replace(/\/v1$/i, "").toLowerCase();
}

export function endpointApiKey(
  endpoint: string | undefined,
  opts: { env?: Record<string, string | undefined>; cwd?: string } = {},
): string | undefined {
  const env = opts.env ?? process.env;
  const fromEnv = (env.ZERODAY_ENDPOINT_API_KEY || env.ANTARES_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
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
