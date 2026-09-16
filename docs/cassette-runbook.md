# Cassette runbook — `record --redact` → `locate --recording`

Reproduce a prior localize in CI **without a live GPU**. Org cassettes are the
team's redacted recordings for regression — **not** mvp product fixtures under
`fixtures/locate/recordings/`.

Schema: `zeroday-org-cassette/v1` · Keyless K3 · Localization ≠ exploitability

## Flow (clone → locate → cassette → human → SARIF)

```bash
# 0. Clone / install (keyless)
git clone <authorized-zeroday> && cd ZERODAY && npm install

# 1. Real locate (pick one keyless door — or live on a workstation after spend gate)
npm run zeroday -- locate --cwe CWE-89 \
  --repo fixtures/locate/rules-sample --rules --offline \
  --output zeroday-reports/org-locate
# Also valid sources: --fixture · --from-sarif · live --endpoint (human-approved)

# 2. Record with --redact (default ON; fail-closed)
npm run zeroday -- record --from zeroday-reports/org-locate \
  --out fixtures/locate/org-recordings/rules-cwe-89.cassette.json

# 3. HUMAN reviews the cassette JSON before commit
#    - Paths repo-relative? Absolute /workspace paths gone?
#    - Secret-shaped strings stripped (sk_ / ghp_ / hf_ …)?
#    - No customer source blobs that should stay private?
#    - rankedFiles non-empty and honest (do not invent findings)?

# 4. Replay offline → same SARIF / evidence writers, mode: "recording"
npm run zeroday -- locate \
  --recording fixtures/locate/org-recordings/rules-cwe-89.cassette.json \
  --output zeroday-reports/org-replay
```

Desk Console: `npm run play` → **Reports & cassettes** — Record (redact always ON;
UI refuses `--no-redact`) → Replay. Path sandbox matches Desk commands.

## Wired org path in this repo

| Artifact | Role |
|----------|------|
| `fixtures/locate/org-recordings/rules-cwe-89.cassette.json` | Sample redacted cassette (from rules-sample) |
| `fixtures/locate/org-recordings/README.md` | Short pointer |
| CI job `locate-record` | Live record→replay + committed cassette check |
| CI job `org-path` | Composite Action `mode=rules` + `mode=recording` → SARIF |
| Action input `mode=recording` | `.github/actions/zeroday-locate-gate` |

## Hard locks

- `--redact` default **ON** — `--no-redact` refuses closed
- Absolute paths → repo-relative / `<repo>` label; secret-shaped strings stripped
- Incomplete / empty `rankedFiles` → record refuses (no empty cassette spam)
- Mixed doors refuse: `--recording` + `--rules` / `--fixture` / `--from-sarif` / `--live`
- **No** auto-commit / auto-PR / network exfil of cassettes
- **Human** reviews redaction before commit
- Replay sets honest `mode: "recording"` (not silent fixture)
- Action never accepts `mode=live` — cassette / rules / fixture only in CI

## What this is / is not

| Is | Is not |
|----|--------|
| CI regression of a prior localize | Discovery / live Antares |
| GPU-free reproducible SARIF habit | Proof of exploitability |
| Org-owned evidence under review | Replacement for `fixtures/locate/recordings/` mvp smoke |
| Input to Desk / export / verify | Auto-merge signal |

## Related

- [org-ops-runbook.md](./org-ops-runbook.md) — private org forever path
- Root README § Org CI cassettes
- [`docs/cli-api.md`](./cli-api.md) — `record` / `locate --recording`
- Soft MVP Desk UI-2 (Reports & cassettes)
