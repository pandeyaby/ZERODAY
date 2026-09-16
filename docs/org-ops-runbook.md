# Org ops runbook — private clone → locate → SARIF

Short daily-driver path for a **private org / design-partner** team that wants
ZERODAY left on forever in CI and on the workstation — without inventing
findings, without auto-merge, and without silent GPU spend.

> Localization ≠ exploitability. Human in the loop. No PoC / exploit / payload.
> Action default is **keyless**. Live Antares is **opt-in** and human-gated.

## Prerequisites

| Need | Notes |
|------|--------|
| Authorized local / private clone | You own or are authorized to assess the tree ([`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md)) |
| Node 20+ | `npm install` / `npm ci` |
| GitHub Code Scanning (optional) | For SARIF upload; Action uses `security-events: write` |
| **No** HF token / GPU for the default path | Fixture, rules, ingest, cassette replay are $0 |
| Human for live spend | GPU / RunPod / remote inference only after explicit approval |

## Two doors (honest)

| Door | When | Cost | CI? |
|------|------|------|-----|
| **Keyless** | Default forever path | $0 | Yes — Action default |
| **Live Antares / local brain** | Analyst workstation after spend gate | Your GPU / pod | **No** — never default CI |

Keyless doors (compose existing Soft MVP pieces):

1. `locate --fixture` / `npm run mvp` — smoke shape
2. `locate --rules` — thin heuristics on an authorized `--repo` / PR checkout
3. `locate --from-sarif` — ingest a local SARIF file
4. `record --redact` → `locate --recording` — org cassette replay ([cassette runbook](./cassette-runbook.md))

Live door (opt-in only):

```bash
npm run zeroday -- doctor            # local brain checklist — $0, print-only
npm run zeroday -- antares doctor    # Antares / RunPod checklist — $0, print-only
# Human approves GPU / pod, then:
npm run zeroday -- locate --repo /path/to/authorized/repo --cwe CWE-89 \
  --endpoint http://127.0.0.1:8000/v1
# Non-loopback also needs --remote-inference / ZERODAY_REMOTE_INFERENCE_ACK=1
```

Never auto-provision RunPod. Never scrape HF. Never silent fixture fallback on the live path.
Do **not** claim Antares File F1 for arbitrary Ollama models or for `--rules`.

## Forever CI path (recommended)

Leave [`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml)
on in this repo (fixture + org-path jobs), **or** copy
[`examples/ops/zeroday-org-locate.yml`](../examples/ops/zeroday-org-locate.yml)
into a consumer private repo.

Composite Action: [`.github/actions/zeroday-locate-gate`](../.github/actions/zeroday-locate-gate/)

| `mode` input | What it runs | SARIF `mode` |
|--------------|--------------|--------------|
| `fixture` (default) | `locate --fixture` | `fixture` |
| `rules` | `locate --rules --offline` on `repo` | `rules` |
| `recording` | `locate --recording <cassette>` | `recording` |
| `live` / `endpoint` | **Refused** | — |

On `pull_request`:

1. Checkout the PR / snapshot (diff listed for context only)
2. Keyless locate → `report.sarif` + `comment.md`
3. Upload SARIF to Code Scanning (note severity)
4. Post / update a fail-closed PR comment with ranked candidates
5. **Never** auto-merge

Optional: set repository variable `ZERODAY_FAIL_ON_FINDINGS=true` to fail the job
after publish when candidates exist (still not exploit proof).

## Workstation Desk path (keyless)

```bash
git clone <your-private-zeroday-or-fork> && cd ZERODAY
npm install
npm run play   # Desk Console — Reports & cassettes, Live brain (spend-gated)
# or headless:
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/app --rules
npm run zeroday -- inventory --repo /path/to/authorized/app
npm run zeroday -- packet && npm run zeroday -- harden
```

Desk is config inventory / packet / harden / classify / craft — **not** vuln discovery.
Use locate doors above for localization candidates.

## Spend gates (human must approve GPU)

| Gate | Behavior |
|------|----------|
| Action / CI | No `--endpoint`, no RunPod, no HF pull |
| `doctor` / `antares doctor` | Print-only checklists — $0 |
| Desk **Live brain** | Spend banner + remote-inference checkbox before locate |
| Live CLI | Explicit `--endpoint`; remote needs ACK env / flag |
| RunPod scripts | `--print-only` available; you create and terminate pods |

## Posture (non-negotiable)

- Localization **only** — ranked files are candidates for human review
- `needs_human: true` — never invent findings; never claim exploitability
- **No** PoC / exploit / payload / attack procedure
- **No** auto-merge; patch drafts only with `--i-asked-for-a-fix`
- **No** public flip of private customer source
- **No** fake metrics / F1 claims for rules, ingest, cassette, or arbitrary local models
- Org cassettes require human redaction review before commit ([cassette runbook](./cassette-runbook.md))

## Quick links

| Doc | Why |
|-----|-----|
| [cassette-runbook.md](./cassette-runbook.md) | `record --redact` → replay without live GPU |
| [agent-operator.md](./agent-operator.md) | Keyless coding-agent handoff |
| [local-brain.md](./local-brain.md) | Any local completions host (honest ≠ Antares F1) |
| [runpod-antares.md](./runpod-antares.md) | Opt-in remote CUDA (human provisions) |
| [faq.md](./faq.md) | Keyless Strength honesty |
| [howto.md](./howto.md) | Person + org habits |
| Root [README.md](../README.md) | Full surface map |
