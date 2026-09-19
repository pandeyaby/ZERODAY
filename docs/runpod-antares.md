# RunPod + vLLM Antares (recommended remote CUDA path)

Operator scaffold for serving **`fdtn-ai/antares-1b`** on a **RunPod GPU pod**
via an OpenAI-compatible API that exposes **`POST /v1/completions`** (required by
`cisco-antares-cli` / ZERODAY live locate).

> **ZERODAY never creates or starts paid RunPod pods.** This doc +
> `npm run zeroday -- antares doctor` (wraps
> `scripts/runpod-vllm-antares.sh --print-only`) only print commands you run
> yourself on a pod you already provisioned.

## Why RunPod (not Mac MPS)

| Path | Status |
|------|--------|
| **RunPod CUDA + `vllm serve`** | **Recommended** remote path for schema-faithful live Antares |
| **Local CUDA box** | Also fine — same `/v1/completions` contract |
| **Mac MPS** | Unsupported for schema-faithful live locate |
| **CI / GitHub Action** | Fixture-only — never pulls weights, never calls RunPod |

Host-agnostic overview (any GPU host): [`remote-antares-vllm.md`](./remote-antares-vllm.md).

Design-partner **proven vs deferred** table (no invented AUROC / File-F1 /
latency SLAs): [`gpu-claims.md`](./gpu-claims.md).

## GPU tier: prefer Secure A40

`fdtn-ai/antares-1b` is a ~1B-parameter GraniteMoeHybrid model with a large
context window. Operator smoke / localize guidance:

| Tier | Guidance |
|------|----------|
| **Prefer: Secure Cloud A40** (~$0.49/hr, **CUDA ≥ 12.8**) | Proven path for live locate → SARIF on 24–48 GB class GPUs |
| Avoid for Antares: **Community RTX 4090** on Community CUDA 13 | Observed `CUDA unknown error` / vLLM **EngineCore** crash — do not treat as the product path |
| Fallback | Any **Secure** CUDA ≥ 12.8 pod with ≥16 GB VRAM (raise VRAM if long tool traces OOM) |

Exact RunPod SKUs and prices change — quote the console at provision time. Prefer
**Secure** over Community when CUDA stack freshness matters for GraniteMoeHybrid.

Start with **1× GPU**. Use a PyTorch + CUDA image that can install a **recent**
vLLM (see below).

## Operator steps (you run these)

### 1) Provision a Secure A40 pod yourself (not from ZERODAY CI)

In the RunPod console: create a **Secure Cloud A40** (or other Secure CUDA ≥ 12.8)
GPU pod with SSH or Jupyter, and **HTTP proxy** to port `8000` (or your chosen
vLLM port). ZERODAY will not call the RunPod API.

Proxy URL shape (copy from the pod’s Connect / HTTP services UI):

```text
https://<pod-id>-8000.proxy.runpod.net
```

ZERODAY / `cisco-antares-cli` want the OpenAI-compatible **`/v1`** base:

```text
https://<pod-id>-8000.proxy.runpod.net/v1
```

### 2) Accept HF license + login **on the pod**

Human must accept Cisco terms (never scrape/bypass):

→ [https://huggingface.co/fdtn-ai/antares-1b](https://huggingface.co/fdtn-ai/antares-1b)

On the pod:

```bash
export HUGGING_FACE_HUB_TOKEN=hf_...   # gated weights — pod only
huggingface-cli login --token "$HUGGING_FACE_HUB_TOKEN"
```

### 3) Install + serve vLLM (completions)

**GraniteMoeHybrid** (Antares) needs a **recent** vLLM that knows the model type.
Operator note: a `:latest` / current vLLM worked; **`v0.8.5` lacked the model
type** and failed to load. Prefer current vLLM on CUDA ≥ 12.8 (Antares CLI
documents vLLM 0.19.1+ for the completions contract; pin what your image
supports).

```bash
# On the RunPod GPU pod (example — adjust to your image):
pip install -U "vllm"   # recent enough for GraniteMoeHybrid; avoid stale 0.8.x
vllm serve fdtn-ai/antares-1b \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --max-model-len 32768
# Expect: http://0.0.0.0:8000/v1/completions
```

On **24–48 GB** GPUs (A40 class), keep **`--max-model-len 32768`** unless you
hit OOM — then lower context rather than switching to Community CUDA 13 SKUs.

Smoke from your laptop (replace with your RunPod proxy URL):

```bash
export ZERODAY_ANTARES_BASE_URL=https://<pod-id>-8000.proxy.runpod.net/v1
curl -sS "$ZERODAY_ANTARES_BASE_URL/models"
# Completions (not chat):
curl -sS "$ZERODAY_ANTARES_BASE_URL/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"fdtn-ai/antares-1b","prompt":"ping","max_tokens":8}'
```

### 4) Wire ZERODAY / cisco-antares-cli (operator laptop — authorized repos only)

```bash
export ZERODAY_INFERENCE_PROVIDER=remote
export ZERODAY_ANTARES_BASE_URL=https://<pod-id>-8000.proxy.runpod.net/v1
# Optional if your proxy/gateway requires it:
export ZERODAY_ANTARES_API_KEY=
# Required ACK — may send prompts / repo-derived context off-machine:
export ZERODAY_REMOTE_INFERENCE_ACK=1

# ZERODAY (defaults model to fdtn-ai/antares-1b with --endpoint / --live):
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint "$ZERODAY_ANTARES_BASE_URL" \
  --model fdtn-ai/antares-1b \
  --remote-inference \
  --output zeroday-reports/antares-live-proof

# Equivalent cisco-antares-cli shape (ZERODAY wraps this):
# antares … --endpoint "$ZERODAY_ANTARES_BASE_URL" --model fdtn-ai/antares-1b

# Factory loop (same ACK):
npm run zeroday -- factory run --cwe CWE-89 --repo /path/to/authorized/repo \
  --no-fixture --live --endpoint "$ZERODAY_ANTARES_BASE_URL" --remote-inference
```

Print-only checklist (safe — no spend):

```bash
bash scripts/runpod-vllm-antares.sh --print-only
bash scripts/runpod-vllm-antares.sh --smoke-env
```

### 5) One-shot discipline — locate → SARIF → stop/terminate

Paid pods burn money while **RUNNING**. Operator habit:

1. Serve vLLM, smoke `/v1/models` + `/v1/completions`
2. Run **one** live `locate` (or factory live) → confirm `report.sarif`
3. **Stop or terminate** the pod in the RunPod console — do **not** leave it RUNNING

ZERODAY never auto-stops RunPod resources. You own the bill.

## Honest live proof note (operator-recorded)

On a **Secure A40** pod (CUDA ≥ 12.8) with recent vLLM + `--max-model-len 32768`,
a live locate against the ZERODAY fixture demo-app returned **CWE-89** on
`src/users.js` (localization candidate only). Artifacts were written under a
directory matching:

```text
zeroday-reports/antares-live-proof/
  report.sarif
  report.json    # mode: "live"
  report.md
```

**Operator-run proof; not a checked-in cassette** — those SARIF files are not
shipped in this repo for CI replay. Lab notes landed in commit `3e6eaec`
(“Document Secure A40 live Antares proof path on RunPod”). Re-runs may differ.

This is **not** proof of exploitability, not a PoC, and not a partnership claim.
Always set `needs_human: true` and keep CI fixture-safe. Claim boundary:
[`gpu-claims.md`](./gpu-claims.md).

**Dated live GPU re-proof (2026-09-19 PT):** pod `d65ny3xqf7bwza`, Secure A40,
estimated **~$0.034** under ≤$0.50 ceiling, doctor/completions 200s, live
locate CWE-89 → `src/users.js` — measured facts only in
[`gpu-claims.md`](./gpu-claims.md#live-re-proof-2026-09-19-pt) (not a checked-in
cassette; not an AUROC / latency SLA).

## Honesty

1. HF gated accept still required for weights.
2. Remote inference leaves the machine — requires `--remote-inference` /
   `ZERODAY_REMOTE_INFERENCE_ACK=1`.
3. Authorized repos only — [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md).
4. Localization ≠ exploitability · no PoC · no exploit · no auto-merge.
5. Prefer Secure A40 / CUDA ≥ 12.8; Community RTX 4090 + CUDA 13 was a known
   EngineCore failure mode in operator notes — not the recommended path.
6. Stop/terminate after the one-shot locate — don’t leave pods RUNNING.

## Related

- [`gpu-claims.md`](./gpu-claims.md) — proven vs deferred (design partners)
- [`remote-antares-vllm.md`](./remote-antares-vllm.md) — host-agnostic contract
- [`defense-factory.md`](./defense-factory.md) — factory north star
- [`antares.md`](./antares.md) — local Antares wrap

## Desk: validate live in under a minute

Once your completions base URL is up (often `http://127.0.0.1:8000/v1` after
port-forward):

```bash
npm run play          # Live brain → Validate live (≤60s)
# or: npm run zeroday -- live validate
```

ZERODAY prefers last-good Antares / Antares-1B defaults — not a random chat
model left in `.zeroday/desk-endpoint.json`. Spend banner + remote-inference
ACK remain mandatory for paid / non-loopback paths.

