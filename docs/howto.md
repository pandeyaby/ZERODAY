# How to use ZERODAY

> Best way for a person, how orgs should use it, and the local fixture playground.
> Strangers: start at the [root README](../README.md) (`npm run mvp`), then
> [`getting-started.md`](./getting-started.md). Full door map: [`paths.md`](./paths.md).

[Open in app](http://localhost:3333/play) · Operator tab **How orgs use this**

## Best way for a person

- **Morning/PR** — leave the GitHub Action on forever (keyless fixture / rules /
  cassette → SARIF → **fail-closed** reviewable PR comment). No GPU in CI. Live
  Antares stays on the workstation after human spend approval
  (`scripts/quickstart-live.sh`). See [`org-ops-runbook.md`](./org-ops-runbook.md).
- **Known CWE/CVE/GHSA** — default `zeroday operate` (keyless coding-agent path). Product path: `zeroday locate --repo … --endpoint …` when you host Antares locally. Source never leaves the machine.
- **CISO / Desk E** — `zeroday classify --from fixtures/classify/software_defect` → `classify.md` / `classify.json` (+ `ciso.*`). **Classification ≠ exploitability.** Human review required.
- **Desk D craft** — `zeroday craft --from docs/reports` → defensive `SKILL.md` + plugin stub (generate-only; no auto-install).
- **Never auto-merge.** Draft-fix only with `--i-asked-for-a-fix`. No PoCs.

## How orgs should use it

- **Design partners / org operators** — start with [`design-partner-trust.md`](./design-partner-trust.md): public OSS, customer source private; keyless first; live only with human spend; no F1 marketing claims.
- **Platform eng** — Action on every repo (`examples/ops/zeroday-org-locate.yml`); no GPU in CI. Runbook: [`org-ops-runbook.md`](./org-ops-runbook.md).
- **Security analyst** — operate/locate on a workstation; ingest SARIF in GitHub Code Scanning; cassette regression: [`cassette-runbook.md`](./cassette-runbook.md).
- **SOC / Splunk / Cisco Security Cloud buyer** — take Splunk CIM JSON, ASFF, and the CISO object as **FILES** your team ingests with your credentials. We do not push to your clouds.
- **Classifier honesty** — four-class classifier is fixture-driven (`possible_breach` | `infra_failure` | `software_defect` | `agent_misfire` | `needs_human`). Ambiguous → `needs_human`. Do not claim live agent-misfire SOC.

## Local fixture playground

```bash
npm run play
# open http://localhost:3333/play
```

Buttons run existing fixture paths: locate CWE-89, classify each scenario, mixed `zeroday demo`. The UI shows a SARIF summary, Splunk-shaped JSON snippet, and CISO markdown. No live telemetry, no simulated attacks, no exploits, no gated weights. Defensive tabs only.

**Prove doors tab** — browser card for Door A (`npm run stranger:verify` / `doors`, copy-paste; same keyless trust-loop as CI) and Door B (citation only to [`gpu-claims.md`](./gpu-claims.md) § Live re-proof 2026-09-19 — pod `d65ny3xqf7bwza`, ~$0.034; no GPU spend from the UI). Also copy-paste `npm run --silent stranger:verify -- --json` + static schema preview (expected keys `schemaVersion` / `doorA` / `doorB.mode=citation` / `nonClaims`; CI artifact `stranger-verify-json`). Non-claims visible. Detail: [`stranger-verify.md`](./stranger-verify.md#machine-readable-json---json) · [`ci-trust.md`](./ci-trust.md).

**FAQ tab** — same Keyless Strength Q&As as [`docs/faq.md`](./faq.md) (`src/faq/content.ts`).

Headless:

```bash
npm run zeroday -- play --action locate
npm run zeroday -- play --action classify --scenario possible_breach
npm run zeroday -- play --action demo
```
