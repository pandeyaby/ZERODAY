# ZERODAY

![ZERODAY workflow — default keyless mvp path (code → localize → SARIF → human gate) plus optional Antares live brain](./docs/images/zeroday-readme-hero.png)

Local-first defensive vulnerability **localization** around
[Antares](https://cisco-foundation-ai.github.io/antares/) — keyless fixture /
operate → ranked files + **SARIF** + hashed evidence. **Not a Cisco product.**

> **Hard limits**
>
> - No PoCs, exploits, payloads, or attack procedures — ever (including lab / localhost)
> - Localization ≠ proof of exploitability · `needs_human` always · never auto-merge
> - Default path: **`npm run mvp`** (fixture → SARIF; CI / no-GPU; no HF token)
> - Live Antares is **opt-in** and **costs $** — human accepts HF gated terms + CUDA/vLLM (or documented RunPod Secure A40); ZERODAY never auto-provisions pods
> - Acceptable use / scope: [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md) · disclosure: [`SECURITY.md`](./SECURITY.md)

---

## MVP path (keyless, &lt;10 min)

**Stranger path:** clone → fixture (or playground) → SARIF. Offline. No GPU. No HF token. No spend.

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
npm install
npm run mvp
# optional same fixtures in UI:  npm run play  →  http://localhost:3333/play
```

Expect **PASS**, then open the printed SARIF paths under `zeroday-reports/mvp/`.

Equivalent: `npm run zeroday -- mvp`

---

## Live Antares (opt-in, costs $)

Not the default. Requires a human to accept HF gated terms for
`fdtn-ai/antares-1b`, serve completions (CUDA / vLLM), and **terminate the pod
after use**. ZERODAY never scrapes HF terms, never downloads `model.safetensors`
in CI, and **never creates paid RunPod pods**.

```bash
# Print-only checklist (no spend) — Secure A40 recipe + HF gate + terminate-after-use
npm run zeroday -- antares doctor
# same: bash scripts/runpod-vllm-antares.sh --print-only

# After YOU provision a Secure A40 and serve vLLM (see docs/runpod-antares.md):
export ZERODAY_REMOTE_INFERENCE_ACK=1   # required — may send prompts/repo context
npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \
  --endpoint https://<pod-id>-8000.proxy.runpod.net/v1 \
  --model fdtn-ai/antares-1b --remote-inference
# Then stop/terminate the pod — do not leave it RUNNING.
```

Full one-pager: [`docs/runpod-antares.md`](./docs/runpod-antares.md) · host-agnostic: [`docs/remote-antares-vllm.md`](./docs/remote-antares-vllm.md)

---

## Proof (fixture-shaped sample)

Open without a GPU — same SARIF schema as live; `mode` differs (`fixture` vs `live`).

```bash
npm run mvp                                  # regenerates under zeroday-reports/mvp/
bash scripts/demo-proof.sh                   # refreshes examples/sample-live-sarif/
```

**(a) Sample SARIF** ([full](./examples/sample-live-sarif/report.sarif) · [excerpt](./examples/sample-live-sarif/report.excerpt.sarif.json)):

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

**(b) Screenshots**

![ZERODAY locate CLI — ranked files + SARIF path](./docs/images/zeroday-locate-cli.png)

![SARIF findings list — CWE-89 note severity](./docs/images/zeroday-sarif-findings.png)

![30-min live path one-liner](./docs/images/zeroday-live-path.png)

---

## Default path details (same door as MVP)

`npm run mvp` runs fixture **locate** + keyless **operate→verify**. Manual equivalents:

```bash
npm run zeroday -- locate --cwe CWE-89 --fixture --output zeroday-reports/ci-smoke
npm run zeroday -- operate --cwe CWE-89 --fixture --output zeroday-reports/demo-operate
npm run zeroday -- verify --from zeroday-reports/demo-operate
```

Factory loop (CI-safe, optional):

```bash
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend \
  --output zeroday-reports/factory-demo
npm run zeroday -- verify --from zeroday-reports/factory-demo
```

Multi-repo / config inventory (Desk B — fixture/static; feeds locate; still keyless):

```bash
npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json \
  --output zeroday-reports/desk-b-inventory
```

Stranger summary (fixture desk):

- Scans local fixture stand-ins + this repo for Actions / Docker / manifests / agent-skill surfaces
- Records CI secret *patterns* (names only), `.env.example` honesty, dependency/agent harness hints
- Emits `inventory.json` + `inventory.md` + redacted SARIF + case note (`docs/reports/desk-b-*`)
- EternalEcho parked/skipped; SniperCore optional if path present
- **No** live Antares/RunPod · **no** PoC · `npm run mvp` stays the door

Docs: [`docs/defense-factory.md`](./docs/defense-factory.md) · [`docs/reports/`](./docs/reports/) · [`fixtures/inventory/desk-b/`](./fixtures/inventory/desk-b/)

Security packet (Desk A — offline share for a security team; generate only, **no auto-post**):

```bash
npm run zeroday -- packet --from docs/reports
```

- Consumes Desk B inventory JSON + SARIF (does not re-inventory)
- Emits `summary.md`, classified findings, SARIF copy, module/PR/ticket placeholders
- Labels: `agent-misfire` / `config` / `dependency` / `unknown` — evidence-backed only (no guessing)
- Sample: [`docs/reports/desk-a-packet/`](./docs/reports/desk-a-packet/)

Agent/package harden (Desk C — recommend-only; **no auto-apply / auto-PR / auto-merge**):

```bash
npm run zeroday -- harden --from docs/reports
# optional CodeGuard-aligned draft notes (human-gated):
npm run zeroday -- harden --from docs/reports --draft
```

- Consumes Desk B inventory + Desk A packet outputs (does not re-scan private clones)
- Emits `harden.md` + `harden.json`; `--draft` adds human-gated notes under `drafts/`
- Evidence-backed: agent harness · package scripts/deps · secrets hygiene · config surfaces
- Sample: [`docs/reports/desk-c-harden/`](./docs/reports/desk-c-harden/)
- **`npm run mvp` / `inventory` / `packet` unchanged**

Crash classify + evidence (Desk E — fixture/offline; **human review · no auto-remediate**):

```bash
npm run zeroday -- classify --from fixtures/classify/software_defect
# or:
npm run zeroday -- classify --fixture
```

- Reuses fixture classify APIs (labels: `possible_breach` | `infra_failure` | `software_defect` | `agent_misfire` | `needs_human`)
- Ambiguous → **`needs_human`**; never invent breach from weak signals
- Emits `classify.md` + `classify.json` evidence pack (plus `ciso.*`); secrets redacted
- **Classification ≠ exploitability**
- Sample: [`docs/reports/desk-e-classify/`](./docs/reports/desk-e-classify/)
- **`npm run mvp` / `inventory` / `packet` / `harden` unchanged**

Defensive plugins/skills craft (Desk D — LAST; generate-only; **no auto-install / marketplace**):

```bash
npm run zeroday -- craft --from docs/reports
# aliases:
npm run zeroday -- skill --fixture
npm run zeroday -- plugin --fixture
```

- Consumes Desk B→A→C→E reports as pattern input (does not re-scan)
- Emits Cursor/Grok-style `SKILL.md` + plugin stub encoding inventory→locate→packet→harden→classify
- **Refuses** exploits, PoCs, and offensive skill patterns
- Sample: [`docs/reports/desk-d-craft/`](./docs/reports/desk-d-craft/)
- **`npm run mvp` / `inventory` / `packet` / `harden` / `classify` unchanged**

---

## Opt-in live path details

Real local or remote CUDA inference — **not** the default demo.

### 1) Install (Node + Antares CLI)

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
npm install
uv tool install cisco-antares-cli
export PATH="$(uv tool dir --bin):$PATH"
antares --version
```

### 2) Accept Hugging Face license (human step)

→ [https://huggingface.co/fdtn-ai/antares-1b](https://huggingface.co/fdtn-ai/antares-1b)

Never scrape or bypass. ZERODAY never downloads `model.safetensors` for you.

### 3) Serve completions (CUDA / RunPod preferred)

Antares CLI expects **`POST /v1/completions`** (chat rejected). Prefer vLLM on CUDA.

```bash
# Recommended remote: Secure A40 — docs/runpod-antares.md
# On the pod:
vllm serve fdtn-ai/antares-1b --host 0.0.0.0 --port 8000 --max-model-len 32768

# Mac Apple Silicon (MPS) — UNSUPPORTED for schema-faithful live locate.
# float16 → NaN bangs; float32 stops bangs but tool_call JSON is often malformed.
# Helper for bang-safe local smoke only:
python scripts/completions_server.py --model fdtn-ai/antares-1b --port 8000
```

Model defaults to `fdtn-ai/antares-1b` with `--endpoint` / `--live` (override with `--model` / `ANTARES_MODEL`).

### 4) Locate → SARIF

```bash
npm run zeroday -- locate \
  --repo /path/to/your/authorized/repo \
  --cwe CWE-89 \
  --endpoint http://127.0.0.1:8000/v1

bash scripts/quickstart-live.sh /path/to/your/authorized/repo CWE-89
```

| File | What |
|------|------|
| `report.sarif` | SARIF 2.1.0 |
| `report.json` | Ranked files (`mode: "live"`) |
| `report.md` | CISO one-pager |
| `comment.md` | PR comment body |

**Invariant:** live + down endpoint → non-zero exit (no silent fixture fallback).

**Incomplete runs:** no invented findings. Defaults: `--tool-budget 30`, best-effort re-query, `--fail-on-incomplete` (exit 2). Prefer **vLLM/CUDA**; MPS float32 is bang-safe but tool-schema unreliable — ZERODAY does not rewrite malformed tool_call JSON.

| Class | Meaning |
|-------|---------|
| `no_submit` | Model stopped without `submit_*` |
| `budget_exhausted` | Tool budget used up |
| `timeout` | Deadline hit |
| `endpoint_error` | Completions failed |
| `parse_failure` | No usable `report.json` |

Tips: `GET /v1/models` + smoke `POST /v1/completions`; `--tool-budget 45`; `--no-live-recovery` / `--no-fail-on-incomplete` as needed.

Sister pieces: [Antares](https://cisco-foundation-ai.github.io/antares/) · [cookbook Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md) · [Foundry](https://github.com/CiscoDevNet/foundry) · [CodeGuard](https://project-codeguard.org/)

---

## What works offline vs live

| Path | Needs | Writes SARIF? |
|------|-------|---------------|
| **`npm run mvp`** / **`locate --fixture`** | No GPU / no HF | Yes — **default** |
| **`operate`** (keyless) | Coding agent + snapshot | Yes (after submission / `--fixture`) |
| **`locate --endpoint …`** (live) | HF accept + CUDA/vLLM or RunPod + ACK | Yes — **opt-in, costs $** |
| **`antares doctor`** | Nothing | No — print-only checklist |

---

## GitHub Action

On `pull_request`: fixture locate → upload SARIF → reviewable PR comment (fail-closed). Never pulls weights. Never auto-merge.

Workflow: [`.github/workflows/zeroday-locate.yml`](./.github/workflows/zeroday-locate.yml)

---

## Honesty

- **Keyless default** — `npm run mvp`; customer source stays local unless `--remote-inference` / `ZERODAY_REMOTE_INFERENCE_ACK`
- **No partnership claims** — not an official Cisco / Splunk / Palo / Fortinet / CrowdStrike / AWS / RunPod product
- **Localization ≠ exploitability** — candidates only; `needs_human` always
- **No PoCs / exploits / payloads / attack procedures**
- **Never auto-merge** — drafts only after `--i-asked-for-a-fix`
- **No silent fixture fallback** on the live path
- **No silent spend** — print-only doctor / RunPod scaffold; you provision and terminate

[`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md) · [`SECURITY.md`](./SECURITY.md)

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

Inventory desk (multi-repo + config surfaces → locate hints): `npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json` · security packet (Desk A, no auto-post): `npm run zeroday -- packet --from docs/reports` · harden (Desk C, recommend-only): `npm run zeroday -- harden --from docs/reports` · classify (Desk E, classification ≠ exploitability): `npm run zeroday -- classify --from fixtures/classify/software_defect` · craft (Desk D, generate-only skills/plugins): `npm run zeroday -- craft --from docs/reports` · reports: [`docs/reports/`](./docs/reports/) · [`docs/defense-factory.md`](./docs/defense-factory.md)

[`docs/vendor-packs/README.md`](./docs/vendor-packs/README.md) · [`docs/antares.md`](./docs/antares.md) · [`docs/agent-operator.md`](./docs/agent-operator.md)

---

## CLI cheat sheet

```bash
# MVP door (keyless)
npm run mvp

# Inventory desk (fixture Desk B — multi-repo + config surfaces → locate hints)
npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json

# Security packet (Desk A — offline share; no auto-post)
npm run zeroday -- packet --from docs/reports

# Harden (Desk C — recommend-only; optional --draft notes, human-gated)
npm run zeroday -- harden --from docs/reports

# Crash classify (Desk E — classification ≠ exploitability; human review)
npm run zeroday -- classify --from fixtures/classify/software_defect
npm run zeroday -- classify --fixture

# Defensive craft (Desk D — generate-only SKILL.md + plugin stub; no auto-install)
npm run zeroday -- craft --from docs/reports

# Opt-in live (costs $) — print-only first
npm run zeroday -- antares doctor
bash scripts/quickstart-live.sh ./app CWE-89

# Other
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend
npm run zeroday -- classify --scenario possible_breach
npm run zeroday -- demo
npm run operator   # local Operator UI on :3333
npm test
```

---

## License & credits

**Apache-2.0** — see [`LICENSE`](./LICENSE) (`SPDX-License-Identifier: Apache-2.0`).
Authorized / defensive use only ([`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md)). No warranty.

- **Antares** — [site](https://cisco-foundation-ai.github.io/antares/) · [Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md) · [HF `fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b) · [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/)
- Foundry Security Spec · Project CodeGuard — compose, don’t replace
