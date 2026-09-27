/**
 * HTTP bodies for Desk actions. `cwd` and the probe test seams are server-side
 * options: `cwd` is the root the path sandbox is checked against, so a client
 * that could set it would pick its own sandbox. They are dropped here before a
 * body reaches runDeskAction / runLiveAction / runReportsAction.
 */

export const SERVER_ONLY_FIELDS = [
  "cwd",
  "probeResult",
  "probeFetch",
  "locateProbeResult",
] as const;

export function publicRequestBody<T extends object>(body: T): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {} as T;
  const out = { ...body } as Record<string, unknown>;
  for (const key of SERVER_ONLY_FIELDS) delete out[key];
  return out as T;
}
