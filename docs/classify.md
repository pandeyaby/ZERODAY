# Classify — fixture-driven CISO rollup

`zeroday classify` combines an Antares **locate** result (optional) with a local **telemetry** fixture (optional) into one CISO object (`ciso.json` + `ciso.md`).

## Labels

`possible_breach` | `infra_failure` | `software_defect` | `agent_misfire` | `needs_human`

- Ambiguous / competing signals → **`needs_human`**
- Every object sets `needs_human: true` and `human_review_required: true`
- **`agent_misfire` is a classifier output on fixtures only** — not live agent detection
- Not proof of exploitability or of a live adversary; not a production SOC

## Telemetry input schema

`zeroday-telemetry-v1` — see `fixtures/classify/*/telemetry.json`. No live Cisco/Splunk/Talos feeds.

## Scenarios

| Scenario | Expected |
|----------|----------|
| `software_defect` | locate CWE-89 only |
| `possible_breach` | lateral-movement telemetry |
| `infra_failure` | infra timeout/DNS telemetry |
| `agent_misfire` | agent_session misfire tags |
| `needs_human` | lateral + agent competing |

```bash
npm run zeroday -- classify --scenario software_defect
```
