# ZERODAY security packet (Desk A)

Offline packet for sharing inventory localization findings with a security team.

## One command

```bash
npm run zeroday -- packet --from docs/reports
# or after inventory:
npm run zeroday -- packet --from zeroday-reports/desk-b-inventory
```

## Contents

| File | Role |
|------|------|
| `summary.md` | Stranger-readable rollup |
| `findings.json` / `findings.md` | Classified findings list |
| `packet.json` | Machine-readable manifest (`zeroday-security-packet/v1`) |
| `*.sarif` | Copied inventory SARIF path(s) |
| `README.md` | This file |

## Labels

`agent-misfire` · `config` · `dependency` · `unknown` — assigned only when Desk B inventory kind evidence maps; otherwise `unknown` (no guessing).

## Hard limits

- Generate only — **no** Slack / GH / email auto-send
- No PoC / exploit / payload (localization only)
- Secrets redacted (names/patterns only)
- `npm run mvp` unchanged as the stranger door
