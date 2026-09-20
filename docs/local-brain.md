# Local OpenAI-compatible brain (Keyless K4)

Point `zeroday locate --endpoint` at **any** local OpenAI-compatible host that
exposes **`POST /v1/completions`** — without gated Antares weights — and keep
the same live SARIF / evidence pipeline.

> **Print-only first:** `npm run zeroday -- doctor --local-brain`  
> (or `bash scripts/local-brain-doctor.sh --print-only`)  
> Never downloads models, never auto-starts Ollama/vLLM/LM Studio, never
> provisions RunPod. **$0** in CI. (Workstation readiness: `npm run doctor`.)

## Honesty (read this)

| Claim | Reality |
|-------|---------|
| Local `--endpoint` works | Yes — same `mode: "live"` door when the host speaks completions |
| Quality = Antares File F1 | **No.** Arbitrary Ollama / LM Studio / generic vLLM models are **not** Antares F1 |
| Recommended live brain | **Antares-1B** (`fdtn-ai/antares-1b`) on CUDA/vLLM when HF terms + GPU available |
| New locate modes | **None** — still fixture / rules / ingest / recording / live |
| Localization = exploitability | **No** — candidates only; `needs_human`; no PoC |

Antares path (recommended when available): [`antares.md`](./antares.md) ·
[`runpod-antares.md`](./runpod-antares.md) · `npm run zeroday -- antares doctor`

## Hard locks (GRAX)

1. **Completions-only** — `POST /v1/completions`. Chat-only
   (`/v1/chat/completions`) is **refused** by doctor shape-check and by live
   locate (`assertNotChatCompletions`).
2. **Remote ACK** — non-loopback hosts still need `--remote-inference` or
   `ZERODAY_REMOTE_INFERENCE_ACK=1`.
3. **No silent fallback** — unhealthy endpoint fails loud (no fixture/rules/ingest).
4. **Print-only doctor** — no model download, no auto-start, no RunPod create.

## Completions contract

| Requirement | Detail |
|-------------|--------|
| API | `POST /v1/completions` (chat rejected) |
| Endpoint flag | `--endpoint http://127.0.0.1:<port>/v1` (or `…/v1/completions`) |
| Model | `--model <id>` matching what **your** server lists on `GET /v1/models` |
| SARIF `mode` | `"live"` (same door as Antares live — brain quality may differ) |
| Loopback | No remote ACK |
| Non-loopback | `--remote-inference` / `ZERODAY_REMOTE_INFERENCE_ACK=1` |

## Doctor checklist

```bash
npm run zeroday -- doctor --local-brain
# optional shape-only check (no network):
npm run zeroday -- doctor --local-brain --endpoint http://127.0.0.1:8000/v1
# chat-only URLs fail closed:
npm run zeroday -- doctor --endpoint http://127.0.0.1:8000/v1/chat/completions
# → exit 2
```

## Example hosts (you start them)

ZERODAY does **not** start these processes.

### Local vLLM

```bash
# On a machine you already control (CUDA preferred for Antares; any model for experiment):
vllm serve <your-model-id> --host 127.0.0.1 --port 8000
# Expect: http://127.0.0.1:8000/v1/completions
```

### Ollama (OpenAI-compatible)

Enable Ollama’s OpenAI-compatible API and confirm **`/v1/completions`** works —
chat-only adapters are refused. Typical loopback base:

```bash
# After YOU start Ollama with an OpenAI-compatible listener:
export OLLAMA_HOST=127.0.0.1:11434   # example — your setup may differ
curl -sS http://127.0.0.1:11434/v1/models
# Smoke completions (not chat):
curl -sS http://127.0.0.1:11434/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"<tag>","prompt":"ping","max_tokens":8}'
```

If your Ollama build only exposes chat completions, it is **out of contract** for
ZERODAY live locate until completions are available.

**Optional Antares-350M via Ollama** (import yourself; no auto-download; no F1
claim): [`antares-350m-ollama.md`](./antares-350m-ollama.md) · Desk Live brain
preset `antares-350m-ollama`.

### LM Studio

Start LM Studio’s local server, pick the OpenAI-compatible base URL, and use the
**completions** route (not chat-only). Example:

```bash
curl -sS http://127.0.0.1:1234/v1/models
curl -sS http://127.0.0.1:1234/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"<loaded-id>","prompt":"ping","max_tokens":8}'
```

## Point locate

```bash
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint http://127.0.0.1:8000/v1 \
  --model <your-model-id>
# → report.sarif with mode: "live"
```

Remote / LAN host:

```bash
export ZERODAY_REMOTE_INFERENCE_ACK=1
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint https://gpu-box.example:8000/v1 \
  --model <your-model-id> --remote-inference
```

Requires the official Antares CLI on PATH for the live agent loop
(`uv tool install cisco-antares-cli`) — ZERODAY wraps `antares query`; it does
not reimplement the agent. The **weights** behind `/v1/completions` can be
Antares-1B **or** another completions-capable model you already serve.

## Mac MPS caveat

Mac MPS remains **unsupported** for schema-faithful Antares tool_call JSON
(float16 bangs; float32 can clear bangs but tool schema is often malformed).
Prefer CUDA/vLLM for Antares-1B. Local helpers: `scripts/completions_server.py`
(bang-safe smoke only). See [`antares.md`](./antares.md).

## What this does **not** do

- Bundle or download model weights
- Auto-start Ollama / vLLM / LM Studio
- Auto-provision RunPod or any cloud GPU
- Add new locate modes (`rules` / `ingest` / `recording` / `fixture` unchanged)
- Claim parity with Antares File F1 for arbitrary local models
- Write PoCs / exploits / attack procedures

## Related

- [`antares.md`](./antares.md) — Antares CLI + HF gated path
- [`antares-350m-ollama.md`](./antares-350m-ollama.md) — optional Antares-350M via Ollama
- [`runpod-antares.md`](./runpod-antares.md) — recommended remote CUDA
- [`remote-antares-vllm.md`](./remote-antares-vllm.md) — host-agnostic completions contract
- [`cli-api.md`](./cli-api.md) — CLI reference
- Root README § How it works / Live Antares / Local brain
