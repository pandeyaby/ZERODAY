# ZERODAY Desk E — crash classify + evidence

> **Human review required.** Fixture-driven crash/incident classification for triage. **Classification ≠ exploitability.** Not a production SOC · not proof of a live adversary · **no auto-remediate · no auto-merge · no PoC.** Secret *values* redacted.

| | |
|--|--|
| Generated | 2026-09-14T04:40:50.162Z |
| Schema | `zeroday-classify-evidence/v1` |
| Desk | **E** (crash classify + evidence) |
| Classification | `software_defect` |
| Finding class | `software_defect` |
| Confidence (rule heuristic) | 0.7 |
| East-west suspected (telemetry input) | no |
| Needs human | **yes** (always) |
| Classification ≠ exploitability | **yes** (always) |
| Posture | human review · no auto-remediate · no PoC · secrets redacted |

## Labels (exactly one)

Ambiguous or competing signals → **`needs_human`**. Never invent `possible_breach` from weak signals.

| Label | Selected |
|-------|----------|
| `possible_breach` | no |
| `infra_failure` | no |
| `software_defect` | **yes** |
| `agent_misfire` | no |
| `needs_human` | no |

## Source

| Artifact | Path |
|----------|------|
| From | `fixtures/classify/software_defect` |
| Scenario | `software_defect` |
| Locate report | `fixtures/classify/software_defect/report.json` |
| Telemetry fixture | `—` |
| Advisory | `CWE-89` → `CWE-89` |

## Signals observed

| Signal | Present |
|--------|---------|
| software_defect | yes |
| possible_breach | no |
| infra_failure | no |
| agent_misfire | no |

## Rationale

- Locate submitted ranked candidate file(s) with CWE evidence; no breach/infra/agent telemetry signals.

## Evidence pointers

- **file** `src/users.js` (CWE-89) — SQL query built via string concatenation
- **file** `src/app.js` (CWE-89) — Request parameter passed to unsafe finder

## Next human action

Human triage required before accepting 'software_defect': confirm evidence, dismiss or escalate. Localization is not exploitability. Never auto-merge.

---

_Desk E packages locate + optional telemetry fixtures into a candidate label for a human. It does not watch the live network, simulate attacks, or auto-remediate. **Classification is not exploitability.**_
