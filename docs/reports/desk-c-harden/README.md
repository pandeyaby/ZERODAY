# ZERODAY harden recommendations (Desk C)

Recommend-only agent/package hardening from Desk B inventory + Desk A packet evidence.

## One command

```bash
npm run zeroday -- harden --from docs/reports
# or Desk A packet:
npm run zeroday -- harden --from docs/reports/desk-a-packet
# optional CodeGuard-aligned draft notes (still human-gated):
npm run zeroday -- harden --from docs/reports --draft
```

## Contents

| File | Role |
|------|------|
| `harden.md` | Stranger-readable recommendations |
| `harden.json` | Machine-readable manifest (`zeroday-harden-recommendations/v1`) |
| `drafts/*.md` | Optional `--draft` CodeGuard-aligned notes |
| `README.md` | This file |

## Hard limits

- Recommend-only — **no** auto-apply / auto-PR / auto-merge
- No PoC / exploit / payload (localization only)
- Secrets redacted (names/patterns only)
- `npm run mvp` / `inventory` / `packet` unchanged
