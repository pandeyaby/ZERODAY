# How to use ZERODAY

> Best way for a person, how orgs should use it, and the local fixture playground.

[Open in app](http://localhost:3333/play) · War Room tab **How orgs use this**

## Best way for a person

- **Morning/PR** — leave the GitHub Action on forever (fixture locate → SARIF → reviewable comment → soft-fail). No GPU in CI.
- **Known CWE/CVE/GHSA** — default `zeroday operate` (keyless coding-agent path). Optional `zeroday locate --live` when you host Antares locally. Source never leaves the machine.
- **CISO** — `zeroday demo` or `classify` → `ciso.md` / `ciso.json`. Localization is not exploitability. Human review required.
- **Never auto-merge.** Draft-fix only with `--i-asked-for-a-fix`. No PoCs.

## How orgs should use it

- **Platform eng** — Action on every repo; no GPU in CI.
- **Security analyst** — operate/locate on a workstation; ingest SARIF in GitHub Code Scanning.
- **SOC / Splunk / Cisco Security Cloud buyer** — take Splunk CIM JSON, ASFF, and the CISO object as **FILES** your team ingests with your credentials. We do not push to your clouds.
- **Classifier honesty** — four-class classifier is fixture-driven (`possible_breach` | `infra_failure` | `software_defect` | `agent_misfire` | `needs_human`). Ambiguous → `needs_human`. Do not claim live agent-misfire SOC.

## Local fixture playground

```bash
npm run play
# open http://localhost:3333/play
```

Buttons run existing fixture paths: locate CWE-89, classify each scenario, mixed `zeroday demo`. The UI shows a SARIF summary, Splunk-shaped JSON snippet, and CISO markdown. No live telemetry, no simulated attacks, no exploits, no gated weights. Defensive tabs only.

Headless:

```bash
npm run zeroday -- play --action locate
npm run zeroday -- play --action classify --scenario possible_breach
npm run zeroday -- play --action demo
```
