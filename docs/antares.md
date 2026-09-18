# Antares + ZERODAY

ZERODAY wraps Cisco Foundation AI’s Antares for daily-driver localization.
It does **not** reimplement `cisco-antares-cli`.

## Official CLI (v0.1.0)

```bash
uv tool install cisco-antares-cli
antares --version
```

| Command | Role |
|---------|------|
| `antares query PATH --cwe` | Live localization (needs `/v1/completions`) |
| `antares plan PATH` | Local CWE portfolio — **no inference** |
| `antares sweep` | Multi-CWE sweeps |
| `--export FILE.tar.gz` | Bundle Antares reports |

There is **no** `antares locate`. `zeroday locate` wraps `query` (and `plan` via `zeroday plan`).

## 30-minute live → SARIF

1. `npm install` + `uv tool install cisco-antares-cli`
2. **Human** accepts HF terms: [fdtn-ai/antares-1b](https://huggingface.co/fdtn-ai/antares-1b) (never scrape/bypass)
3. Serve locally with completions-only `POST /v1/completions` (Antares CLI expects vLLM 0.19.1+; ZERODAY does not claim independent vLLM validation)
4. One command:

```bash
npm run zeroday -- locate --cwe CWE-89 --repo /path --endpoint http://127.0.0.1:8000/v1
# helper (fails if endpoint down; never silent fixture fallback):
bash scripts/quickstart-live.sh /path CWE-89
```

## Completions only

Any OpenAI-compatible **`POST /v1/completions`** host can back live locate
(Keyless K4 — see [`local-brain.md`](./local-brain.md)). **Antares-1B** remains
the recommended brain when HF gated terms + CUDA/vLLM are available; arbitrary
local models are **not** Antares File F1.

```bash
# CUDA / RunPod (recommended — schema-faithful tool_call JSON)
vllm serve fdtn-ai/antares-1b
# Recommended remote: docs/runpod-antares.md · scripts/runpod-vllm-antares.sh

# Mac MPS — UNSUPPORTED for schema-faithful live locate:
#   (a) float16 NaN → `!` bangs; float32 fixes bangs
#   (b) tool_call schema often malformed on MPS → 0 tools; prefer vLLM/CUDA
# ZERODAY does not soft-rewrite tool JSON. Local helper only — bang-safe smoke:
python scripts/completions_server.py --model fdtn-ai/antares-1b --port 8000
# POST /v1/completions — chat completions are rejected
# Non-loopback endpoints require --remote-inference / ZERODAY_REMOTE_INFERENCE_ACK=1
```

**Model ID:** with `--endpoint` / `--live`, ZERODAY defaults to `fdtn-ai/antares-1b` (`--model` / `ANTARES_MODEL` override). Antares CLI requires this explicit id.

**Incomplete:** if Antares exits without `submit_vulnerable_files` **and** the raw report has **zero** findings, `report.md` classifies the reason (`no_submit` / `budget_exhausted` / `timeout` / `endpoint_error` / `parse_failure`) — no invented findings. If Antares already listed ranked `findings` (partial tool failures / missing explicit submit in the trace), ZERODAY surfaces those candidates as complete localization evidence — not bare `no_submit` (Harden D). Live defaults `--tool-budget 30`, best-effort one re-query, `--fail-on-incomplete` (exit 2). Raise `--tool-budget 45` / fix server health / prefer vLLM on CUDA (MPS float32 is bang-safe but tool-schema unreliable). See [`paths.md`](./paths.md#live-antares-opt-in) (Live incomplete runs).

Do **not** download `model.safetensors` onto CI machines. Accept HF terms on an operator workstation.

## CI / no-GPU (separate path)

```bash
npm run zeroday -- locate --cwe CWE-89 --fixture   # recorded — not live
npm run zeroday -- operate --cwe CWE-89 --fixture  # keyless agent path
```

`--fixture` + `--live`/`--endpoint` together is **refused**.

## Models

| Model | File F1 | Context |
|-------|---------|---------|
| `fdtn-ai/antares-1b` | 0.209 | 128K |
| `fdtn-ai/antares-350m` | 0.135 | 32K |
| Antares-3B | — | Cisco-internal; never claimed |

## Snapshot / platform

100k files / 2 GiB / 256 MiB per file · Linux/macOS · native Windows not supported.

## Optional: Antares-350M via Ollama

Local Ollama import of Antares-350M-class weights (official HF gated; community
GGUF unofficial; prefer Q8/Q6; **no File F1 claim**; you import first — ZERODAY
never auto-downloads): [`antares-350m-ollama.md`](./antares-350m-ollama.md).

## Sister pieces

- [Antares site](https://cisco-foundation-ai.github.io/antares/) · [cookbook Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md)
- [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) — Detector-lane **candidates** only; human triage for true-positive
- [Project CodeGuard](https://project-codeguard.org/) — patch DRAFT rule map (`--i-asked-for-a-fix`)

## Exporters

See root README. Local projection from `report.json` only — no vendor cloud pushes.
