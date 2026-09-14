# ZERODAY defensive craft (Desk D)

Generate-only Cursor/Grok-style `SKILL.md` + plugin stub from Desk B→A→C→E patterns.

## One command

```bash
npm run zeroday -- craft --from docs/reports
# aliases:
npm run zeroday -- skill --fixture
npm run zeroday -- plugin --fixture
```

## Contents

| File | Role |
|------|------|
| `craft.md` | Stranger-readable craft summary |
| `craft.json` | Machine-readable manifest (`zeroday-craft-scaffold/v1`) |
| `skills/*/SKILL.md` | Defensive skill scaffold |
| `plugins/*/plugin.json` | Plugin stub (generate-only) |
| `README.md` | This file |

## Hard limits

- Generate-only — **no** auto-install / marketplace publish
- Refuses exploits, PoCs, and offensive skill patterns
- No PoC / exploit / payload (localization only)
- `npm run mvp` / `inventory` / `packet` / `harden` / `classify` unchanged
