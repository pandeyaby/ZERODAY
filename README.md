# ZERODAY

```
 ███████╗███████╗██████╗  ██████╗ ██████╗  █████╗ ██╗   ██╗
 ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝
   ███╔╝ █████╗  ██████╔╝██║   ██║██║  ██║███████║ ╚████╔╝
  ███╔╝  ██╔══╝  ██╔══██╗██║   ██║██║  ██║██╔══██║  ╚██╔╝
 ███████╗███████╗██║  ██║╚██████╔╝██████╔╝██║  ██║   ██║
 ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝
```

**Local-first Antares daily driver for Cisco Security + Observability + Splunk desks.**

### The agentic-era question (context — not a ZERODAY claim)

When something goes wrong in an agentic stack, a leader still has to answer: was it a **possible breach**, an **infra failure**, a **software defect**, or a **legitimate agent with bad judgment** — and the adversary may already be inside (and may itself be an agent). **Code and telemetry have to stay together** for a human to decide. ZERODAY does **not** watch the live network and does **not** claim production detection of agent misfires or live adversaries.

### What ZERODAY actually does

| Capability | Reality |
|------------|---------|
| Antares-native local vulnerability localization | CWE / CVE / GHSA → ranked files + evidence (`locate`) |
| Source stays on the machine | No cloud inference of customer source |
| SARIF | GitHub Code Scanning (note severity) |
| Splunk CIM + ASFF files | **Customer** ingests; we do not push |
| CI gate | Fixture-only Action you can leave on forever |
| Human review | Localization ≠ exploitability; **no auto-merge** |
| Patch DRAFT | Only with `--i-asked-for-a-fix` |
| Live explore sandbox | Docker `network=none` when available |
| **Classify (fixture-driven)** | Rollup label `possible_breach` \| `infra_failure` \| `software_defect` \| `agent_misfire` \| `needs_human` from **local** locate + telemetry fixtures — **always** `needs_human` / human review required; ambiguous → `needs_human` |

> **Honesty:** `agent_misfire` appears only as a **classifier output on fixtures** that support it — not as live agent-misfire detection.

This is a workstation those teams can run. It is **not** an official Cisco / Splunk partnership product and invents no executive quotes.

---

## 60-second demo (no gated weights)

Copy-paste after clone. Fixture path only — no GPU, no HF token, no model download.

```bash
npm install
npm run zeroday -- locate --cwe CWE-89 --fixture --output zeroday-reports/demo
# → report.sarif (GitHub Code Scanning)
# → splunk-cim-vulnerabilities.json + asff-findings.json (local; customer ingests)
ls zeroday-reports/demo/report.sarif zeroday-reports/demo/splunk-cim-vulnerabilities.json
```

Optional re-export (same files, explicit command):

```bash
npm run zeroday -- export --format splunk --from zeroday-reports/demo/report.json
npm run zeroday -- export --format sarif --from zeroday-reports/demo/report.json
```

### Second copy-paste — classify on bundled fixtures

```bash
npm run zeroday -- classify --scenario software_defect --output zeroday-reports/ciso-software
npm run zeroday -- classify --scenario possible_breach --output zeroday-reports/ciso-breach
npm run zeroday -- classify --scenario infra_failure --output zeroday-reports/ciso-infra
npm run zeroday -- classify --scenario agent_misfire --output zeroday-reports/ciso-agent
npm run zeroday -- classify --scenario needs_human --output zeroday-reports/ciso-ambiguous
# → ciso.json + ciso.md  (always needs_human: true)
```

Fixture names live under `fixtures/classify/<scenario>/`.

---

## What it is

ZERODAY wraps [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/) (`antares query` / `plan` / `sweep`) into a defensive workstation:

| You give | You get (local files) |
|----------|------------------------|
| **CWE**, **CVE**, or **GHSA** + a local repo | Ranked candidate files, evidence, exploration trace |
| | **CISO one-pager** (`report.md`) |
| | **SARIF 2.1.0** (GitHub Code Scanning, note severity) |
| | **ASFF** · **Splunk CIM** · **XSOAR** · **FortiSIEM** · **CrowdStrike HEC** projections |
| | Optional **patch DRAFT** only with `--i-asked-for-a-fix` |

It does **not** write exploits, PoCs, payloads, or attack procedures. Localization is **not** proof of exploitability. Findings are **Detector-lane candidates** (Foundry Security Spec roles) — true-positive waits for human triage. Fixes are never auto-merged.

Sister pieces we **compose**, not replace: [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) · [Project CodeGuard](https://project-codeguard.org/).

This is a workstation those teams can run. It is **not** an official Cisco / Splunk / Palo Alto / Fortinet / CrowdStrike / AWS partnership product.

---

## What Antares is

[Antares](https://cisco-foundation-ai.github.io/antares/) (Cisco Foundation AI) — **localization SLMs**, not exploit writers.

| Model | Notes |
|-------|-------|
| [`fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b) | File F1 **0.209**, 128K — ZERODAY default |
| [`fdtn-ai/antares-350m`](https://huggingface.co/fdtn-ai/antares-350m) | File F1 **0.135**, 32K — edge |
| Antares-3B | Cisco-internal — **we never claim it** |

- Official CLI: PyPI [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/) (`uv tool install cisco-antares-cli`)
- Inference: streaming **`POST /v1/completions` only** (not chat). Validated with **vLLM 0.19.1**
- Agent loop: CWE + category → up to ~15 terminal calls (`grep`/`find`/`cat`) → `submit_vulnerable_files` or `submit_no_vulnerability_found`
- Snapshot caps: 100k files / 2 GiB / 256 MiB per file · Linux/macOS (native **Windows not supported**)
- There is **no** `antares locate` — ZERODAY `locate` wraps `antares query`

---

## Local-first promise

1. **Customer source never leaves the machine** for cloud inference.
2. Read-only snapshot → destroy after run.
3. **Live exploration sandbox** (when Docker is available): isolated `ubuntu:24.04` container, `network=none`, 10s command timeout, memory/CPU limits, allowlisted `grep`/`find`/`cat`/… only, destroy after run. Inference stays on the host (`vllm serve` → `/v1/completions`) because the sandbox has no network.
4. **Fixture / GitHub Action stay container-free** — no Docker-in-Docker on `ubuntu-latest`.
5. Live inference talks only to **your** local `/v1/completions` endpoint (or the official CLI you installed).

**Weights are gated.** Accept Cisco’s terms on Hugging Face for `fdtn-ai/antares-1b`. ZERODAY never scrapes or bypasses that gate and **never downloads `model.safetensors`**. Live still needs an **operator** workstation with vLLM + HF access — CI will not pull weights.
---

## Quick start (fixture — no GPU)

```bash
npm install

# One command
npm run zeroday -- locate --cwe CWE-89 --fixture

# CVE / GHSA (resolved → CWE via vendored map; offline-safe in fixture)
npm run zeroday -- locate --cve CVE-2024-89001 --repo fixtures/locate/demo-app --fixture
```

Artifacts in `zeroday-reports/<advisory>-<timestamp>/`:

| File | Purpose |
|------|---------|
| `report.json` | Internal localization result |
| `report.md` | CISO one-pager |
| `report.sarif` | GitHub Code Scanning |
| `asff-findings.json` | AWS Security Hub ASFF (local) |
| `splunk-cim-vulnerabilities.json` | Splunk CIM Vulnerabilities (local) |
| `xsoar-incidents.json` | Cortex XSOAR mapper input (local) |
| `fortisiem-custom.json` | FortiSIEM customer parser JSON (local) |
| `crowdstrike-hec-events.ndjson` | CrowdStrike HEC-shaped events (local) |
| `comment.md` | Reviewable PR comment body |

```bash
npm test
```

---

## Live locate (local vLLM)

**Fixture** (`--fixture`) is what CI and juniors use — recorded localization, no GPU, no HF token.

**Live** is opt-in on an operator workstation after accepting gated HF terms:

```bash
uv tool install cisco-antares-cli
export PATH="$(uv tool dir --bin):$PATH"

# Accept HF terms for fdtn-ai/antares-1b, then serve locally (do not pull weights into CI):
vllm serve fdtn-ai/antares-1b

# --endpoint implies live (unless --fixture). Completions only — not chat.
npm run zeroday -- locate --cve CVE-2024-89001 --repo /path/to/repo \
  --endpoint http://127.0.0.1:8000/v1
```

ZERODAY resolves CVE/GHSA → CWE (vendored map, or public NVD/GHSA **metadata** APIs — never exploit-DB writeups), snapshots the repo, wraps **`antares query`**, and writes the report + exporters. Optional `--map-cwe CWE-89` when resolve cannot map.

`antares plan` stays local (no inference):

```bash
npm run zeroday -- plan fixtures/locate/demo-app --max-cwes 5
```

---

## Defender exporters — how the CUSTOMER ingests them

ZERODAY writes **local files only**. Your team wires ingest. There are **no** partnership claims, **no** live vendor API pushes, and **no** bundled credentials.

```bash
npm run zeroday -- export --format asff|splunk|xsoar|fortisiem|crowdstrike|sarif \
  --from zeroday-reports/.../report.json
```

(`locate` already writes every format beside `report.json`.)

| File | Who | How **you** ingest (customer-owned) |
|------|-----|-------------------------------------|
| `report.sarif` | GitHub Code Scanning | Action uploads via `github/codeql-action/upload-sarif` (already in our workflow). Or upload the file in your own workflow. File-level **note**; `partialFingerprints` for dedupe. Do not invent line regions. |
| `asff-findings.json` | AWS Security Hub | Customer replaces `AwsAccountId` / ARN placeholders, then **their** process calls `BatchImportFindings` (or a custom product ARN they registered). ZERODAY never calls AWS. SchemaVersion `2018-10-08`; severity in `FindingProviderFields`; `Types` use **CWE id** (not an invented CVE); `Resources.Type=Other` + `Details.Other.FilePath`. |
| `splunk-cim-vulnerabilities.json` | Splunk (CIM / ESCU) | Build a **customer TA**: set sourcetype **`zeroday:antares:json`**, map CIM Vulnerabilities fields (`dest`, `dvc`, `signature`, `severity`, `category`, `xref`, `signature_id`, `vendor_product`). `cve` only when the advisory input was a real CVE — never invent `cvss`. **Not** ES Notable JSON (there is no create-notable ingest schema here). |
| `xsoar-incidents.json` | Palo Alto Cortex XSOAR | Feed the JSON **array** into a customer mapper / generic webhook playbook (`type`, `name`, `occurred`, `severity`, `details`, `cwe`, `file_path`). XSOAR does **not** natively ingest SARIF. No live incident POST from ZERODAY. |
| `fortisiem-custom.json` | Fortinet FortiSIEM | Point a **customer** XML parser or rawupload job at the generic keys (`vendor`, `model`, `eventType`, `severity`, `cwe`, `filePath`, `title`, `description`, `occurred`). No official finding schema; we do not claim `PH_DEV_MON_CUSTOM_JSON`. No live `/rawupload`. |
| `crowdstrike-hec-events.ndjson` | CrowdStrike LogScale | Ship NDJSON with a **customer** HEC / ingest token (`host`, `message`, `cwe`, `file_path`, `signature`, `severity`, `vendor`, `product`). No `#cps` parser tags. No live HEC from ZERODAY. |

Foundry: these are **Detector-lane candidates** only — true-positive waits for human triage. Compose [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) roles; do not auto-publish tickets or mark exploited.

Full field notes: [`docs/exporters.md`](./docs/exporters.md).

---

## Patch drafts (gated)

```bash
npm run zeroday -- draft-fix --i-asked-for-a-fix \
  --from zeroday-reports/.../report.json \
  --repo fixtures/locate/demo-app
```

Maps CWE → existing Project CodeGuard `codeguard-*.md` rules. **DRAFT only.** Never auto-merge. Never “CodeGuard-approved.” If anyone also asks for a PoC/exploit: **one-sentence refuse**, still only the patch draft.

---

## GitHub Action (leave it on)

[`.github/workflows/zeroday-locate.yml`](./.github/workflows/zeroday-locate.yml) — **fixture-only**, `ubuntu-latest`, **no GPU / no weights**.

- Fixture `locate` → SARIF upload (note) + reviewable PR comment + soft-fail
- Findings do **not** fail the job by default (localization ≠ exploitability)
- Opt-in: repo variable `ZERODAY_FAIL_ON_FINDINGS=true`

### Pre-commit (optional)

```bash
git config core.hooksPath hooks
# or: ln -sf ../../hooks/pre-commit .git/hooks/pre-commit
```

Runs fixture locate only — never pulls weights.

---

## Acceptable use

| Allowed | Not allowed |
|---------|-------------|
| Localize candidate files you are authorized to assess | Exploits, PoCs, payloads, attack procedures |
| Emit SARIF / ASFF / CIM / SIEM **local** files | Auto-merge · live vendor API pushes · invented CVSS/line numbers |
| Draft patches only with `--i-asked-for-a-fix` | Treating localization as exploitability proof |
| Compose Foundry + CodeGuard | Claiming Antares-3B or vendor partnerships |
| Fixture demos without HF access | Bypassing Hugging Face gating / downloading weights in CI |

---

## What it is not

- An exploit / PoC generator (**never**)
- Auto-remediation or auto-merge (**never**)
- Antares-3B
- A thin CLI wrapper with no report/export spine
- Cloud inference of private source
- Native Windows support (match Antares CLI: Linux/macOS)
- An official Cisco/Splunk/Palo/Fortinet/CrowdStrike/AWS product

---

## CLI

```bash
npm run zeroday -- locate --cwe CWE-89 --fixture
npm run zeroday -- locate --cve CVE-2024-89001 --repo ./app --endpoint http://127.0.0.1:8000/v1
npm run zeroday -- plan ./app --max-cwes 5
npm run zeroday -- export --format asff --from ./zeroday-reports/.../report.json
npm run zeroday -- draft-fix --i-asked-for-a-fix --from ./zeroday-reports/.../report.json
```

---

## Architecture

```
zeroday locate --cwe|--cve|--ghsa  --repo  [--fixture | --endpoint]
        │
        ├─ resolve advisory → CWE + category (vendored / NVD / GHSA metadata)
        ├─ read-only snapshot (Antares caps) → destroy after run
        ├─ fixture: recorded localization
        └─ live: WRAP antares query → POST /v1/completions (cisco-antares-cli)
        │
        ├─ no-exploit invariant
        ├─ report.json + report.md (CISO) + comment.md
        └─ exporters → sarif | asff | splunk | xsoar | fortisiem | crowdstrike
```

Optional War Room UI (`npm run dev` → http://localhost:3333) remains in-tree. Antares localization is the product spine.

### Live sandbox (operator machines with Docker)

```
live locate
  ├─ create read-only snapshot (host tmp)
  ├─ SandboxSession (docker ubuntu:24.04)
  │    network=none · --read-only · mem/cpu limits · /snapshot:ro
  │    allowlisted exec: grep|find|cat|ls|…
  │    destroy after run
  └─ antares query on host → POST host /v1/completions (needs network to vLLM)
```

Fixture + Action: **no container**. Docker tests skip when the daemon is absent.

---

## Tests

```bash
npm test
```

Covers: CVE/GHSA parse + resolve, exporter schema smoke, no-exploit invariant, draft-fix gate, completions endpoint normalize, fixture locate, Action-shaped outputs. CI stays on `ubuntu-latest` without GPU.

---

## License & credits

Authorized / defensive use only. No warranty.

- **Antares** — Cisco Foundation AI ([site](https://cisco-foundation-ai.github.io/antares/), [collection](https://huggingface.co/collections/fdtn-ai/antares))
- Official CLI — [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/)
- Foundry Security Spec · Project CodeGuard — compose, don’t replace
