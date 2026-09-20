# CLI / API reference

## CLI

```bash
# MVP door (keyless, no GPU / no HF / no spend)
npm run mvp
npm run zeroday -- mvp

# Rules locate on a real authorized repo ($0 — mode=rules; not Antares F1)
npm run zeroday -- locate --cwe CWE-89 --repo ./app --rules

# SARIF ingest from a local file ($0 — mode=ingest; third-party findings)
npm run zeroday -- locate --from-sarif path/to/report.sarif
npm run zeroday -- locate --from-sarif path/to/report.sarif --cwe CWE-89

# Org CI cassette (Keyless K3 — redacted; not mvp fixtures)
npm run zeroday -- record --from zeroday-reports/org-locate --out cassette.json
npm run zeroday -- locate --recording cassette.json

# Desk on your tree (keyless — not vuln discovery; no Antares required)
npm run zeroday -- inventory
npm run zeroday -- packet
npm run zeroday -- harden
npm run zeroday -- classify --from <reports-or-locate-dir>
npm run zeroday -- craft

# Desk fixture smoke (CI)
npm run zeroday -- inventory --fixture
npm run zeroday -- packet --fixture
npm run zeroday -- harden --fixture
npm run zeroday -- classify --fixture
npm run zeroday -- craft --fixture

# Local workstation readiness (Day-1 — fail-closed; no RunPod / no network)
npm run doctor
npm run zeroday -- doctor --json

# CISO localization summary from existing prove-doors / SARIF (zeroday.report/v1)
npm run report -- --from prove-doors.json
npm run zeroday -- report --sarif fixtures/locate/ingest-sample/sample.sarif
# npm run report -- --from prove-doors.json --json --out report.json

# Print-only local OpenAI-compatible brain checklist (Keyless K4 — $0)
npm run zeroday -- doctor --local-brain
bash scripts/local-brain-doctor.sh --print-only
# Shape-only (no network); chat URLs fail closed:
npm run zeroday -- doctor --endpoint http://127.0.0.1:8000/v1

# Print-only live Antares checklist (never creates paid pods)
npm run zeroday -- antares doctor
bash scripts/runpod-vllm-antares.sh --print-only

# Factory loop (CI-safe)
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend
npm run zeroday -- factory inventory --repo ./app

# Live product path (requires healthy completions endpoint; Antares-1B recommended; any local completions host ok; costs $ when GPU/pod)
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

`--fixture`, `--rules`, `--from-sarif`, `--recording`, and `--live`/`--endpoint` are mutually exclusive (no silent mock fallback).
Non-loopback endpoints require `--remote-inference` or `ZERODAY_REMOTE_INFERENCE_ACK=1`.
Rules mode is thin in-repo heuristics — **not** Antares File F1 and **not** exploitability.
Ingest mode reads a local SARIF 2.1 file only — **not** Antares/rules discovery; no alerts API fetch.
`record --redact` (default ON, fail-closed) writes org CI cassettes; `locate --recording` replays them as `mode: "recording"`. Human reviews redaction before commit — never auto-commit / network-exfil. Org cassettes ≠ mvp fixtures.
`zeroday doctor` (default) is fail-closed local workstation readiness (`zeroday.doctor/v1`) — Node, package scripts, historical gpu-evidence, cassette fixture, prove-doors entrypoints; no RunPod / no network. Desk: `POST /api/doctor` → download `doctor.json`. `zeroday doctor --local-brain` is print-only Keyless K4: completions-only, no model download / auto-start. Arbitrary local models ≠ Antares File F1. See [`local-brain.md`](./local-brain.md).
`zeroday report` (`zeroday.report/v1`) turns existing prove-doors JSON and/or SARIF into a short CISO summary (optional historical gpu-evidence footnote); localization ≠ exploitability; `runpod: false`. Desk: `POST /api/report` → download `report.json` + `report.md`.

## Local UI API (npm run play)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/health` | Health |
| GET/POST | `/api/settings` | Local prefs |
| GET/POST | `/api/playground` | Fixture locate / classify / demo |

No missions or research-lab routes.
