# Antares-350M via Ollama (optional local brain)

Optional stranger path: run a **local** Antares-350M-class completions host
through **Ollama**, then point Desk **Live brain** or `locate --endpoint` at it.

> **Print-only / no auto-download.** ZERODAY never pulls HF weights or GGUF,
> never starts Ollama, never provisions RunPod, and never scrapes past the HF
> gate. You import the model yourself first.

## Honesty (read this)

| Claim | Reality |
|-------|---------|
| Official weights | [`fdtn-ai/antares-350m`](https://huggingface.co/fdtn-ai/antares-350m) — **HF gated** Transformers + BF16 safetensors, Apache-2.0; **no official GGUF** |
| Community GGUF | [`DevQuasar/fdtn-ai.antares-350m-GGUF`](https://huggingface.co/DevQuasar/fdtn-ai.antares-350m-GGUF) — ungated, **unofficial** |
| Ollama native pull | **None** for Antares-350M — import via `ollama run hf.co/…` or Modelfile `FROM ./….gguf` + `ollama create` |
| Completions contract | Ollama OpenAI-compat includes `POST /v1/completions` — **required** by ZERODAY (chat-only refused) |
| Quality / File F1 | **No guarantees.** Quantized / community GGUF ≠ claimed Antares File F1. Incomplete locate is possible |
| Recommended live brain | Still **Antares-1B** on CUDA/vLLM when HF terms + GPU are available ([`antares.md`](./antares.md)) |

## Hard locks (GRAX)

1. **No auto-download** of HF safetensors or GGUF into CI or operator machines by ZERODAY.
2. **No auto RunPod** / auto-spend / auto-start of Ollama.
3. **No scraping** past the HF gate — accept terms yourself, or knowingly use community GGUF.
4. **No agentic F1 / quality claims** for this Ollama path.
5. Completions-only · remote ACK for non-loopback · `needs_human` · localization ≠ exploitability.

## Stranger steps

### 1. Choose weights (you)

**Path A — official (gated):** accept HF terms on
[fdtn-ai/antares-350m](https://huggingface.co/fdtn-ai/antares-350m). Official
artifacts are Transformers + BF16 safetensors (no official GGUF). Convert /
serve only with tooling **you** control; ZERODAY does not convert or ship GGUF.

**Path B — community GGUF (ungated, unofficial):** knowingly use
[DevQuasar/fdtn-ai.antares-350m-GGUF](https://huggingface.co/DevQuasar/fdtn-ai.antares-350m-GGUF).
Prefer **Q8** or **Q6** quantizations when available (better fidelity than
aggressive low-bit quants for tool-call style work — still no F1 claim).

### 2. Import into Ollama (you)

Ollama has **no** native Antares-350M library pull. Examples (adjust tag /
filename to what you actually downloaded):

```bash
# Option 1 — Hugging Face Hub import helper (community GGUF), after YOU choose a quant:
ollama run hf.co/DevQuasar/fdtn-ai.antares-350m-GGUF

# Option 2 — local GGUF + Modelfile (prefer Q8/Q6 file you already have):
# Modelfile:
#   FROM ./fdtn-ai.antares-350m.Q8_0.gguf
ollama create antares-350m -f Modelfile
```

Name the local tag whatever you like; Desk preset placeholder is `antares-350m`
— change the model id in Live brain / `--model` to match `ollama list`.

### 3. Confirm completions (not chat-only)

```bash
# After YOU start Ollama with OpenAI-compatible listener (typical loopback):
curl -sS http://127.0.0.1:11434/v1/models
curl -sS http://127.0.0.1:11434/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"antares-350m","prompt":"ping","max_tokens":8}'
```

If your Ollama build only exposes `/v1/chat/completions`, it is **out of
contract** until completions work.

### 4. Point ZERODAY Live brain / locate

**Desk Console** (`npm run play` → **Live brain**): pick preset
**Antares-350M (Ollama)** — fills `http://127.0.0.1:11434/v1` + model placeholder
`antares-350m`. Human must have imported the model first. HF gated note stays
visible; no auto-download.

**CLI:**

```bash
npm run zeroday -- doctor --endpoint http://127.0.0.1:11434/v1
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint http://127.0.0.1:11434/v1 \
  --model antares-350m
```

Expect possible **incomplete** locate (`no_submit` / budget / parse) — that is
honest failure, not a silent fixture fallback.

## What this does **not** do

- Auto-download HF / GGUF or convert safetensors → GGUF in-repo
- Auto-start Ollama or auto-provision RunPod
- Bypass or scrape HF gated terms
- Claim Antares File F1 / agentic quality for quantized or community builds
- Replace the recommended Antares-1B + vLLM path

## Related

- [`local-brain.md`](./local-brain.md) — any local completions host (Keyless K4)
- [`antares.md`](./antares.md) — official CLI + Antares-1B recommended path
- Desk **Live brain** presets — `antares-350m-ollama` in `src/desk/live-endpoint.ts`
- Root README § Live brain / Local brain
