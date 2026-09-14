# Classify.md
Fixture classifier + Desk E crash classify evidence

## Labels (exactly one)

`possible_breach` | `infra_failure` | `software_defect` | `agent_misfire`

Ambiguous / competing signals → **`needs_human`**. Every CISO / Desk E pack sets `needs_human: true`. Never auto-label malice as truth without a human. **Classification ≠ exploitability.**

`agent_misfire` is **fixture classifier output only** — not live agent detection.

## One command (Desk E)

```bash
npm run zeroday -- classify --from <reports-or-locate-dir>
npm run zeroday -- classify --fixture
```

Emits `classify.md` + `classify.json` evidence pack (plus backward-compatible `ciso.md` / `ciso.json`). Secrets redacted. Human review required — no auto-remediate. Desk ≠ vuln discovery.

Sample: [`docs/reports/desk-e-classify/`](./reports/desk-e-classify/).

## Telemetry INPUT (not a scanner)

Schema `zeroday-telemetry-v1` (`fixtures/classify/*/telemetry.json`). NetFlow / firewall / infra / agent_session shaped. **East-west / lateral** tags feed `possible_breach` (or `needs_human` if ambiguous). We do **not** simulate, generate, or demonstrate movement.

### Exporter hook (customer-owned)

| Artifact | Role |
|----------|------|
| `report.sarif` / `splunk-cim-vulnerabilities.json` / `asff-findings.json` | Existing locate exporters (unchanged) |
| `classify.json` / `classify.md` | Desk E evidence pack (crash classify) |
| `ciso.json` / `ciso.md` | Splunk+Cisco CISO rollup (locate evidence + telemetry ids) |
| `pack-splunk-classifications.json` | Classification events for a customer TA (`zeroday:antares:classify`) |

Drop customer telemetry JSON into `zeroday classify --telemetry <file>`. No live Cisco/Splunk pulls. No push.

## Exec demo

```bash
npm run zeroday -- demo --output zeroday-reports/mixed-pack
```

Manifest: `fixtures/classify/mixed/manifest.json`.
