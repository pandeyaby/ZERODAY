# ZERODAY Localization — CISO one-pager

> **Detector-lane candidate(s).** True-positive waits for human triage. Localization is **not** proof of exploitability. No auto-merge.

## What was asked

| | |
|--|--|
| Advisory | `CWE-89` → `CWE-89` |
| Title | Improper Neutralization of Special Elements used in an SQL Command |
| Category | sql-injection |
| Target | `/workspace/fixtures/locate/demo-app` |
| Mode | fixture |
| Model | `fixture/antares-1b-recorded` |
| Generated | 2026-09-10T21:46:43.493Z |

## What files

| Rank | File | CWEs | Evidence | Citation |
|------|------|------|----------|----------|
| 1 | `src/users.js` | CWE-89 | User-controlled `name` is concatenated into a SQL string before db.query. | `ev_claim_002` |
| 2 | `src/app.js` | CWE-89 | HTTP query `name` flows into findUserByName without neutralization. | `ev_claim_003` |

## Evidence citations

Material claims above cite vault ids: `ev_claim_002`, `ev_claim_003`. Verify offline with `zeroday verify --from <run-dir>`.

## Confidence & limits

- Public **Antares-1B** File F1 is **0.209** (localization quality on the published benchmark — **not** a per-finding confidence score).
- Antares-350m File F1 is **0.135** (edge). We never claim Antares-3B.
- Antares CLI expects vLLM **0.19.1+** completions-only; ZERODAY does not claim independent “validated with vLLM 0.19.1” proof.
- Findings are **notes** for human review (SARIF severity `note` / informational exporters).
- Terminal budget: 6 / 15 exploration calls.

## Next human action

1. Open the ranked files and confirm or dismiss each candidate.
2. If a fix is warranted, run `zeroday draft-fix --i-asked-for-a-fix` (CodeGuard-aligned **DRAFT** only).
3. Open a normal reviewable PR — **never** auto-merge from ZERODAY.
4. Optionally export for your SIEM/SOAR desk: `zeroday export --format asff|splunk|xsoar|fortisiem|crowdstrike|sarif`.

## Warnings

- Fixture mode: results come from a recorded Antares-style localization, not live model inference.
- Read-only snapshot: 5 files (destroyed after run)
- Resolved CWE-89 → CWE-89 (sql-injection) via vendored
- Fixture mode is container-free (no Docker) — CI-safe.
- Live Antares CLI not on PATH. Install the official CLI from PyPI: `uv tool install cisco-antares-cli` then ensure `$(uv tool dir --bin)` is on PATH. Model weights stay gated — accept Cisco terms on https://huggingface.co/fdtn-ai/antares-1b and serve locally with vLLM 0.19.1+ (`vllm serve fdtn-ai/antares-1b`) exposing POST /v1/completions. Do not use /v1/chat/completions. Do not clone antares-cli onto operator machines — install from PyPI.

## Exploration trace (analyst detail)

1. **find** `find . -type f -name '*.js'` — Listed JavaScript sources under the read-only snapshot.
2. **grep** `grep -Rni 'SELECT' .` — Found SQL-like strings in src/users.js.
3. **grep** `grep -Rni 'query' src/` — Correlated db.query call sites with string concatenation.
4. **cat** `cat src/users.js` — Read findUserByName; confirmed unparameterized SQL construction.
5. **cat** `cat src/app.js` — Confirmed request input reaches the unsafe helper.
6. **submit** `submit_vulnerable_files` — Submitted src/users.js (rank 1) and src/app.js (rank 2).

---

_Compose with [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) (Detector-lane candidates) and [Project CodeGuard](https://project-codeguard.org/) — do not replace them. Powered by Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/) localization._
