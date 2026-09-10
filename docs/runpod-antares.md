# RunPod + vLLM Antares (recommended remote CUDA path)

Operator scaffold for serving **`fdtn-ai/antares-1b`** on a **RunPod GPU pod**
via an OpenAI-compatible API that exposes **`POST /v1/completions`** (required by
`cisco-antares-cli` / ZERODAY live locate).

> **ZERODAY never creates or starts paid RunPod pods.** This doc +
> `scripts/runpod-vllm-antares.sh --print-only` only print commands you run
> yourself on a pod you already provisioned.

## Why RunPod (not Mac MPS)

| Path | Status |
|------|--------|
| **RunPod CUDA + `vllm serve`** | **Recommended** remote path for schema-faithful live Antares |
| **Local CUDA box** | Also fine — same `/v1/completions` contract |
| **Mac MPS** | Unsupported for schema-faithful live locate |
| **CI / GitHub Action** | Fixture-only — never pulls weights, never calls RunPod |

Host-agnostic overview (any GPU host): [`remote-antares-vllm.md`](./remote-antares-vllm.md).

## GPU tier guidance (1B)

`fdtn-ai/antares-1b` is a ~1B-parameter model with a large context window. For
operator smoke / localize:

- Prefer a **single modern NVIDIA GPU with ≥16 GB VRAM** (e.g. RTX 4090 / A4000 /
  L4 class — or larger if you raise context).
- Start with **1× GPU**; raise VRAM if you hit OOM with long tool traces.
- Use a **PyTorch + CUDA** community template / image that can install vLLM 0.19.1+.

Exact RunPod SKUs change often — pick any CUDA pod that fits the VRAM note above.

## Operator steps (you run these)

### 1) Provision a pod yourself (not from ZERODAY CI)

In the RunPod console: create a GPU pod with SSH or Jupyter, public TCP or
**HTTP proxy** to port `8000` (or your chosen vLLM port). ZERODAY will not call
the RunPod API.

### 2) Accept HF license + login **on the pod**

Human must accept Cisco terms (never scrape/bypass):

→ [https://huggingface.co/fdtn-ai/antares-1b](https://huggingface.co/fdtn-ai/antares-1b)

On the pod:

```bash
export HUGGING_FACE_HUB_TOKEN=hf_...   # gated weights — pod only
huggingface-cli login --token "$HUGGING_FACE_HUB_TOKEN"
```

### 3) Install + serve vLLM (completions)

```bash
# On the RunPod GPU pod (example — adjust to your image):
pip install "vllm>=0.19.1"
vllm serve fdtn-ai/antares-1b --host 0.0.0.0 --port 8000
# Expect: http://0.0.0.0:8000/v1/completions
```

Useful flags (tune on your pod; not validated by ZERODAY as a partnership claim):

```bash
vllm serve fdtn-ai/antares-1b \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --max-model-len 32768
```

Smoke from your laptop (replace with your RunPod proxy URL):

```bash
curl -sS "$ZERODAY_ANTARES_BASE_URL/models"
# Completions (not chat):
curl -sS "$ZERODAY_ANTARES_BASE_URL/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"fdtn-ai/antares-1b","prompt":"ping","max_tokens":8}'
```

### 4) Wire ZERODAY (operator laptop — authorized repos only)

```bash
export ZERODAY_INFERENCE_PROVIDER=remote
export ZERODAY_ANTARES_BASE_URL=https://<runpod-proxy-host>/v1
# Optional if your proxy/gateway requires it:
export ZERODAY_ANTARES_API_KEY=
# Required ACK — may send prompts / repo-derived context off-machine:
export ZERODAY_REMOTE_INFERENCE_ACK=1

npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint "$ZERODAY_ANTARES_BASE_URL" --remote-inference

# Factory loop (same ACK):
npm run zeroday -- factory run --cwe CWE-89 --repo /path/to/authorized/repo \
  --no-fixture --live --endpoint "$ZERODAY_ANTARES_BASE_URL" --remote-inference
```

Print-only checklist (safe — no spend):

```bash
bash scripts/runpod-vllm-antares.sh --print-only
bash scripts/runpod-vllm-antares.sh --smoke-env
```

## Honesty

1. HF gated accept still required for weights.
2. Remote inference leaves the machine — requires `--remote-inference` /
   `ZERODAY_REMOTE_INFERENCE_ACK=1`.
3. Authorized repos only — [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md).
4. Localization ≠ exploitability · no PoC · no auto-merge.

## Related

- [`remote-antares-vllm.md`](./remote-antares-vllm.md) — host-agnostic contract
- [`defense-factory.md`](./defense-factory.md) — factory north star
- [`antares.md`](./antares.md) — local Antares wrap
