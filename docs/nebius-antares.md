# Nebius / vLLM Antares (opt-in org path)

Scaffold for serving **`fdtn-ai/antares-1b`** on **Nebius CUDA** via an
OpenAI-compatible API that exposes **`POST /v1/completions`** (required by
`cisco-antares-cli` / ZERODAY live locate).

> **Do not** treat this doc as a purchase order. ZERODAY never creates paid
> Nebius resources. Operators run cloud commands themselves on authorized orgs.

## Why Nebius / CUDA (not Mac MPS)

| Path | Status |
|------|--------|
| **vLLM on CUDA (local or Nebius)** | Recommended for schema-faithful live Antares tool calls |
| **Mac MPS** (`scripts/completions_server.py`) | Unsupported for schema-faithful live locate — float32 stops NaN/`!` bangs but tool_call JSON is often malformed |
| **CI / GitHub Action** | Fixture-only — never pulls weights, never calls Nebius |

## Token Factory vs self-managed vLLM

| Option | Completions (`/v1/completions`) | Notes |
|--------|----------------------------------|-------|
| **Self-managed k8s / VM + `vllm serve`** | Yes (preferred) | Full control; matches Antares CLI expectations |
| **Nebius Token Factory** | Use only if it exposes **completions** (not chat-only) | Prefer self-managed vLLM when Token Factory is chat-only |

ZERODAY / Antares CLI use **`POST /v1/completions`**, not chat completions.

## Honesty / ACK

1. **HF gated weights** — a human must still accept Cisco terms on
   [fdtn-ai/antares-1b](https://huggingface.co/fdtn-ai/antares-1b). Never scrape/bypass.
2. **Remote inference leaves the machine** — prompts and repo-derived context
   may be sent to the GPU endpoint. Require explicit ACK:
   - CLI: `--remote-inference`
   - Env: `ZERODAY_REMOTE_INFERENCE_ACK=1`
3. **Authorized repos only** — see [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md).

## Environment

```bash
# Provider
ZERODAY_INFERENCE_PROVIDER=nebius          # or local (default)

# OpenAI-compatible base (must serve /v1/completions)
ZERODAY_ANTARES_BASE_URL=https://<nebius-vllm-host>/v1
ZERODAY_ANTARES_API_KEY=                   # if the gateway requires it

# Required for non-loopback endpoints
ZERODAY_REMOTE_INFERENCE_ACK=1

# Backward-compatible aliases still work:
# ANTARES_ENDPOINT=...
# ANTARES_API_KEY=...
# ANTARES_MODEL=fdtn-ai/antares-1b

# On the GPU host only (loads gated weights) — not needed for fixture CI:
# HUGGING_FACE_HUB_TOKEN=hf_...
```

## Operator script (run on Nebius — not by ZERODAY CI)

```bash
# Review then run on your Nebius GPU VM / k8s job — do not execute paid creates from CI
bash scripts/nebius-vllm-antares.sh --print-only
bash scripts/nebius-vllm-antares.sh --serve   # only on a machine you already provisioned
```

Typical serve (CUDA):

```bash
# On the GPU host after HF login + license accept:
vllm serve fdtn-ai/antares-1b --host 0.0.0.0 --port 8000
# → http://<host>:8000/v1/completions
```

## ZERODAY live against Nebius

```bash
export ZERODAY_INFERENCE_PROVIDER=nebius
export ZERODAY_ANTARES_BASE_URL=https://<host>/v1
export ZERODAY_REMOTE_INFERENCE_ACK=1

npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint "$ZERODAY_ANTARES_BASE_URL" --remote-inference

# or the factory loop:
npm run zeroday -- factory run --cwe CWE-89 --repo /path/to/authorized/repo \
  --no-fixture --live --endpoint "$ZERODAY_ANTARES_BASE_URL" --remote-inference
```

Without `--remote-inference` / ACK, non-loopback endpoints are **refused**.

## Related

- [`defense-factory.md`](./defense-factory.md) — factory north star
- [`antares.md`](./antares.md) — local Antares wrap
- Root README § Nebius / Mac MPS
