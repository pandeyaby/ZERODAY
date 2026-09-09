# ZERODAY

```
 ███████╗███████╗██████╗  ██████╗ ██████╗  █████╗ ██╗   ██╗
 ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝
   ███╔╝ █████╗  ██████╔╝██║   ██║██║  ██║███████║ ╚████╔╝
  ███╔╝  ██╔══╝  ██╔══██╗██║   ██║██║  ██║██╔══██║  ╚██╔╝
 ███████╗███████╗██║  ██║╚██████╔╝██████╔╝██║  ██║   ██║
 ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝
```

**Turns your existing AI coding agent into a structured, auditable security operator** for **Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, and AWS Security** desks.

### North star

| Property | Meaning |
|----------|---------|
| **Keyless by default** | Default path uses the coding agent already running the tool — no Antares HF token, no vendor API keys, no cloud inference of customer source |
| **Self-hosted** | Runs on the operator workstation / CI runner |
| **Offline-capable** | Fixture + agent-protocol paths work with no network (vendored CWE maps, fixtures, local evidence) |
| **Durable evidence** | Every material claim links to hashed artifacts (JSON + Markdown + SARIF + vendor projections) |

Defensive only. Never exploits, PoCs, payloads, or attack procedures. Localization ≠ exploitability. No auto-merge.

---

## 60-second demo (no gated weights)

```bash
npm install

# Keyless agent-operator path (default product)
npm run zeroday -- operate --cwe CWE-89 --fixture --output zeroday-reports/demo-operate
npm run zeroday -- verify --from zeroday-reports/demo-operate

# Same artifact spine via Antares fixture recording
npm run zeroday -- locate --cwe CWE-89 --fixture --output zeroday-reports/demo
ls zeroday-reports/demo/report.sarif zeroday-reports/demo/splunk-cim-vulnerabilities.json
```

Mixed pack (classify classes + CISO):

```bash
npm run zeroday -- demo --output zeroday-reports/mixed-pack
```

**Honesty:** fixture-driven · not a live SOC · `needs_human` always · never auto-merge.

---

## What it is

| You give | You get (local files) |
|----------|------------------------|
| **CWE**, **CVE**, or **GHSA** + a local repo | Ranked candidate files, evidence quotes, confidence |
| | **Operator Spec** + submission schema (`operate`) |
| | **CISO one-pager** (`report.md`) with evidence citations |
| | **SARIF 2.1.0** · **ASFF** · **Splunk CIM** · **XSOAR** · **FortiSIEM** · **CrowdStrike HEC** |
| | **Evidence vault** + `manifest.json` (SHA-256) — `zeroday verify` |
| | Optional **patch DRAFT** only with `--i-asked-for-a-fix` |

Sister pieces we **compose**, not replace: [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) · [Project CodeGuard](https://project-codeguard.org/) · [Antares](https://cisco-foundation-ai.github.io/antares/) + [official cookbook Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md).

Not an official Cisco / Splunk / Palo Alto / Fortinet / CrowdStrike / AWS partnership product.

---

## Keyless vs optional Antares

| Path | When | Needs |
|------|------|-------|
| **`zeroday operate`** (default) | Coding agent (Cursor, Claude Code, …) explores read-only snapshot and submits JSON | Nothing cloud — fixture mode needs no network |
| **`zeroday locate --fixture`** | CI / recorded Antares-style localization | No GPU |
| **`zeroday locate --live --endpoint …`** | Operator hosts `fdtn-ai/antares-1b` locally | Completions-only endpoint; HF-gated weights **you** accept; never downloaded by ZERODAY CI |

Antares CLI expects **vLLM 0.19.1+** completions (`POST /v1/completions` only). ZERODAY does **not** claim independent “Validated with vLLM 0.19.1” proof — that is the Antares CLI expectation.

`zeroday sweep` (wrap `antares sweep`) is **TODO** — ship operate + verify first; see CLI stub.

---

## Artifact pack

Under `zeroday-reports/<run-id>/`:

| File | Purpose |
|------|---------|
| `OPERATOR_SPEC.md` / `operator-brief.json` | Agent brief (`operate`) |
| `operator-submission.schema.json` | Submission contract |
| `submission.json` | Agent (or fixture) submission |
| `report.json` / `report.md` / `report.sarif` / `comment.md` | Localization + CISO + PR comment |
| Vendor projections | ASFF · Splunk CIM · XSOAR · FortiSIEM · CrowdStrike HEC |
| `evidence/` + `evidence/manifest.json` | Hashed vault — `zeroday verify --from <run-dir>` |

---

## Vendor packs (customer ingest)

ZERODAY writes **local files only**. Your team wires ingest. No push, no partnership, no credentials.

| Desk | File |
|------|------|
| Cisco | `report.sarif` (Foundry Detector-lane candidates) |
| Splunk | `splunk-cim-vulnerabilities.json` |
| Palo Alto | `xsoar-incidents.json` |
| Fortinet | `fortisiem-custom.json` |
| CrowdStrike | `crowdstrike-hec-events.ndjson` |
| AWS Security | `asff-findings.json` |

Details: [`docs/vendor-packs/README.md`](./docs/vendor-packs/README.md) · [`docs/exporters.md`](./docs/exporters.md).

---

## Local playground

```bash
npm run play
# http://localhost:3333/play  — How orgs use this + fixture buttons
```

Fixture-only UI. No offensive mission / stego / jailbreak tabs.

---

## Acceptable use

See [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md) — defensive localization + evidence audit only.

| Allowed | Not allowed |
|---------|-------------|
| Localize candidate files you are authorized to assess | Exploits, PoCs, payloads, attack procedures |
| Emit local SARIF / ASFF / CIM / SIEM files | Auto-merge · live vendor pushes · invented CVSS |
| Draft patches with `--i-asked-for-a-fix` | Treating localization as exploitability proof |
| Compose Foundry + CodeGuard | Claiming partnerships or Antares-3B |

---

## CLI

```bash
npm run zeroday -- operate --cwe CWE-89 --fixture
npm run zeroday -- verify --from zeroday-reports/demo-operate
npm run zeroday -- locate --cwe CWE-89 --fixture
npm run zeroday -- locate --cve CVE-2024-89001 --repo ./app --endpoint http://127.0.0.1:8000/v1
npm run zeroday -- classify --scenario possible_breach
npm run zeroday -- demo
npm run zeroday -- export --format asff --from ./zeroday-reports/.../report.json
npm run zeroday -- draft-fix --i-asked-for-a-fix --from ./zeroday-reports/.../report.json
npm run zeroday -- play --action locate
```

---

## Tests / CI

```bash
npm test
```

GitHub Action: fixture-only on `ubuntu-latest` (no GPU, no Docker-in-Docker required for fixture path).

---

## License & credits

Authorized / defensive use only. No warranty.

- **Antares** — Cisco Foundation AI ([site](https://cisco-foundation-ai.github.io/antares/), [Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md))
- Official CLI — [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/)
- Foundry Security Spec · Project CodeGuard — compose, don’t replace
