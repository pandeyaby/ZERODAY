# Desk D craft

Generate-only defensive Cursor/Grok-style skills and plugin stubs from Desk B→A→C→E patterns.

```bash
# Real reports dir (zeroday-reports/ preferred, else docs/reports)
npm run zeroday -- craft
npm run zeroday -- craft --from zeroday-reports
# Fixture smoke
npm run zeroday -- craft --fixture
npm run zeroday -- skill --fixture
npm run zeroday -- plugin --fixture
```

Hard limits: no auto-install · no marketplace publish · refuses exploits, PoCs, and offensive skill patterns · Desk ≠ vuln discovery.

Sample output: [`docs/reports/desk-d-craft/`](./reports/desk-d-craft/).
