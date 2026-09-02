# Classify fixtures

Local INPUT only. Schema: `zeroday-telemetry-v1` (`source: "fixture"`, `events[]`).

| Scenario | Expected label | Inputs |
|----------|----------------|--------|
| `software_defect` | `software_defect` | `report.json` (Antares locate CWE-89) |
| `possible_breach` | `possible_breach` | `telemetry.json` (lateral / east-west) |
| `infra_failure` | `infra_failure` | `telemetry.json` (infra timeouts/DNS) |
| `agent_misfire` | `agent_misfire` | `telemetry.json` (agent_session misfire tags) |
| `needs_human` | `needs_human` | competing lateral + agent signals |

No live Cisco/Splunk/Talos pulls. Labels require human review.
