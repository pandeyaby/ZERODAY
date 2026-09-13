# CLI / API reference

## CLI

```bash
# MVP door (keyless, no GPU / no HF / no spend)
npm run mvp
npm run zeroday -- mvp

# Print-only live Antares checklist (never creates paid pods)
npm run zeroday -- antares doctor
bash scripts/runpod-vllm-antares.sh --print-only

# Factory loop (CI-safe)
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend
npm run zeroday -- factory inventory --repo ./app

# Live product path (requires healthy completions endpoint; CUDA/RunPod preferred; costs $)
npm run zeroday -- locate --cwe CWE-89 --repo ./app --endpoint http://127.0.0.1:8000/v1
bash scripts/quickstart-live.sh ./app CWE-89

# RunPod / remote (opt-in ACK)
npm run zeroday -- locate --cwe CWE-89 --repo ./app \
  --endpoint https://<runpod-proxy>/v1 --remote-inference

# CI / no-GPU building blocks
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
Non-loopback endpoints require `--remote-inference` or `ZERODAY_REMOTE_INFERENCE_ACK=1`.

## Local UI API (npm run play)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/health` | Health |
| GET/POST | `/api/settings` | Local prefs |
| GET/POST | `/api/playground` | Fixture locate / classify / demo |

No missions or research-lab routes.
