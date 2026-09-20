# Honest GPU-claim pack (design partners)

What ZERODAY **actually** proves on CUDA / vLLM / RunPod — and what it does
**not**. Defensive localization only. No PoC / exploit theater. No new GPU spend
from this doc (print-only doctors; you provision and terminate).

> **Two doors (same factory shape)**
>
> | Door | Label | Spend | CI |
> |------|-------|-------|-----|
> | **A — Keyless CPU / fixture** | Default. `npm run mvp` · `locate --fixture` · rules / SARIF ingest / recordings | **$0** | Required on `pull_request` — never pulls weights, never calls RunPod |
> | **B — Opt-in live GPU brain** | Human-hosted Antares-1B via OpenAI-compatible `/v1/completions` (CUDA / vLLM; RunPod Secure A40 recommended) | **You** pay the host; ZERODAY never auto-provisions | **Not** wired into CI |
>
> Calibration / paired-eval trust layer (optional, keyless):
> **[DIPTYCH](https://github.com/pandeyaby/DIPTYCH)** via emit-only adapters —
> [`paired-probes.md`](./paired-probes.md). DIPTYCH greens ≠ vuln proof.

---

## Proven vs deferred

| Claim | Status | Evidence / cite |
|-------|--------|-----------------|
| OpenAI-compatible **`POST /v1/completions`** on CUDA / vLLM for `fdtn-ai/antares-1b` | **Proven (when operator brings endpoint)** | Contract: [`remote-antares-vllm.md`](./remote-antares-vllm.md); recommended host: [`runpod-antares.md`](./runpod-antares.md); **live GPU** re-proof 2026-09-19 below |
| RunPod **Secure A40** (or Secure CUDA ≥ 12.8 equivalent), recent vLLM | **Proven path (operator-run)** | [`runpod-antares.md`](./runpod-antares.md) · print-only `npm run zeroday -- antares doctor` · commit `3e6eaec` (earlier notes) · **live GPU** re-proof pod `d65ny3xqf7bwza` (this page) |
| Desk **Validate live (≤60s)** / `live validate` + doctor against fixture CWE-89-style path | **Proven tooling (fail closed if unreachable)** | Desk CTA + `npm run zeroday -- live validate`; unit: `tests/locate/live-guard.test.ts`, `tests/desk/live-endpoint.test.ts` (**keyless** CI — no live GPU) |
| Live locate → SARIF on fixture demo-app (**CWE-89** / `src/users.js` candidate) | **Operator-run proof; not a checked-in cassette** | Earlier: [`runpod-antares.md`](./runpod-antares.md) § Honest live proof note · **live GPU** re-proof 2026-09-19 (below) · **fuller live locate** 2026-09-19/20 (below + [`a40-live-locate-20260920.json`](./reports/a40-live-locate-20260920.json)) — Mac report dirs not shipped as cassettes |
| Spend ceiling + **terminate-after** discipline | **Documented + measured (dated sessions)** | Prefer Secure A40 **$0.49/hr** at create (not an SLA). Re-proof ~**$0.034**; fuller locate estimate ~**$0.0245** — see dated sections. Recipe: [`runpod-antares.md`](./runpod-antares.md) §5 |
| Public File-F1 / marketing F1 for fixture · rules · ingest · recording · arbitrary local models | **Deferred / not claimed** | [`design-partner-trust.md`](./design-partner-trust.md) · [`local-brain.md`](./local-brain.md) |
| Mac MPS / Ollama tool-call reliability as production Antares | **Deferred / not claimed** | MPS unsupported for schema-faithful live locate ([`antares.md`](./antares.md)); Ollama 350M path has **no** File F1 claim ([`antares-350m-ollama.md`](./antares-350m-ollama.md)) |
| Org-scale latency SLAs | **Deferred / not claimed** | [`SUPPORT.md`](../SUPPORT.md) — no SLA; not Cisco support |
| AUROC as product-grade / vuln proof | **Deferred / not claimed** | No AUROC-as-product-grade; DIPTYCH greens ≠ exploitability ([`paired-probes.md`](./paired-probes.md)) |
| Upstream Antares model-card File F1 numbers | **Upstream cite only** (not a ZERODAY fixture/marketing claim) | Table in [`antares.md`](./antares.md) mirrors Cisco Antares model cards — not re-measured here |

Localization ≠ exploitability. Always `needs_human: true`. Never auto-merge.

---

## Door A — Keyless (default, CI-safe)

```bash
npm install
npm run mvp                    # fixture → SARIF; $0; no HF; no GPU
npm run zeroday -- doctor      # print-only local-brain checklist (Keyless K4)
```

CI gate (keyless only):
[`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml)
— locate → SARIF → `paired-probe` + `gate_axis_mutate`. **No GPU in this gate.**

---

## Door B — Opt-in live GPU brain (operator-hosted)

Print-only first (**$0** from ZERODAY — no pod create):

```bash
npm run zeroday -- antares doctor
# same: bash scripts/runpod-vllm-antares.sh --print-only
```

### Stranger probe vs measured A40 re-proof

`npm run stranger:verify` stays **citation-only** for Door B by default (no GPU).
Optional GPU-adjacent stranger win — probe a URL **you** already host:

```bash
npm run stranger:verify -- --live-url http://127.0.0.1:8000/v1
# --json → doorB.mode "operator_endpoint", doorB.probe { httpStatus, latencyMs },
#          provisioned: false, spendUsd: null
```

| Path | What it proves | Spend / provision |
|------|----------------|-------------------|
| **Default** `stranger:verify` | Door A keyless + Door B **citation** to § Live re-proof below | **$0** · no RunPod create · no HF pull |
| **`--live-url`** probe | `GET /v1/models` against *your* endpoint only | **$0 from ZERODAY** · `provisioned: false` · `spendUsd: null` · never creates pods |
| **Live re-proof (2026-09-19)** | Dated Secure A40 session (pod id, ~$0.034, models/completions 200, locate → `src/users.js`) | Operator-measured; **not** re-run by `--live-url` |

**Probe ≠ measured A40 re-proof.** Cite [Live re-proof (2026-09-19 PT)](#live-re-proof-2026-09-19-pt)
for historical Secure A40 facts. `--live-url` only validates *your* endpoint.
See [`stranger-verify.md`](./stranger-verify.md).

Then **you** (not CI) for a full live brain session:

1. Accept HF gated terms for [`fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b) (never scrape/bypass).
2. Provision Secure A40 (or Secure CUDA ≥ 12.8) yourself — recipe in [`runpod-antares.md`](./runpod-antares.md).
3. Serve `vllm serve fdtn-ai/antares-1b …` exposing **`POST /v1/completions`**.
4. Smoke doctor / Desk **Validate live** / optional `stranger:verify -- --live-url` against loopback or your proxy `/v1`.
5. One live `locate` (fixture CWE-89-style or authorized repo) → confirm SARIF.
6. **Stop or terminate** the pod — do not leave it RUNNING.

```bash
# Fail closed if unreachable (no silent fixture fallback):
npm run zeroday -- live validate --endpoint http://127.0.0.1:8000/v1
# or Desk: npm run play → Live brain → Validate live (≤60s)

export ZERODAY_REMOTE_INFERENCE_ACK=1   # required for non-loopback
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint https://<pod-id>-8000.proxy.runpod.net/v1 \
  --model fdtn-ai/antares-1b --remote-inference
# Then terminate the pod.
```

Host-agnostic contract: [`remote-antares-vllm.md`](./remote-antares-vllm.md).
Wrap overview: [`antares.md`](./antares.md).

### Spend (honest)

- Documented preference: Secure Cloud A40 ≈ **$0.49/hr** (CUDA ≥ 12.8) — from
  [`runpod-antares.md`](./runpod-antares.md) / `scripts/runpod-vllm-antares.sh`.
  Exact SKUs and prices change; quote the RunPod console at provision time.
- Discipline: one-shot locate → SARIF → terminate. No auto-spend, no silent
  pod create, no org-scale cost SLA invented here.
- Dated **live GPU** measurements: see [Live re-proof (2026-09-19 PT)](#live-re-proof-2026-09-19-pt)
  (smoke) and [Live locate (2026-09-19/20 PT)](#live-locate-2026-09-1920-pt)
  (fuller locate with real tool-calls) below.

---

## Live re-proof (2026-09-19 PT)

**Label: live GPU** (operator-hosted Secure A40). Distinct from **keyless**
fixture/CI (no weights, no RunPod — Door A / CI gate above).

Operator-measured session. Cite recipes:
[`runpod-antares.md`](./runpod-antares.md) ·
[`remote-antares-vllm.md`](./remote-antares-vllm.md).
**Not** a checked-in cassette. Invent nothing beyond the facts below.

| Field | Measured |
|-------|----------|
| Pod id | `d65ny3xqf7bwza` |
| Tier / GPU / DC | RunPod Secure Cloud · `NVIDIA A40` · `EU-SE-1` |
| Image | `vllm/vllm-openai:latest` (vLLM **0.29.0**) |
| Model | `fdtn-ai/antares-1b` · `--max-model-len 8192` |
| Rate at create | **$0.49/hr** |
| Timeline (UTC) | startedAt `2026-09-19T21:14:47Z` · Application startup complete ~`2026-09-19T21:16:55Z` · terminate (delete-pod 204) ~`2026-09-19T21:19:00Z` |
| Wall start→terminate | **~4.2 minutes** |
| Estimated spend | **~$0.034** (= 4.2/60 × $0.49). Hard ceiling was ≤ **$0.50** — under ceiling. Prefer billing API figure if/when available; do not invent a different number. |
| Doctor-style ping | `GET /v1/models` → **200** (~0.51s); model id listed `fdtn-ai/antares-1b` |
| Completions smoke | `POST /v1/completions` prompt=`ping` `max_tokens=8` → **200** (~0.63s) |
| Live locate smoke | Pass (defensive localization only) — details below |

### Live locate smoke (ZERODAY-mac-verify)

```bash
zeroday locate --cwe CWE-89 --repo fixtures/locate/demo-app --live \
  --endpoint https://d65ny3xqf7bwza-8000.proxy.runpod.net/v1 \
  --model fdtn-ai/antares-1b --remote-inference --tool-budget 15
```

| Field | Measured |
|-------|----------|
| Locate wall | ~**18s** |
| Ranked file | **`src/users.js`** rank 1 |
| findingCount | 1 |
| incompleteReason | `null` |
| Report dir (Mac) | `zeroday-reports/a40-smoke-20260919T211837Z/` (SARIF written; **not** checked into this repo) |
| Posture | localizationOnly · notExploitProof · noPoC · noAutoMerge |

### Honest non-claims (this re-proof)

- Localization ≠ exploitability · `needs_human` · no PoC · no auto-merge
- **Not** a public AUROC / File-F1 / marketing-F1 claim
- **Not** an org-scale latency SLA (the ~0.51s / ~0.63s / ~18s figures are
  **this session only** — not product SLAs)
- **Not** a CI cassette; **keyless** CI still never pulls weights or calls RunPod
- `--max-model-len 8192` on this run — does not retract the longer-context
  guidance in [`runpod-antares.md`](./runpod-antares.md); report what was used

---

## Live locate (2026-09-19/20 PT)

**Label: live GPU — fuller locate with real tool-calls** (operator-hosted
Secure A40). Distinct from the [2026-09-19 smoke](#live-re-proof-2026-09-19-pt)
above and from **keyless** fixture/CI (Door A). Machine-readable mirror:
[`docs/reports/a40-live-locate-20260920.json`](./reports/a40-live-locate-20260920.json)
(`zeroday.gpu_live_locate_evidence/v1`). Desk Prove doors: `GET /api/gpu-evidence` (historical read-only; does not start RunPod). Door D in `prove-doors` loads the same checked-in evidence (not live GPU). CLI: `npm run gpu-evidence` / `zeroday gpu-evidence` (historical evidence only; does not start RunPod). **Not** a checked-in cassette.
Invent nothing beyond the facts below.

| Field | Measured |
|-------|----------|
| Pod id | `1trf1rks3h40vs` |
| Tier / GPU / DC | RunPod Secure Cloud · `NVIDIA A40` · `EU-RO-1` |
| Image | `vllm/vllm-openai:latest` |
| Model | `fdtn-ai/antares-1b` · `--max-model-len 8192` |
| Rate at create | **$0.49/hr** |
| Timeline (UTC) | startedAt `2026-09-20T02:21:56Z` · `GET /v1/models` 200 ~`2026-09-20T02:24:18Z` · locate finished ~`2026-09-20T02:24:48Z` · terminate (delete-pod 204) ~`2026-09-20T02:24:56Z` |
| Wall start→terminate | **~3.0 minutes** |
| Estimated spend | **~$0.0245** (= 3.0/60 × $0.49). Billing API had no settled records yet — **estimate** only; do not invent a different number. |
| Completions smoke | `POST /v1/completions` → **200** |

### Live locate (ZERODAY-mac-verify — real tool-calls)

```bash
npm run locate -- --cwe CWE-89 --repo fixtures/locate/demo-app --live \
  --endpoint https://1trf1rks3h40vs-8000.proxy.runpod.net/v1 \
  --model fdtn-ai/antares-1b --remote-inference --tool-budget 15 \
  --output <dir> --json
```

| Field | Measured |
|-------|----------|
| Ranked file | **`src/users.js`** rank 1 |
| findingCount | 1 |
| incompleteReason | `null` |
| terminalCallsUsed | **1** / budget 15 |
| SARIF results | **1** · sha256 `b600e95f17720974ca9206abcc69aa30ec54cc2933a3259a02150b8b2cf9997e` |
| Posture | localizationOnly · notExploitProof · noPoC · noAutoMerge |

### Honest non-claims (this live locate)

- Localization ≠ exploitability · `needs_human` · no PoC · no auto-merge
- **Not** a public AUROC / File-F1 / marketing-F1 claim
- **Not** an org-scale latency or spend SLA (wall ~3.0 min and ~$0.0245 are
  **this session only**)
- **Not** a CI cassette; **keyless** CI still never pulls weights or calls RunPod
- Fuller locate with real tool-calls — does not replace or retract the prior
  A40 smoke section; cite both when comparing sessions

---

## Smoke / fail-closed (**keyless** CI — no live GPU)

| Check | What it does | Live GPU? |
|-------|--------------|-----------|
| `npm run zeroday -- doctor` | Print-only local completions checklist (Ollama/vLLM/LM Studio) | No |
| `npm run zeroday -- antares doctor` | Print-only Secure A40 / HF / terminate-after checklist | No |
| `npm run zeroday -- live validate --endpoint <url>` | Doctor ping; **fails closed** if endpoint unreachable; locate only with `--spend-ack` | Only if **you** already have an endpoint |
| `npm run stranger:verify -- --live-url <url>` | Opt-in `GET /v1/models` only; `doorB.probe` · `provisioned: false` · `spendUsd: null` · **not** A40 re-proof | Only if **you** already have an endpoint |
| Desk **Validate live (≤60s)** | Same habit in UI | Same |

Keyless unit coverage (mocked / unreachable — **not** a live GPU cassette):

- `tests/locate/live-guard.test.ts` — `locate(--endpoint)` fails closed when
  endpoint is down; never writes a fixture report pretending to be live
- `tests/desk/live-endpoint.test.ts` — validate returns empty-state when doctor
  cannot reach endpoint; spend ACK still required before locate
- `tests/doctor/local-brain.test.ts` — `doctor` / `antares doctor` print-only, $0
- `tests/doctor/a40-live-locate-evidence.test.ts` — parses checked-in
  [`a40-live-locate-20260920.json`](./reports/a40-live-locate-20260920.json)
  (schema + measured fields only; **not** a live GPU call)

CI never pulls `model.safetensors` and never calls RunPod.

---

## Related

| Doc | Role |
|-----|------|
| [`runpod-antares.md`](./runpod-antares.md) | Recommended remote CUDA path + operator proof note |
| [`remote-antares-vllm.md`](./remote-antares-vllm.md) | Host-agnostic `/v1/completions` contract |
| [`antares.md`](./antares.md) | Antares wrap + MPS / incomplete-run honesty |
| [`design-partner-trust.md`](./design-partner-trust.md) | Broader trust pack (public OSS; customer source private) |
| [`paired-probes.md`](./paired-probes.md) | DIPTYCH emit-only adapters (paired-eval trust layer) |
| [`local-brain.md`](./local-brain.md) | Keyless K4 — any local completions host ≠ Antares F1 |
| Root [`README.md`](../README.md) | Two-door skim path |

**Hard limits unchanged:** no PoC · localization ≠ exploitability · `needs_human`
always · no auto-merge · no AUROC-as-product-grade · DIPTYCH greens ≠ vuln proof.
