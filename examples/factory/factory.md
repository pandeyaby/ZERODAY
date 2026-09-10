# ZERODAY Localization & Evidence Defense Factory

> Continuous defensive loop. Localization is **not** proof of exploitability. No PoCs. No auto-merge. `needs_human: true` always.

| | |
|--|--|
| Run | `factory-1789076803484` |
| Repo | `/workspace/fixtures/locate/demo-app` |
| Advisory | `CWE-89` |
| Findings | **2** |
| Locate mode | `fixture` |
| Classification | `software_defect` |
| Verify | PASS |
| Defend | PASS |
| Inference | `local` (remote=false) |
| Needs human | **yes** |

## Stages

1. **Inventory** — files + CODEOWNERS + manifests
2. **Locate** — Antares fixture / live / agent candidates
3. **Classify** — optional CISO rollup (fixture telemetry)
4. **Own** — CODEOWNERS / blame → review markdown + GitHub comment
5. **Draft** — CodeGuard patch draft only after `--i-asked-for-a-fix`
6. **Defend** — existing tests / fail-closed (never exploit repro)
7. **Verify** — offline evidence hash check

## Artifacts

- **inventory:** `/workspace/examples/factory/sample-run/inventory.json`
- **locateReport:** `/workspace/examples/factory/sample-run/locate/report.json`
- **classifyJson:** `/workspace/examples/factory/sample-run/classify/ciso.json`
- **ownership:** `/workspace/examples/factory/sample-run/ownership.json`
- **ownershipMd:** `/workspace/examples/factory/sample-run/ownership.md`
- **ownershipComment:** `/workspace/examples/factory/sample-run/ownership-comment.md`
- **defend:** `/workspace/examples/factory/sample-run/defend.json`
- **verifyJson:** `/workspace/examples/factory/sample-run/verify.json`
- **summaryJson:** `/workspace/examples/factory/sample-run/factory.json`
- **summaryMd:** `/workspace/examples/factory/sample-run/factory.md`

## Hard limits

- No exploit / PoC / payload / attack procedure
- Localization ≠ exploitability
- Never auto-merge
- Local-first / keyless default; remote inference requires explicit ACK
