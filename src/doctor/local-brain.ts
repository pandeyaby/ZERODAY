/**
 * Keyless K4 — local OpenAI-compatible brain doctor (print-only).
 *
 * Strangers can point `locate --endpoint` at any local host that exposes
 * POST /v1/completions (Ollama, local vLLM, LM Studio, etc.) without gated
 * Antares weights. Antares-1B remains the recommended live brain when HF+CUDA
 * are available. Arbitrary local models are NOT Antares File F1.
 *
 * This module never downloads models, never starts Ollama/vLLM, never
 * provisions RunPod, and never probes the network unless a caller opts in
 * separately. CI uses print-only / mocked paths only.
 */

import {
  assertNotChatCompletions,
  normalizeCompletionsEndpoint,
} from "../locate/completions";

export const LOCAL_BRAIN_DOCS = "docs/local-brain.md";
export const ANTARES_RECOMMENDED_DOCS = "docs/runpod-antares.md";
export const ANTARES_LOCAL_DOCS = "docs/antares.md";

export const CHAT_ONLY_REFUSED =
  "Local-brain doctor refuses chat-only hosts. " +
  "ZERODAY live locate requires POST /v1/completions " +
  "(not /v1/chat/completions). Point --endpoint at …/v1 or …/v1/completions. " +
  `See ${LOCAL_BRAIN_DOCS}.`;

export const QUALITY_HONESTY =
  "Honesty: arbitrary local models (Ollama / LM Studio / generic vLLM) are " +
  "NOT Antares File F1. Antares-1B remains the recommended live brain when " +
  "HF gated terms + CUDA/vLLM are available. Localization ≠ exploitability.";

export interface LocalBrainEndpointCheck {
  ok: boolean;
  endpoint?: string;
  loopback: boolean;
  detail: string;
  /** When false, remote ACK is required before locate */
  remoteAckRequired: boolean;
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
 * Shape-only endpoint check — no network. Refuses chat-only URLs.
 */
export function checkLocalBrainEndpointShape(
  endpoint: string,
): LocalBrainEndpointCheck {
  const raw = endpoint.trim();
  if (!raw) {
    return {
      ok: false,
      loopback: false,
      detail: "Empty --endpoint. Pass a completions base URL (e.g. http://127.0.0.1:8000/v1).",
      remoteAckRequired: false,
    };
  }

  try {
    assertNotChatCompletions(raw);
  } catch (e) {
    return {
      ok: false,
      loopback: false,
      detail: `${CHAT_ONLY_REFUSED} (${(e as Error).message})`,
      remoteAckRequired: false,
    };
  }

  const normalized = normalizeCompletionsEndpoint(raw);
  const loopback = isLoopbackEndpoint(raw);
  return {
    ok: true,
    endpoint: normalized,
    loopback,
    detail: loopback
      ? `OK loopback completions shape → ${normalized} (no --remote-inference required)`
      : `OK completions shape → ${normalized} (non-loopback — pass --remote-inference or ZERODAY_REMOTE_INFERENCE_ACK=1)`,
    remoteAckRequired: !loopback,
  };
}

/** Print-only checklist lines (no spend, no download, no server start). */
export function formatLocalBrainDoctorChecklist(): string {
  const lines = [
    "ZERODAY doctor — local OpenAI-compatible brain (Keyless K4)",
    "──────────────────────────────────────────────────────────",
    "Print-only checklist. Does NOT download models, start Ollama/vLLM/LM Studio,",
    "create RunPod pods, or probe the network. $0.",
    "",
    QUALITY_HONESTY,
    "",
    "1) Completions-only contract (hard lock)",
    "   • Required: POST /v1/completions  (OpenAI-compatible)",
    "   • Refused:  POST /v1/chat/completions  (chat-only hosts break the tool prompt)",
    "   • Point --endpoint at http://127.0.0.1:<port>/v1  (or …/v1/completions)",
    "   • Live mode stays mode: \"live\" when --endpoint is used (no new locate modes)",
    "",
    "2) Loopback vs remote ACK",
    "   • Loopback (127.0.0.1 / localhost / ::1): no --remote-inference needed",
    "   • Non-loopback host: require --remote-inference or ZERODAY_REMOTE_INFERENCE_ACK=1",
    "   • Customer source stays local-first unless you ACK remote",
    "",
    "3) Sample probe steps (YOU run these — doctor prints only)",
    "   # After YOU already started a completions server on this machine:",
    "   curl -sS http://127.0.0.1:8000/v1/models",
    "   curl -sS http://127.0.0.1:8000/v1/completions \\",
    "     -H 'Content-Type: application/json' \\",
    "     -d '{\"model\":\"<your-model-id>\",\"prompt\":\"ping\",\"max_tokens\":8}'",
    "   # Expect 200. Chat-only URLs must fail closed in ZERODAY.",
    "",
    "4) Example hosts (operator-started — ZERODAY never auto-starts)",
    "   • local vLLM:   vllm serve <model> --port 8000   → http://127.0.0.1:8000/v1",
    "   • Ollama:       enable OpenAI-compatible /v1; ensure completions (not chat-only)",
    "   • LM Studio:    local server → OpenAI-compatible; use /v1/completions",
    "   Mac MPS caveat: schema-faithful Antares tool_call is unreliable on MPS —",
    "   prefer CUDA/vLLM for Antares-1B. See docs/antares.md.",
    "",
    "5) Point locate at your local completions host",
    "   npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \\",
    "     --endpoint http://127.0.0.1:8000/v1 --model <your-model-id>",
    "   # Still mode: \"live\". No silent fixture/rules/ingest fallback if down.",
    "",
    "6) Recommended live brain (when HF + CUDA available)",
    "   Antares-1B (fdtn-ai/antares-1b) via vLLM on CUDA — best schema-faithful path.",
    `   Print-only Antares/RunPod checklist:  npm run zeroday -- antares doctor`,
    `   Docs: ${ANTARES_RECOMMENDED_DOCS} · ${ANTARES_LOCAL_DOCS}`,
    "",
    `Full one-pager: ${LOCAL_BRAIN_DOCS}`,
    "GRAX: completions-only · remote ACK · no model download · no auto-start · no PoC",
    "",
  ];
  return lines.join("\n");
}
