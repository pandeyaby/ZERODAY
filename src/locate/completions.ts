/**
 * Local vLLM / OpenAI-compatible completions client for Antares.
 *
 * Antares requires streaming POST /v1/completions (NOT chat).
 * Validated upstream with vLLM 0.19.1.
 *
 * ZERODAY does not reinvent the Antares agent loop — cisco-antares-cli owns that.
 * This module normalizes endpoints, probes reachability, and can issue a
 * completions-only smoke request (no repository source in the probe).
 */

export function normalizeCompletionsEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (/\/v1\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/completions`;
  return `${trimmed}/v1/completions`;
}

export function completionsBaseUrl(endpoint: string): string {
  return normalizeCompletionsEndpoint(endpoint).replace(
    /\/v1\/completions$/i,
    "",
  );
}

export interface CompletionsProbeResult {
  ok: boolean;
  endpoint: string;
  modelsUrl: string;
  detail: string;
  modelIds?: string[];
}

/**
 * Probe local endpoint without sending repository source.
 */
export async function probeCompletionsEndpoint(
  endpoint: string,
  opts?: { timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<CompletionsProbeResult> {
  const normalized = normalizeCompletionsEndpoint(endpoint);
  const base = completionsBaseUrl(normalized);
  const modelsUrl = `${base}/v1/models`;
  const fetchFn = opts?.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(modelsUrl, {
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 3000),
    });
    if (!res.ok) {
      return {
        ok: false,
        endpoint: normalized,
        modelsUrl,
        detail: `GET ${modelsUrl} → ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      data?: Array<{ id?: string }>;
    };
    const modelIds = (body.data ?? [])
      .map((m) => m.id)
      .filter((x): x is string => Boolean(x));
    return {
      ok: true,
      endpoint: normalized,
      modelsUrl,
      detail: `GET ${modelsUrl} → ${res.status} (${modelIds.length} model(s))`,
      modelIds,
    };
  } catch (e) {
    return {
      ok: false,
      endpoint: normalized,
      modelsUrl,
      detail: `GET ${modelsUrl} failed: ${(e as Error).message}`,
    };
  }
}

export interface CompletionsRequest {
  endpoint: string;
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Issue a completions-only request (no chat template).
 * Used for live endpoint validation; Antares localization uses cisco-antares-cli.
 */
export async function postCompletions(
  req: CompletionsRequest,
): Promise<{ ok: boolean; text: string; status: number; detail: string }> {
  const endpoint = normalizeCompletionsEndpoint(req.endpoint);
  const fetchFn = req.fetchImpl ?? fetch;
  const body = {
    model: req.model,
    prompt: req.prompt,
    max_tokens: req.maxTokens ?? 16,
    temperature: req.temperature ?? 0,
    stream: req.stream ?? false,
  };
  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(req.timeoutMs ?? 30_000),
    });
    const raw = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        text: "",
        status: res.status,
        detail: `POST ${endpoint} → ${res.status}: ${raw.slice(0, 400)}`,
      };
    }
    let text = "";
    try {
      const json = JSON.parse(raw) as {
        choices?: Array<{ text?: string; message?: { content?: string } }>;
      };
      text = json.choices?.[0]?.text ?? json.choices?.[0]?.message?.content ?? "";
    } catch {
      text = raw.slice(0, 500);
    }
    return {
      ok: true,
      text,
      status: res.status,
      detail: `POST ${endpoint} → ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      text: "",
      status: 0,
      detail: `POST ${endpoint} failed: ${(e as Error).message}`,
    };
  }
}

/** Refuse chat-completions URLs loudly. */
export function assertNotChatCompletions(endpoint: string): void {
  if (/\/v1\/chat\/completions/i.test(endpoint)) {
    throw new Error(
      "Antares requires POST /v1/completions — chat completions break the tool prompt. " +
        "Point --endpoint at http://127.0.0.1:8000/v1 (or .../v1/completions).",
    );
  }
}
