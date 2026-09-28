# ZERODAY Localization — CISO one-pager

> **Detector-lane candidate(s).** True-positive waits for human triage. Localization is **not** proof of exploitability. No auto-merge.

## What was asked

| | |
|--|--|
| Advisory | `CVE-2021-23337` → `CWE-94` |
| Title | Lodash versions prior to 4.17.21 are vulnerable to Command Injection via the template function. |
| Category | code-injection |
| Target | `/Users/abhinavpandey/Documents/GitHub/ZERODAY-mac-verify/fixtures/advisory/npm-lodash` |
| Mode | live |
| Model | `fdtn-ai/antares-1b` |
| Generated | 2026-09-28T18:52:02.134Z |

## Dependency exposure

**Verdict:** affected · advisory data: GHSA-35jh-r3h4-6jhm, GHSA-r5fr-rjxr-66jc (OSV)

| Package | Installed | Pinned in | Affected | Fixed in |
|---------|-----------|-----------|----------|----------|
| `lodash` | 4.17.15 | `package-lock.json` | **yes** | 4.17.21 |

Vulnerable functions looked for: `template`, `assignInWith`, `importsKeys`, `reForbiddenIdentifierChars`, `assignWith`

## Antares and ZERODAY's static pass

ZERODAY's static pass (3 candidate file(s), dependency verdict affected) was given to Antares as starting context; Antares explored and decided.

| | Files |
|--|--|
| Both flagged | `src/email.js` |
| Antares only | — |
| Rules only (not confirmed by Antares) | `package-lock.json:11`, `src/cart.js:1` |

## What files

| Rank | File | CWEs | Evidence | Citation |
|------|------|------|----------|----------|
| 1 | `src/email.js` | CWE-94 | Antares submitted this file as a localization candidate.; Rules agree: `template` is the vulnerable function named by GH | `ev_claim_002` |

## Evidence citations

Material claims above cite vault ids: `ev_claim_002`. Verify offline with `zeroday verify --from <run-dir>`.

## Confidence & limits

- Public **Antares-1B** File F1 is **0.209** (localization quality on the published benchmark — **not** a per-finding confidence score).
- Antares-350m File F1 is **0.135** (edge). We never claim Antares-3B.
- Antares CLI expects vLLM **0.19.1+** completions-only; ZERODAY does not claim independent “validated with vLLM 0.19.1” proof.
- Findings are **notes** for human review (SARIF severity `note` / informational exporters).
- Terminal budget: 1 / 30 exploration calls.

## Next human action

1. Open the ranked files and confirm or dismiss each candidate.
2. If a fix is warranted, run `zeroday draft-fix --i-asked-for-a-fix` (CodeGuard-aligned **DRAFT** only).
3. Open a normal reviewable PR — **never** auto-merge from ZERODAY.
4. Optionally export for your SIEM/SOAR desk: `zeroday export --format asff|splunk|xsoar|fortisiem|crowdstrike|sarif`.

## Warnings

- Live mode used the official Antares CLI (cisco-antares-cli) against a read-only snapshot.
- Inference must be POST /v1/completions only — chat completions break the Antares tool prompt.
- Model id sent to endpoint: fdtn-ai/antares-1b (default fdtn-ai/antares-1b when unset).
- Tool budget: 30 (raise with --tool-budget / ANTARES_TOOL_BUDGET when incomplete).
- Antares raw report listed ranked finding(s) without an explicit submit_* tool in the exploration trace — treating candidates as complete localization evidence (not bare no_submit). Human triage still required; no invented files.
- ZERODAY context sent to Antares (--query): 3 static candidate(s), dependency verdict affected. Antares still explores and decides; files it did not confirm are listed as rules-only.
- Read-only snapshot: 5 files at /var/folders/jl/x8gd2r3562z568_z9nzsjwz80000gn/T/zeroday-snap-oUrYlI/repo
- Sandbox active (ubuntu:24.04, network=none, mem=512m, cpus=1, timeout=10000ms)
- Local completions probe ok: GET https://zxqlprh3acxmcw-8000.proxy.runpod.net/v1/models → 200 (1 model(s))
- Resolved CVE-2021-23337 → CWE-94 (code-injection) via nvd
- Sandbox network=none isolates inspection; vLLM /v1/completions remains on the host (HF-gated weights).

## Exploration trace (analyst detail)

1. **other** `antares query` — Live Antares CLI run (trace not present in report.json; see Antares private history under ANTARES_DATA_DIR).

---

_Compose with [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) (Detector-lane candidates) and [Project CodeGuard](https://project-codeguard.org/) — do not replace them. Powered by Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/) localization._
