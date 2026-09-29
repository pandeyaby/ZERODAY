# ZERODAY Desk B — inventory case note

> Fixture/static defensive inventory. Localization + evidence only. **No PoC / exploit / payload.** Secret *values* redacted; patterns/names only. Source never leaves the machine on this path.

| | |
|--|--|
| Generated | 2026-09-29T21:30:35.840Z |
| Repo | `demo-app` |
| Findings | **4** |
| Posture | inventory only · needs human · no auto-merge |

## Findings list (stranger-readable)

_No non-surface findings (secret patterns / env honesty / harness)._

## Locate hints

- `.github/workflows/ci.yml` (score 90)
- `Dockerfile` (score 80)
- `package.json` (score 70)
- `.github/CODEOWNERS` (score 65)
- `src/app.js` (score 45)
- `src/users.js` (score 45)

## Hard limits

- Inventory / localization / evidence / harden notes only
- No PoC, exploit, payload, or attack procedure
- No live Antares / RunPod spend on this desk
- Never exfiltrate source; redact secrets in exports
- `npm run mvp` remains the stranger door
