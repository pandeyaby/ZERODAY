# Classify + mixed pack

## Labels (exactly one)

`possible_breach` | `infra_failure` | `software_defect` | `agent_misfire`

Ambiguous / competing signals → **`needs_human`**. Every CISO object sets `needs_human: true`. Never auto-label malice as truth without a human. Localization is not exploitability.

`agent_misfire` is **fixture classifier output only** — not live agent detection.

## Telemetry INPUT (not a scanner)

Schema `zeroday-telemetry-v1` (`fixtures/classify/*/telemetry.json`). NetFlow / firewall / infra / agent_session shaped. **East-west / lateral** tags feed `possible_breach` (or `needs_human` if ambiguous). We do **not** simulate, generate, or demonstrate movement.

### Exporter hook (customer-owned)

| Artifact | Role |
|----------|------|
| `report.sarif` / `splunk-cim-vulnerabilities.json` / `asff-findings.json` | Existing locate exporters (unchanged) |
| `ciso.json` / `ciso.md` | Splunk+Cisco CISO rollup (locate evidence + telemetry ids) |
| `pack-splunk-classifications.json` | Classification events for a customer TA (`zeroday:antares:classify`) |

Drop customer telemetry JSON into `zeroday classify --telemetry <file>`. No live Cisco/Splunk pulls. No push.

## Exec demo

```bash
npm run zeroday -- demo --output zeroday-reports/mixed-pack
```

Manifest: `fixtures/classify/mixed/manifest.json`.
