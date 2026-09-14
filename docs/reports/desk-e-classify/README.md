# ZERODAY classify evidence (Desk E)

Crash / incident classification from locate + optional telemetry fixtures.

## One command

```bash
npm run zeroday -- classify --from fixtures/classify/software_defect
# or:
npm run zeroday -- classify --fixture
npm run zeroday -- classify --scenario needs_human
```

## Contents

| File | Role |
|------|------|
| `classify.md` | Stranger-readable classification summary |
| `classify.json` | Machine-readable evidence pack (`zeroday-classify-evidence/v1`) |
| `ciso.json` / `ciso.md` | CISO rollup (same classifier; backward compatible) |
| `README.md` | This file |
| `SOURCE.md` | Provenance |

## Labels

`possible_breach` | `infra_failure` | `software_defect` | `agent_misfire` | `needs_human`

Ambiguous → **`needs_human`**. Never invent breach from weak signals.

## Hard limits

- **Classification ≠ exploitability**
- Human review required — **no** auto-remediate / auto-merge
- No PoC / exploit / attack simulation
- Secrets redacted in snippets
- `npm run mvp` / `inventory` / `packet` / `harden` unchanged
