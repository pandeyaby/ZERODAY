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
| OpenAI-compatible **`POST /v1/completions`** on CUDA / vLLM for `fdtn-ai/antares-1b` | **Proven (when operator brings endpoint)** | Contract: [`remote-antares-vllm.md`](./remote-antares-vllm.md); recommended host: [`runpod-antares.md`](./runpod-antares.md) |
| RunPod **Secure A40** (or Secure CUDA ≥ 12.8 equivalent), recent vLLM, `--max-model-len 32768` | **Proven path (operator-run)** | [`runpod-antares.md`](./runpod-antares.md) · print-only `npm run zeroday -- antares doctor` · commit `3e6eaec` (Secure A40 live-proof notes on `main`) |
| Desk **Validate live (≤60s)** / `live validate` + doctor against fixture CWE-89-style path | **Proven tooling (fail closed if unreachable)** | Desk CTA + `npm run zeroday -- live validate`; unit: `tests/locate/live-guard.test.ts`, `tests/desk/live-endpoint.test.ts` |
| Live locate → SARIF on fixture demo-app (**CWE-89** / `src/users.js` candidate) | **Operator-run proof; not a checked-in cassette** | Narrative in [`runpod-antares.md`](./runpod-antares.md) § Honest live proof note — artifacts were under `zeroday-reports/antares-live-proof/` on the operator machine; **not** shipped as a CI cassette |
| Spend ceiling + **terminate-after** discipline | **Documented operator habit** | Prefer Secure A40 ~**$0.49/hr** (console price at provision time — do not treat as a fixed SLA). One-shot locate → SARIF → **stop/terminate**; ZERODAY never auto-stops pods. See [`runpod-antares.md`](./runpod-antares.md) §5 |
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

Then **you** (not CI):

1. Accept HF gated terms for [`fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b) (never scrape/bypass).
2. Provision Secure A40 (or Secure CUDA ≥ 12.8) yourself — recipe in [`runpod-antares.md`](./runpod-antares.md).
3. Serve `vllm serve fdtn-ai/antares-1b …` exposing **`POST /v1/completions`**.
4. Smoke doctor / Desk **Validate live** against loopback or your proxy `/v1`.
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
- This PR / doc pack does **not** create pods or burn GPU credit.

---

## Smoke / fail-closed (no live GPU in CI)

| Check | What it does | Live GPU? |
|-------|--------------|-----------|
| `npm run zeroday -- doctor` | Print-only local completions checklist (Ollama/vLLM/LM Studio) | No |
| `npm run zeroday -- antares doctor` | Print-only Secure A40 / HF / terminate-after checklist | No |
| `npm run zeroday -- live validate --endpoint <url>` | Doctor ping; **fails closed** if endpoint unreachable; locate only with `--spend-ack` | Only if **you** already have an endpoint |
| Desk **Validate live (≤60s)** | Same habit in UI | Same |

Keyless unit coverage (mocked / unreachable — **not** a live GPU cassette):

- `tests/locate/live-guard.test.ts` — `locate(--endpoint)` fails closed when
  endpoint is down; never writes a fixture report pretending to be live
- `tests/desk/live-endpoint.test.ts` — validate returns empty-state when doctor
  cannot reach endpoint; spend ACK still required before locate
- `tests/doctor/local-brain.test.ts` — `doctor` / `antares doctor` print-only, $0

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
