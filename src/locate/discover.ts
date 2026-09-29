/**
 * Zero-config Antares: find a completions server for `locate --live` when no
 * --endpoint is given.
 *
 * Order: environment (ANTARES_ENDPOINT …) → the Desk's saved endpoint
 * (.zeroday/desk-endpoint.json, written by Live brain / last good Antares run)
 * → the usual local ports (vLLM :8000, Ollama :11434, LM Studio :1234).
 * Only loopback addresses are probed, and only `GET /v1/models` is sent — no
 * repository content, no network scanning.
 */

import fs from "node:fs";
import path from "node:path";

export const LOCAL_CANDIDATES = [
  { endpoint: "http://127.0.0.1:8000/v1", server: "vLLM" },
  { endpoint: "http://127.0.0.1:11434/v1", server: "Ollama" },
  { endpoint: "http://127.0.0.1:1234/v1", server: "LM Studio" },
] as const;

const ENV_KEYS = ["LOCATE_BASE_URL", "ZERODAY_ANTARES_BASE_URL", "ANTARES_ENDPOINT"] as const;

export interface DiscoveredEndpoint {
  endpoint: string;
  /** Model to use: the server's Antares model, or the caller's --model. */
  model: string;
  source: "env" | "saved" | "local-probe";
  /** The saved Desk config carries an explicit remote-inference ACK for this endpoint. */
  remoteInference?: boolean;
  server?: string;
  models: string[];
  /** One line for the CLI / report warnings. */
  detail: string;
}

export interface DiscoverOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  /** --model / ANTARES_MODEL, when the caller chose one. */
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryError";
  }
}

function baseOf(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "").replace(/\/completions$/i, "").replace(/\/v1$/i, "");
}

async function listModels(endpoint: string, opts: DiscoverOptions): Promise<string[] | null> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${baseOf(endpoint)}/v1/models`, { signal: AbortSignal.timeout(opts.timeoutMs ?? 1500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: Array<{ id?: unknown }> };
    return (body.data ?? []).map((m) => String(m.id ?? "")).filter(Boolean);
  } catch {
    return null;
  }
}

/** Antares-named model on the server, else the caller's --model if the server serves it. */
function pickModel(models: string[], wanted?: string): string | null {
  if (wanted) return models.length === 0 || models.includes(wanted) ? wanted : null;
  return models.find((m) => /antares/i.test(m)) ?? null;
}

interface SavedEndpoint {
  endpoint: string;
  model?: string;
  remoteInference: boolean;
}

/** Saved Desk endpoints, best first: last good Antares run, then the active config. */
function savedEndpoints(cwd: string): SavedEndpoint[] {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(cwd, ".zeroday", "desk-endpoint.json"), "utf8")) as Record<string, unknown>;
    const out: SavedEndpoint[] = [];
    for (const c of [raw.lastGoodAntares, raw] as Array<Record<string, unknown> | undefined>) {
      if (!c || typeof c.endpoint !== "string" || !c.endpoint.trim()) continue;
      if (out.some((o) => baseOf(o.endpoint) === baseOf(c.endpoint as string))) continue;
      out.push({
        endpoint: c.endpoint,
        ...(typeof c.model === "string" ? { model: c.model } : {}),
        remoteInference: c.remoteInference === true,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function discoverLiveEndpoint(opts: DiscoverOptions = {}): Promise<DiscoveredEndpoint> {
  const env = opts.env ?? process.env;
  const wanted = opts.model ?? env.ANTARES_MODEL ?? undefined;
  const tried: string[] = [];

  // 1 · environment: an explicit choice — use it even if it doesn't answer yet
  //     (the health check that follows fails closed with the usual guidance).
  for (const key of ENV_KEYS) {
    const v = env[key]?.trim();
    if (v) {
      const models = (await listModels(v, opts)) ?? [];
      const model = pickModel(models, wanted) ?? wanted ?? models.find((m) => /antares/i.test(m)) ?? "fdtn-ai/antares-1b";
      return { endpoint: v, model, source: "env", models, detail: `Using ${v} from $${key} (model ${model})` };
    }
  }

  // 2 · the Desk's saved endpoints (Live brain / last good Antares run)
  for (const saved of savedEndpoints(opts.cwd ?? process.cwd())) {
    const models = await listModels(saved.endpoint, opts);
    tried.push(`${saved.endpoint} (saved)`);
    if (!models) continue;
    const model = pickModel(models, wanted ?? saved.model);
    if (model) {
      return {
        endpoint: saved.endpoint,
        model,
        source: "saved",
        models,
        ...(saved.remoteInference ? { remoteInference: true } : {}),
        detail: `Using saved endpoint ${saved.endpoint} (model ${model}${saved.remoteInference ? "; remote-inference ACK from saved Desk config" : ""})`,
      };
    }
  }

  // 3 · usual local servers, loopback only
  const found: Array<{ endpoint: string; server: string; models: string[] }> = [];
  for (const c of LOCAL_CANDIDATES) {
    tried.push(`${c.endpoint} (${c.server})`);
    const models = await listModels(c.endpoint, opts);
    if (!models) continue;
    found.push({ endpoint: c.endpoint, server: c.server, models });
    const model = pickModel(models, wanted);
    if (model) {
      return {
        endpoint: c.endpoint,
        model,
        source: "local-probe",
        server: c.server,
        models,
        detail: `Found ${c.server} at ${c.endpoint} serving ${model}`,
      };
    }
  }

  const running = found.map((f) => `${f.server} at ${f.endpoint} (models: ${f.models.slice(0, 5).join(", ") || "none"})`);
  throw new DiscoveryError(
    [
      "No Antares endpoint found.",
      `Looked at: ${tried.join(", ")}.`,
      running.length
        ? `Running, but not serving ${wanted ? wanted : "an Antares model"}: ${running.join("; ")} — serve fdtn-ai/antares-1b there, or pass --model <id>.`
        : "No local completions server is running.",
      "Start one (CUDA): vllm serve fdtn-ai/antares-1b — or remote: docs/runpod-antares.md, then --endpoint <url> --remote-inference.",
      "Or set ANTARES_ENDPOINT. Keyless alternative: --rules.",
    ].join("\n"),
  );
}
