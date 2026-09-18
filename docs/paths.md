# Paths — every locate door and Desk chain

This page holds the deep door map that used to live in the root README.
Strangers should start at the [root README](../README.md) (`npm run mvp`), then
return here when they need rules, SARIF ingest, org cassettes, live install
details, or the Desk command chain.

**Hard limits stay:** no PoCs · localization ≠ exploitability · `needs_human`
always · never auto-merge · **not a Cisco product**.

---

## Four discovery doors (+ org recording)

All doors share one shape: CWE / CVE / GHSA → explore → ranked files + hashed
evidence → SARIF / `report.md`. Only the localization brain swaps.

1. **Fixture smoke** (`npm run mvp` / `locate --fixture`): deterministic recorded
   brain for CI and strangers — no GPU, no HF token, no spend. Output
   `mode: "fixture"`. Honest: not live Antares F1; validates the factory shape.
   **mvp stays fixture smoke** — it does not switch to rules, ingest, or org
   recordings.

2. **Rules on a real repo** (`locate --rules`, $0): thin in-repo CWE heuristics
   (CWE-89 required; CWE-79 / CWE-22 optional) on your authorized `--repo`.
   Explicit flag only — refuses `--fixture`, `--from-sarif`, `--recording`, and
   `--live`/`--endpoint`. Output `mode: "rules"`. Honest: **rules ≠ Antares
   File F1** and ≠ exploitability. No Semgrep binary, no Docker, no HF.

3. **SARIF ingest** (`locate --from-sarif <path.sarif>`, $0): bring an existing
   CodeQL / Semgrep / generic SARIF 2.1 file from disk into the same
   LocalizationResult → evidence → SARIF writers. Optional `--cwe` filters
   mapped findings. Output `mode: "ingest"`. Honest: **third-party findings —
   not Antares/rules discovery**. **File path only** — no GitHub alerts API /
   network fetch.

4. **Live completions** (opt-in): same pipeline via `--endpoint` at any
   OpenAI-compatible **`POST /v1/completions`** host. **Recommended** brain:
   Antares-1B (HF gated accept + CUDA/vLLM / RunPod Secure A40). **Also
   allowed:** local Ollama / vLLM / LM Studio without Antares weights — still
   `mode: "live"`, but **arbitrary local models ≠ Antares File F1**. Never
   auto-provisions pods; never scrapes HF; never silent fallback to
   fixture/rules/ingest if the endpoint is down. Completions-only (chat
   refused). Non-loopback still needs `--remote-inference`.

**Org cassette replay** (`record --redact` → `locate --recording`, Keyless K3):
after a real locate (rules / ingest / live / fixture), save a **redacted** org
recording for CI regression — the team's cassette, **not** mvp product fixtures
under `fixtures/locate/recordings/`. `--redact` is default ON and fail-closed.
Replay sets honest `mode: "recording"`. Never auto-commit / auto-PR / upload
cassettes; **a human reviews redaction before commit**.

| | Fixture smoke | Rules (keyless) | SARIF ingest | Live completions | Org recording |
|--|---------------|-----------------|--------------|------------------|---------------|
| Brain | Deterministic fixture | Thin in-repo CWE heuristics | Existing SARIF file | Antares-1B **recommended**; or any local completions host (Ollama/vLLM/LM Studio) | Redacted cassette replay |
| What you need | `npm install` | `npm install` + authorized `--repo` | `npm install` + local `.sarif` | Completions `/v1` you already serve (+ HF/CUDA for Antares) | Prior locate report + human-reviewed cassette |
| Command door | `npm run mvp` / `locate --fixture` | `locate --cwe CWE-89 --repo <path> --rules` | `locate --from-sarif path/to/report.sarif` | `doctor` → `locate --endpoint …` (+ `--remote-inference` if non-loopback) | `record --from <dir> --out c.json` → `locate --recording c.json` |
| SARIF `mode` | `"fixture"` | `"rules"` | `"ingest"` | `"live"` | `"recording"` |
| Cost | $0 | $0 | $0 | Your GPU / local server (you control); Antares path may cost $ | $0 |
| What it proves | Factory shape + SARIF habit | Keyless localize candidates on a real tree | Reuse third-party scanner output in ZERODAY evidence | Live localization on an authorized repo (quality depends on brain) | CI regression of a redacted org localize |

Then the Desk loop (`inventory` → `packet` → `harden` → `classify` → `craft`)
runs **keyless on your tree** (cwd / `--repo` / `--from`) without Antares —
config inventory, offline packets, harden notes, crash classify, defensive
craft. Desk is **not** localization / vuln discovery.

FAQ: [`faq.md`](./faq.md).

---

## Rules locate (keyless real-repo, $0)

```bash
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo --rules
# Sample tree in this repo:
npm run zeroday -- locate --cwe CWE-89 --repo fixtures/locate/rules-sample --rules
```

Refuses mixed doors: `--rules` + `--fixture` or `--live`/`--endpoint` or
`--from-sarif` or `--recording` → fail closed. Does not change `npm run mvp`
(fixture smoke stays).

---

## SARIF ingest (keyless, $0)

```bash
npm run zeroday -- locate --from-sarif path/to/codeql.sarif
npm run zeroday -- locate --from-sarif path/to/semgrep.sarif --cwe CWE-89
# Sample in this repo:
npm run zeroday -- locate --from-sarif fixtures/locate/ingest-sample/sample.sarif --cwe CWE-89
```

Refuses mixed doors: `--from-sarif` + `--fixture` / `--rules` / `--recording` /
`--live` / `--endpoint` → fail closed.

---

## Org CI cassettes (`record --redact`, Keyless K3)

Org cassettes = **org regression, not discovery**.

```bash
# 1. Locate (example: rules on sample tree)
npm run zeroday -- locate --cwe CWE-89 --repo fixtures/locate/rules-sample --rules \
  --output zeroday-reports/org-locate

# 2. Record — --redact default ON (fail-closed)
npm run zeroday -- record --from zeroday-reports/org-locate \
  --out fixtures/locate/org-recordings/rules-cwe-89.cassette.json

# 3. Human reviews the cassette before commit
#    Full checklist: docs/cassette-runbook.md

# 4. Replay offline
npm run zeroday -- locate --recording fixtures/locate/org-recordings/rules-cwe-89.cassette.json
```

Same flow from Desk Console (`npm run play` → **Reports & cassettes**): redact
ON; UI refuses `--no-redact`. Org forever path:
[`org-ops-runbook.md`](./org-ops-runbook.md). Fixture README:
[`fixtures/locate/org-recordings/README.md`](../fixtures/locate/org-recordings/README.md).

---

## Local OpenAI-compatible brain (Keyless K4)

Point `locate --endpoint` at **any** local OpenAI-compatible
**`POST /v1/completions`** host you already run (Ollama, local vLLM, LM Studio,
…) — **no gated Antares weights required**. Still `mode: "live"`. **No new
locate modes.**

```bash
# Print-only checklist ($0 — no download, no auto-start, no RunPod)
npm run zeroday -- doctor
# same: bash scripts/local-brain-doctor.sh --print-only

# Shape-only check (no network) — chat URLs fail closed:
npm run zeroday -- doctor --endpoint http://127.0.0.1:8000/v1

# After YOU start a completions server on loopback:
npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \
  --endpoint http://127.0.0.1:8000/v1 --model <your-model-id>
```

Hard locks: completions-only (chat refused) · non-loopback still needs
`--remote-inference` · **arbitrary local models ≠ Antares File F1** ·
Antares-1B remains the **recommended** live brain when HF+CUDA available ·
print-only doctor never downloads models or starts servers.

One-pager: [`local-brain.md`](./local-brain.md) · recommended Antares path:
`npm run zeroday -- antares doctor` · [`runpod-antares.md`](./runpod-antares.md)

---

## Live Antares (opt-in)

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

Full one-pager: [`runpod-antares.md`](./runpod-antares.md) · host-agnostic:
[`remote-antares-vllm.md`](./remote-antares-vllm.md) · local any-completions:
[`local-brain.md`](./local-brain.md)

### Live brain from Desk Console

```bash
npm run play
# → http://localhost:3333/play → Live brain tab
#    Primary: **Validate live (≤60s)** when a completions host is already up
#      (Antares-1B / last-good Antares → doctor → spend banner → rules-sample)
#    CLI mirror: npm run zeroday -- live validate  (+ --spend-ack for one locate)
#    Advanced path:
#    1) Pick preset: Antares-1B (HF gated — accept terms yourself),
#       optional Antares-350M (Ollama), or local OpenAI-compatible
#    2) Save → .zeroday/desk-endpoint.json (token env *name* only; never the secret)
#    3) Doctor ping → K4 checklist + /v1/models probe
#    4) Spend banner confirm → live locate (reuses --endpoint / live-guard)
# Non-loopback: check remote-inference ACK (maps to --remote-inference)
```

Hard limits unchanged: spend banner + remote-inference ACK; localization ≠
exploitability; no PoC; no auto-merge. No auto RunPod / auto-spend. Optional
Antares-350M via Ollama (import yourself; no auto-download; no F1 claim):
[`antares-350m-ollama.md`](./antares-350m-ollama.md).

### Install (Node + Antares CLI)

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
npm install
uv tool install cisco-antares-cli
export PATH="$(uv tool dir --bin):$PATH"
antares --version
```

### Accept Hugging Face license (human step)

→ [https://huggingface.co/fdtn-ai/antares-1b](https://huggingface.co/fdtn-ai/antares-1b)

Never scrape or bypass. ZERODAY never downloads `model.safetensors` for you.

### Serve completions (CUDA / RunPod preferred)

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

Model defaults to `fdtn-ai/antares-1b` with `--endpoint` / `--live` (override with
`--model` / `ANTARES_MODEL`).

### Locate → SARIF

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

**Incomplete runs:** no invented findings. Defaults: `--tool-budget 30`,
best-effort re-query, `--fail-on-incomplete` (exit 2). Prefer **vLLM/CUDA**;
MPS float32 is bang-safe but tool-schema unreliable — ZERODAY does not rewrite
malformed tool_call JSON.

If the Antares raw `report.json` already lists ranked `findings` (even when the
exploration trace omitted an explicit `submit_*` tool call), ZERODAY treats that
as **complete localization evidence** and surfaces the ranked files — not bare
`no_submit` (Harden D). `no_submit` applies only when there are **zero** findings
and no submit. Never invent file paths.

| Class | Meaning |
|-------|---------|
| `no_submit` | Zero findings and model stopped without `submit_*` |
| `budget_exhausted` | Tool budget used up (and no ranked findings) |
| `timeout` | Deadline hit |
| `endpoint_error` | Completions failed |
| `parse_failure` | No usable `report.json` |

Tips: `GET /v1/models` + smoke `POST /v1/completions`; `--tool-budget 45`;
`--no-live-recovery` / `--no-fail-on-incomplete` as needed.

Sister pieces: [Antares](https://cisco-foundation-ai.github.io/antares/) ·
[cookbook Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md) ·
[Foundry](https://github.com/CiscoDevNet/foundry) ·
[CodeGuard](https://project-codeguard.org/)

---

## Fixture / operate / factory (same door as MVP)

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

Docs: [`defense-factory.md`](./defense-factory.md) · [`reports/`](./reports/)

---

## Desk chain (keyless on your tree)

Multi-repo / config inventory (Desk B — **your tree by default**; still keyless;
**not** vuln discovery):

```bash
npm run zeroday -- inventory
npm run zeroday -- inventory --repo /path/to/authorized-repo \
  --output zeroday-reports/inventory
# Fixture smoke only:
npm run zeroday -- inventory --fixture \
  --output zeroday-reports/desk-b-inventory
```

- Scans **your** cwd / `--repo` for Actions / Docker / manifests / agent-skill surfaces
- Records CI secret *patterns* (names only), `.env.example` honesty, dependency/agent harness hints
- Emits `inventory.json` + `inventory.md` + redacted SARIF + case note under `zeroday-reports/`
- **No** live Antares/RunPod · **no** PoC · Desk ≠ localize
- Samples: [`fixtures/inventory/desk-b/`](../fixtures/inventory/desk-b/) ·
  [`fixtures/inventory/real-shaped/`](../fixtures/inventory/real-shaped/)

Security packet (Desk A — offline share; generate only, **no auto-post**):

```bash
npm run zeroday -- packet
npm run zeroday -- packet --from zeroday-reports/inventory
npm run zeroday -- packet --fixture
```

- Consumes inventory JSON + SARIF (does not re-inventory)
- Emits `summary.md`, classified findings, SARIF copy, module/PR/ticket placeholders
- Labels: `agent-misfire` / `config` / `dependency` / `unknown` — evidence-backed only
- Sample: [`reports/desk-a-packet/`](./reports/desk-a-packet/)

Agent/package harden (Desk C — recommend-only; **no auto-apply / auto-PR / auto-merge**):

```bash
npm run zeroday -- harden
npm run zeroday -- harden --from zeroday-reports/security-packet --draft
npm run zeroday -- harden --fixture
```

- Emits `harden.md` + `harden.json`; `--draft` adds human-gated notes under `drafts/`
- Sample: [`reports/desk-c-harden/`](./reports/desk-c-harden/)

Crash classify + evidence (Desk E — **human review · no auto-remediate**):

```bash
npm run zeroday -- classify --from zeroday-reports/<locate-or-classify-dir>
npm run zeroday -- classify --fixture
```

- Labels: `possible_breach` | `infra_failure` | `software_defect` | `agent_misfire` | `needs_human`
- Ambiguous → **`needs_human`**; **Classification ≠ exploitability**
- Sample: [`reports/desk-e-classify/`](./reports/desk-e-classify/)

Defensive plugins/skills craft (Desk D — generate-only; **no auto-install / marketplace**):

```bash
npm run zeroday -- craft
npm run zeroday -- craft --from zeroday-reports
npm run zeroday -- craft --fixture
npm run zeroday -- skill --fixture
npm run zeroday -- plugin --fixture
```

- Emits Cursor/Grok-style `SKILL.md` + plugin stub encoding inventory→packet→harden→classify
- **Refuses** exploits, PoCs, and offensive skill patterns
- Sample: [`reports/desk-d-craft/`](./reports/desk-d-craft/)

**Honesty:** Desk keyless on *your* tree does **not** replace localization.
Fixture `locate` / `npm run mvp` still smoke the factory; `locate --rules` is
keyless real-repo localize; `locate --from-sarif` reuses scanner SARIF; live
Antares is the opt-in GPU brain.

---

## What works offline vs live

| Path | Needs | Writes SARIF? |
|------|-------|---------------|
| **`npm run mvp`** / **`locate --fixture`** | No GPU / no HF | Yes — **default smoke** |
| **`locate --rules`** | No GPU / no HF + authorized `--repo` | Yes — keyless real-repo heuristics |
| **`locate --from-sarif`** | No GPU / no HF + local `.sarif` | Yes — third-party ingest (mode=ingest) |
| **`record` → `locate --recording`** | Prior locate report (offline) | Yes — redacted org cassette replay (mode=recording) |
| **`operate`** (keyless) | Coding agent + snapshot | Yes (after submission / `--fixture`) |
| **`locate --endpoint …`** (live) | Completions `/v1` you serve (Antares-1B recommended; any local host ok) | Yes — **opt-in**; quality ≠ Antares F1 unless Antares |
| **`doctor`** (local-brain) | Nothing | No — print-only checklist ($0) |
| **`antares doctor`** | Nothing | No — print-only Antares/RunPod checklist |

---

## GitHub Action

On `pull_request`: keyless locate → upload SARIF → reviewable PR comment
(fail-closed). Default door is **fixture**; the `org-path` job also exercises
**rules** + **cassette replay**. Never pulls weights. Never auto-merge. Live
Antares is **not** wired into CI.

Workflow: [`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml) ·
Action: [`.github/actions/zeroday-locate-gate`](../.github/actions/zeroday-locate-gate/) ·
Org copy-paste example: [`examples/ops/zeroday-org-locate.yml`](../examples/ops/zeroday-org-locate.yml)

**Runbooks:** [Org ops](./org-ops-runbook.md) · [Cassette record/replay](./cassette-runbook.md)

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

[`vendor-packs/README.md`](./vendor-packs/README.md) · [`antares.md`](./antares.md) ·
[`agent-operator.md`](./agent-operator.md)

---

## CLI cheat sheet

```bash
# MVP door (keyless fixture smoke — locate + operate→verify)
npm run mvp

# Rules locate on a real authorized repo ($0 — not Antares F1)
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/repo --rules

# SARIF ingest (local file only — mode=ingest)
npm run zeroday -- locate --from-sarif path/to/report.sarif --cwe CWE-89

# Org CI cassette (Keyless K3 — redacted; human reviews before commit)
npm run zeroday -- record --from zeroday-reports/org-locate --out cassette.json
npm run zeroday -- locate --recording cassette.json

# Desk on your tree (keyless, no Antares — not vuln discovery)
npm run zeroday -- inventory
npm run zeroday -- packet
npm run zeroday -- harden
npm run zeroday -- classify --from <reports-or-locate-dir>
npm run zeroday -- craft

# Desk fixture smoke (CI / stranger)
npm run zeroday -- inventory --fixture
npm run zeroday -- packet --fixture
npm run zeroday -- harden --fixture
npm run zeroday -- classify --fixture
npm run zeroday -- craft --fixture

# Opt-in local completions brain (Keyless K4 — print-only first; $0)
npm run zeroday -- doctor

# Opt-in live Antares localize (costs $) — print-only first
npm run zeroday -- antares doctor
bash scripts/quickstart-live.sh ./app CWE-89

# Other
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend
npm run zeroday -- classify --scenario possible_breach
npm run zeroday -- demo
npm run operator   # local Desk Console / Operator UI on :3333
npm test
npm run test:desk
```

Desk unit tests cover **UI-2** reports/cassettes and **UI-3** live-endpoint.
CI runs them via the `desk-ui` job and via `npm test` in the locate gate.

Blog-shaped Antares workflows → ZERODAY (inspired by the open model — **not** a
partnership claim):

| Workflow (blog shape) | In ZERODAY |
|-----------------------|------------|
| CWE → files | `locate` / `operate` (fixture default; live Antares opt-in) |
| Advisory triage | CWE / CVE / GHSA → ranked files + hashed evidence |
| Augment SAST | SARIF out for existing review tools |
| CI/CD | `npm run mvp` + fixture factory in Actions |
| Strict privacy | Keyless local-first path; remote only with `--remote-inference` ack |
