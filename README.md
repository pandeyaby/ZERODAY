# ZERODAY

**Localization & Evidence Defense Factory** — local-first defensive vulnerability
**localization** harness (Cisco Antares / ZERODAY mandate). Point it at a repo you
are authorized to assess; get ranked candidate files + **SARIF** + hashed evidence.
Localization ≠ exploitability. No PoCs. No auto-merge. Not an official Cisco partnership product.

Sister pieces (compose, don’t duplicate): [Antares](https://cisco-foundation-ai.github.io/antares/) · [cookbook Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md) · [Foundry](https://github.com/CiscoDevNet/foundry) · [CodeGuard](https://project-codeguard.org/)

North star vs OpenAI-style Defense Factory loops: we mirror **inventory → locate → classify → own → (optional draft) → defend → verify** with durable evidence — and we **refuse** exploits, PoCs, attack-path chaining, and auto-merge. Details: [`docs/defense-factory.md`](./docs/defense-factory.md).

---

## Proof

Public artifacts you can open without a GPU — **fixture-shaped** sample (same SARIF schema as live; `mode` differs). No customer paths. No tokens.

**(a) 30-min live one-liner** (product path — needs local completions + HF license accept):

```bash
npm run zeroday -- locate --repo <authorized-repo> --cwe CWE-89 --endpoint http://127.0.0.1:8000/v1
# model defaults to fdtn-ai/antares-1b · helper: bash scripts/quickstart-live.sh <repo>
```

**(b) Sample SARIF snippet** ([full file](./examples/sample-live-sarif/report.sarif) · [excerpt](./examples/sample-live-sarif/report.excerpt.sarif.json)):

```json
{
  "version": "2.1.0",
  "runs": [{
    "tool": { "driver": { "name": "ZERODAY-Antares" } },
    "results": [{
      "ruleId": "CWE-89",
      "level": "note",
      "message": {
        "text": "SQL query built via string concatenation — rank 1. … (Localization only; not exploitability proof.)"
      },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "src/users.js", "uriBaseId": "%SRCROOT%" },
          "region": { "startLine": 8, "endLine": 10 }
        }
      }],
      "properties": { "submission_rank": 1, "mode": "fixture" }
    }]
  }]
}
```

Regenerate the checked-in sample (CI-safe): `bash scripts/demo-proof.sh`

**(c) Screenshots**

![ZERODAY locate CLI — ranked files + SARIF path](./docs/images/zeroday-locate-cli.png)

![SARIF findings list — CWE-89 note severity](./docs/images/zeroday-sarif-findings.png)

![30-min live path one-liner](./docs/images/zeroday-live-path.png)

---

## 30-minute live path: Antares → SARIF

This is the **product path** — real local inference, not a fixture. Budget: install → accept HF terms → serve → one command → `report.sarif`.

### 1) Install (Node + Antares CLI)

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
npm install
# Official Antares CLI (PyPI) — do not reimplement
uv tool install cisco-antares-cli
export PATH="$(uv tool dir --bin):$PATH"
antares --version
```

### 2) Accept Hugging Face license (human step)

Open the model card and accept Cisco’s terms — **never scrape or bypass**:

→ [https://huggingface.co/fdtn-ai/antares-1b](https://huggingface.co/fdtn-ai/antares-1b)

ZERODAY never downloads `model.safetensors` for you (and CI never pulls weights).

### 3) Serve locally (completions only)

Antares CLI expects an OpenAI-compatible **`POST /v1/completions`** endpoint (chat completions are rejected). The Antares CLI documents vLLM 0.19.1+ for this; ZERODAY does **not** claim independent “validated with vLLM \<version\>” proof.

```bash
# CUDA / Linux GPU or RunPod (recommended for schema-faithful live Antares)
vllm serve fdtn-ai/antares-1b
# → http://127.0.0.1:8000/v1/completions
# Recommended remote path (opt-in, requires --remote-inference): docs/runpod-antares.md

# Mac Apple Silicon (MPS) — UNSUPPORTED for schema-faithful live locate.
#   (a) float16 → NaN logits → `!` forever (bangs). float32 stops bangs.
#   (b) even float32 often emits malformed tool_call JSON → 0 executed tools.
# Prefer RunPod/CUDA vLLM. Helper kept for bang-safe local smoke only:
python scripts/completions_server.py --model fdtn-ai/antares-1b --port 8000
```

**Model ID:** Antares requires an explicit served model id. With `--endpoint` / `--live`, ZERODAY defaults to `fdtn-ai/antares-1b` (override with `--model` or `ANTARES_MODEL`). You should not see “Inference requires an explicit model ID” on the happy path.

### 4) One command → SARIF

```bash
npm run zeroday -- locate \
  --repo /path/to/your/authorized/repo \
  --cwe CWE-89 \
  --endpoint http://127.0.0.1:8000/v1
# model defaults to fdtn-ai/antares-1b; optional: --model fdtn-ai/antares-1b
```

Or the helper (health-checks the endpoint, passes `--model`, **refuses** silent fixture/mock fallback, prints SARIF path):

```bash
bash scripts/quickstart-live.sh /path/to/your/authorized/repo CWE-89
```

Artifacts land under `zeroday-reports/<run>/` (or the `--output` dir):

| File | What |
|------|------|
| `report.sarif` | SARIF 2.1.0 for Code Scanning / Foundry Detector-lane candidates |
| `report.json` | Ranked files + evidence (`mode: "live"`) |
| `report.md` | CISO one-pager |
| `comment.md` | Reviewable PR comment body |

**Invariant:** if `--endpoint` / `--live` is set and the endpoint is down, locate **exits non-zero**. It will not quietly write a fixture recording and call it done.

**Incomplete runs:** if Antares ends without `submit_vulnerable_files` / `submit_no_vulnerability_found`, `report.md` surfaces that clearly — ZERODAY does **not** invent findings. Live defaults: `--tool-budget 30`, best-effort one re-query with raised budget, `--fail-on-incomplete` (exit 2). Tips: check server health; prefer **vLLM/CUDA** for live Antares (MPS float32 is bang-safe but tool-schema unreliable); `--tool-budget 45`.

### Live incomplete runs (troubleshooting)

When a live Mac/GPU run finishes with `incompleteReason` like *“Model ended without an explicit final submission”* and **0 ranked files**:

| Class | Meaning |
|-------|---------|
| `no_submit` | Model stopped without `submit_*` tools |
| `budget_exhausted` | Tool budget used up before submit |
| `timeout` | CLI / remote deadline hit |
| `endpoint_error` | Completions endpoint failed |
| `parse_failure` | No usable `report.json` |

**Next actions (printed in CLI + report.md):**

1. `GET /v1/models` healthy; smoke `POST /v1/completions` (not chat)
2. Prefer **vLLM/CUDA** for schema-faithful tools. On Mac MPS: float32+greedy (`scripts/completions_server.py`) stops float16 `!` bangs, but tool_call JSON may still be malformed (`run`/`termina` vs `name`/`arguments`) — ZERODAY does not rewrite it
3. Raise budget: `--tool-budget 45` or `ANTARES_TOOL_BUDGET=45`
4. Optional: `--no-live-recovery` to skip the best-effort re-query; `--no-fail-on-incomplete` to exit 0 while still writing the incomplete report

ZERODAY never invents ranked files to “fill” an incomplete run.

### Sample SARIF excerpt (shape)

Live runs use the same SARIF schema; `properties.zeroday.mode` / report JSON `mode` will be `"live"`. Fixture CI samples use `"fixture"` — label them as such.

```json
{
  "version": "2.1.0",
  "runs": [{
    "tool": { "driver": { "name": "ZERODAY-Antares" } },
    "results": [{
      "ruleId": "CWE-89",
      "level": "note",
      "message": { "text": "SQL query built via string concatenation — rank 1. … (Localization only; not exploitability proof.)" },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "src/users.js", "uriBaseId": "%SRCROOT%" },
          "region": { "startLine": 8, "endLine": 10 }
        }
      }],
      "properties": { "submission_rank": 1 }
    }]
  }]
}
```

Ranked files (from `report.json`):

```text
1. src/users.js  [CWE-89]  SQL query built via string concatenation
2. src/app.js    [CWE-89]  Request parameter passed to unsafe finder
```

*(Above ranked-file sample is from the recorded CI fixture demo-app — same shape as live; check `mode` in `report.json`.)*

---

## Factory loop (CI-safe)

Continuous Localization & Evidence Defense Factory — fixture path needs no GPU:

```bash
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend \
  --classify-scenario software_defect \
  --output zeroday-reports/factory-demo
npm run zeroday -- verify --from zeroday-reports/factory-demo
```

Stages: **inventory** → **locate** → **classify** → **own** (CODEOWNERS) → optional **`--i-asked-for-a-fix`** draft → **defend** (existing tests only) → **verify**.

Docs: [`docs/defense-factory.md`](./docs/defense-factory.md) · sample desks: [`examples/factory/`](./examples/factory/)

---

## Remote CUDA / RunPod (opt-in)

Mac MPS is unsupported for schema-faithful live Antares. **Recommended remote path:** serve `fdtn-ai/antares-1b` on a **RunPod** CUDA pod via vLLM (`POST /v1/completions`), then:

```bash
export ZERODAY_INFERENCE_PROVIDER=remote
export ZERODAY_ANTARES_BASE_URL=https://<runpod-proxy-host>/v1
export ZERODAY_REMOTE_INFERENCE_ACK=1   # required — may send prompts/repo context
npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \
  --endpoint "$ZERODAY_ANTARES_BASE_URL" --remote-inference
```

Scaffold only (no paid pod creates from this repo): [`docs/runpod-antares.md`](./docs/runpod-antares.md) · `bash scripts/runpod-vllm-antares.sh --print-only`  
Host-agnostic contract: [`docs/remote-antares-vllm.md`](./docs/remote-antares-vllm.md)

---

## CI / no-GPU smoke (60 seconds) — not the product path

Use this for laptops without a GPU, and for GitHub Actions. **Label clearly: fixture / recorded — not live Antares.**

```bash
npm install
npm run zeroday -- locate --cwe CWE-89 --fixture --output zeroday-reports/ci-smoke
ls zeroday-reports/ci-smoke/report.sarif
```

Keyless agent-operator (also offline-capable, no Antares weights):

```bash
npm run zeroday -- operate --cwe CWE-89 --fixture --output zeroday-reports/demo-operate
npm run zeroday -- verify --from zeroday-reports/demo-operate
```

---

## What works offline / keyless vs what needs Antares weights

| Path | Needs | Writes SARIF? |
|------|-------|---------------|
| **`operate`** (coding agent + brief/schema) | Nothing cloud — your agent explores a read-only snapshot | Yes (after submission / `--fixture`) |
| **`locate --fixture`** | No GPU / no HF token | Yes — **CI / no-GPU only** |
| **`locate --repo … --endpoint …`** (live) | HF license accept + local serve + `cisco-antares-cli` | Yes — **product path** |
| **`sweep --endpoint …`** | Same local endpoint | Multi-CWE via official `antares sweep` |

---

## GitHub Action (PR comment + SARIF)

On every `pull_request`, the composite action:

1. Runs **fixture** locate (CI / no-GPU — never pulls weights)
2. Uploads `report.sarif` to Code Scanning (best-effort if Code Scanning isn’t enabled)
3. **Posts a reviewable PR comment** with ranked candidate files + evidence

Comment posting is **fail-closed** on `pull_request`: if the comment cannot be created/updated, the job fails. Localization candidates are for human review — not exploit proof, never auto-merge.

Workflow: [`.github/workflows/zeroday-locate.yml`](./.github/workflows/zeroday-locate.yml)

---

## Honesty

- **Local-first / keyless default** — customer source stays on the operator machine unless `--remote-inference` / `ZERODAY_REMOTE_INFERENCE_ACK` is set
- **No partnership claims** — not an official Cisco / Splunk / Palo / Fortinet / CrowdStrike / AWS / RunPod product
- **Localization ≠ exploitability** — ranked files are candidates; `needs_human` always
- **No PoCs / exploits / payloads / attack procedures** (even localhost/lab)
- **Never auto-merge** — patch drafts only after `--i-asked-for-a-fix`
- **No silent fixture fallback** on the live path
- **CI stays fixture-safe** — GitHub Action never needs RunPod or live Antares

Acceptable use: [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md)

---

## Vendor packs (local files only)

| Desk | File |
|------|------|
| Cisco / Code Scanning | `report.sarif` |
| Splunk | `splunk-cim-vulnerabilities.json` |
| Palo Alto | `xsoar-incidents.json` |
| Fortinet | `fortisiem-custom.json` |
| CrowdStrike | `crowdstrike-hec-events.ndjson` |
| AWS Security | `asff-findings.json` |

Details: [`docs/vendor-packs/README.md`](./docs/vendor-packs/README.md) · [`docs/antares.md`](./docs/antares.md) · [`docs/agent-operator.md`](./docs/agent-operator.md)

---

## CLI cheat sheet

```bash
# Factory loop (CI-safe)
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend

# Live (product) — CUDA/RunPod preferred; Mac MPS unsupported for schema-faithful tools
npm run zeroday -- locate --cwe CWE-89 --repo ./app --endpoint http://127.0.0.1:8000/v1
bash scripts/quickstart-live.sh ./app CWE-89
bash scripts/runpod-vllm-antares.sh --print-only

# CI / no-GPU
npm run zeroday -- locate --cwe CWE-89 --fixture
npm run zeroday -- operate --cwe CWE-89 --fixture && npm run zeroday -- verify --from <run-dir>

# Other
npm run zeroday -- classify --scenario possible_breach
npm run zeroday -- demo
npm test
```

---

## License & credits

Authorized / defensive use only. No warranty.

- **Antares** — [site](https://cisco-foundation-ai.github.io/antares/) · [Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md) · [HF `fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b) · [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/)
- Foundry Security Spec · Project CodeGuard — compose, don’t replace
