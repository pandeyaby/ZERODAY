# CLI / API reference

## CLI

```bash
npm run zeroday -- operate --cwe CWE-89 --fixture
npm run zeroday -- verify --from zeroday-reports/<run>
npm run zeroday -- locate --cwe CWE-89 --fixture
npm run zeroday -- classify --scenario possible_breach
npm run zeroday -- demo
npm run zeroday -- export --format asff --from path/to/report.json
npm run zeroday -- draft-fix --i-asked-for-a-fix --from path/to/report.json
npm run zeroday -- play --action locate
npm run zeroday -- sweep   # TODO stub — use operate/locate first
```

## Local UI API (npm run play)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/health` | Health |
| GET/POST | `/api/settings` | Local prefs |
| GET/POST | `/api/playground` | Fixture locate / classify / demo |

No missions, stego, or Plinius routes.
