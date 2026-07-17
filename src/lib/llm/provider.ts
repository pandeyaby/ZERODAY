/**
 * Keyless-first LLM provider system.
 * Default: "keyless" — operator uses the user's existing AI agent (no remote calls).
 * Optional: OpenRouter, Anthropic, OpenAI, Ollama / OpenAI-compatible.
 */

import { dbRepo } from "@/lib/db/repo";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  simulated: boolean;
}

export async function complete(
  messages: LLMMessage[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const settings = dbRepo.getSettings();
  const provider = settings.llmProvider || "keyless";
  const model = settings.llmModel || defaultModel(provider);

  if (provider === "keyless") {
    return {
      content: keylessHeuristic(messages),
      provider: "keyless",
      model: "user-agent",
      simulated: true,
    };
  }

  const baseUrl =
    settings.llmBaseUrl ||
    process.env.ZERODAY_LLM_BASE_URL ||
    defaultBase(provider);
  const apiKey = resolveApiKey(provider);

  if (!apiKey && provider !== "ollama") {
    return {
      content: keylessHeuristic(messages) + "\n\n[Note: No API key configured — fell back to keyless heuristic.]",
      provider: "keyless-fallback",
      model,
      simulated: true,
    };
  }

  try {
    const url =
      provider === "anthropic"
        ? `${baseUrl.replace(/\/$/, "")}/v1/messages`
        : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey || "";
      headers["anthropic-version"] = "2023-06-01";
    } else if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const body =
      provider === "anthropic"
        ? {
            model,
            max_tokens: opts?.maxTokens || 1024,
            temperature: opts?.temperature ?? 0.2,
            system: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n"),
            messages: messages.filter((m) => m.role !== "system"),
          }
        : {
            model,
            temperature: opts?.temperature ?? 0.2,
            max_tokens: opts?.maxTokens || 1024,
            messages,
          };

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    const content =
      provider === "anthropic"
        ? extractAnthropic(json)
        : extractOpenAI(json);

    return { content, provider, model, simulated: false };
  } catch (err) {
    return {
      content:
        keylessHeuristic(messages) +
        `\n\n[LLM error: ${err instanceof Error ? err.message : String(err)}]`,
      provider: `${provider}-error-fallback`,
      model,
      simulated: true,
    };
  }
}

function resolveApiKey(provider: string): string | undefined {
  switch (provider) {
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "ollama":
      return undefined;
    case "custom":
      return process.env.ZERODAY_LLM_API_KEY || process.env.OPENAI_API_KEY;
    default:
      return undefined;
  }
}

function defaultBase(provider: string): string {
  switch (provider) {
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "anthropic":
      return "https://api.anthropic.com";
    case "openai":
      return "https://api.openai.com/v1";
    case "ollama":
      return process.env.OLLAMA_HOST
        ? `${process.env.OLLAMA_HOST.replace(/\/$/, "")}/v1`
        : "http://127.0.0.1:11434/v1";
    default:
      return "http://127.0.0.1:11434/v1";
  }
}

function defaultModel(provider: string): string {
  switch (provider) {
    case "openrouter":
      return "anthropic/claude-sonnet-4";
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "openai":
      return "gpt-4o-mini";
    case "ollama":
      return process.env.ZERODAY_LOCAL_MODEL || "llama3";
    default:
      return "user-agent";
  }
}

function extractOpenAI(json: Record<string, unknown>): string {
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content || JSON.stringify(json).slice(0, 500);
}

function extractAnthropic(json: Record<string, unknown>): string {
  const content = json.content as Array<{ text?: string }> | undefined;
  return content?.[0]?.text || JSON.stringify(json).slice(0, 500);
}

/**
 * Keyless heuristic "brain" — structured mission reasoning without an API.
 * Designed so the War Room works offline / with the user's Cursor agent as the real LLM.
 */
function keylessHeuristic(messages: LLMMessage[]): string {
  const last = messages.filter((m) => m.role === "user").pop()?.content || "";
  if (/plan|coordinate|phase|mission/i.test(last)) {
    return [
      "COORDINATOR PLAN",
      "1. Verify AuthorizationRecord acknowledged",
      "2. RECON — DNA/Meraki/ISE inventory + Splunk app/index discovery",
      "3. SCANNER — IOS config lint, ISE policy audit, SPL hygiene, nuclei fingerprints",
      "4. GHOST — detection gap scan vs Cisco→Splunk sources",
      "5. ANALYST — findings with evidence links; queue retest for high/critical",
      "All tools: safe_local unless receipt granted.",
    ].join("\n");
  }
  if (/finding|analyst|synthesize/i.test(last)) {
    return "Draft findings from tool evidence only. Require retest for severity≥high. Map vendor impact to Cisco and Splunk controls.";
  }
  return "Proceed within scope. Prefer safe_local adapters. Capture evidence for every material claim.";
}
