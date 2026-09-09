# CLI / API reference

## CLI

```bash
# Live product path (requires healthy local completions endpoint)
npm run zeroday -- locate --cwe CWE-89 --repo ./app --endpoint http://127.0.0.1:8000/v1
bash scripts/quickstart-live.sh ./app CWE-89

# CI / no-GPU
npm run zeroday -- operate --cwe CWE-89 --fixture
npm run zeroday -- verify --from zeroday-reports/<run>
npm run zeroday -- locate --cwe CWE-89 --fixture

npm run zeroday -- classify --scenario possible_breach
npm run zeroday -- demo
npm run zeroday -- export --format asff --from path/to/report.json
npm run zeroday -- draft-fix --i-asked-for-a-fix --from path/to/report.json
npm run zeroday -- play --action locate
npm run zeroday -- sweep --endpoint http://127.0.0.1:8000/v1
```

`--fixture` cannot be combined with `--live` / `--endpoint` (no silent mock fallback).

## Local UI API (npm run play)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/health` | Health |
| GET/POST | `/api/settings` | Local prefs |
| GET/POST | `/api/playground` | Fixture locate / classify / demo |

No missions or research-lab routes.
