# ZERODAY Localization — CISO one-pager

> **Detector-lane candidate(s).** True-positive waits for human triage. Localization is **not** proof of exploitability. No auto-merge.

## What was asked

| | |
|--|--|
| Advisory | `CWE-287` → `CWE-287` |
| Category | authentication |
| Target | `/Users/abhinavpandey/.cache/zeroday/bench-antares/GHSA-6765-c87h-8mrf` |
| Mode | live |
| Model | `fdtn-ai/antares-1b` |
| Generated | 2026-09-29T01:14:35.801Z |

## Antares and ZERODAY's static pass

Antares ran on its own; ZERODAY's static pass (0 candidate file(s)) ran separately on the same snapshot and is compared here.

| | Files |
|--|--|
| Both flagged | — |
| Antares only | `pkg/middlewares/auth/basic_auth.go`, `pkg/middlewares/auth/forward.go` |
| Rules only (not confirmed by Antares) | — |

## What files

| Rank | File | CWEs | Evidence | Citation |
|------|------|------|----------|----------|
| 1 | `pkg/middlewares/auth/basic_auth.go` | CWE-287 | Antares submitted this file as a localization candidate.; Antares ranked this file in 1 of 2 runs. | `ev_claim_002` |
| 2 | `pkg/middlewares/auth/forward.go` | CWE-287 | Antares submitted this file as a localization candidate.; Antares ranked this file in 1 of 2 runs. | `ev_claim_003` |

## Evidence citations

Material claims above cite vault ids: `ev_claim_002`, `ev_claim_003`. Verify offline with `zeroday verify --from <run-dir>`.

## Confidence & limits

- Public **Antares-1B** File F1 is **0.209** (localization quality on the published benchmark — **not** a per-finding confidence score).
- Antares-350m File F1 is **0.135** (edge). We never claim Antares-3B.
- Antares CLI expects vLLM **0.19.1+** completions-only; ZERODAY does not claim independent “validated with vLLM 0.19.1” proof.
- Findings are **notes** for human review (SARIF severity `note` / informational exporters).
- Terminal budget: 65 / 30 exploration calls.

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
- Merged 2 Antares runs by vote (--samples 2).
- Antares ran on its own; ZERODAY rules ran separately (0 candidate(s)) and are compared, not sent.
- Read-only snapshot: 2015 files at /var/folders/jl/x8gd2r3562z568_z9nzsjwz80000gn/T/zeroday-snap-mFNxRf/repo
- Sandbox active (ubuntu:24.04, network=none, mem=512m, cpus=1, timeout=10000ms)
- Local completions probe ok: GET https://8kdejcznx45ypw-8000.proxy.runpod.net/v1/models → 200 (1 model(s))
- Endpoint discovered: Using saved endpoint https://8kdejcznx45ypw-8000.proxy.runpod.net/v1 (model fdtn-ai/antares-1b; remote-inference ACK from saved Desk config)
- Resolved CWE-287 → CWE-287 (authentication) via cwe-direct
- Sandbox network=none isolates inspection; vLLM /v1/completions remains on the host (HF-gated weights).

## Exploration trace (analyst detail)

1. **other** `antares query` — Live Antares CLI run (trace not present in report.json; see Antares private history under ANTARES_DATA_DIR).
1. **other** `antares query` — Live Antares CLI run (trace not present in report.json; see Antares private history under ANTARES_DATA_DIR).

---

_Compose with [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) (Detector-lane candidates) and [Project CodeGuard](https://project-codeguard.org/) — do not replace them. Powered by Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/) localization._
