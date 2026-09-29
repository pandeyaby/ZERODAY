# ZERODAY Localization — CISO one-pager

> **Detector-lane candidate(s).** True-positive waits for human triage. Localization is **not** proof of exploitability. No auto-merge.

## What was asked

| | |
|--|--|
| Advisory | `CWE-287` → `CWE-287` |
| Category | authentication |
| Target | `/Users/abhinavpandey/.cache/zeroday/bench-antares/GHSA-6765-c87h-8mrf` |
| Mode | rules |
| Model | `zeroday/rules-heuristics` |
| Generated | 2026-09-29T01:14:03.475Z |

## What files

### Not scanned

> **Rules mode has no heuristics for CWE-287.** The repo was **not** checked for this CWE. This is **not** a clean negative.

## Confidence & limits

- **Rules mode** — thin in-repo CWE heuristics only. **Not** Antares inference and **not** Antares File F1 (**0.209**).
- Candidates for human review — localization ≠ exploitability. No Semgrep binary dependency.
- Findings are **notes** for human review (SARIF severity `note` / informational exporters).
- Terminal budget: 2 / 2 exploration calls.

## Next human action

1. Open the ranked files and confirm or dismiss each candidate.
2. If a fix is warranted, run `zeroday draft-fix --i-asked-for-a-fix` (CodeGuard-aligned **DRAFT** only).
3. Open a normal reviewable PR — **never** auto-merge from ZERODAY.
4. Optionally export for your SIEM/SOAR desk: `zeroday export --format asff|splunk|xsoar|fortisiem|crowdstrike|sarif`.

## Warnings

- Rules mode: in-repo syntax-tree analysis + heuristics — not Antares inference and not Antares File F1.
- Localization only: ranked files are candidates for human review — not proof of exploitability.
- No Semgrep binary dependency; Docker not required (CI-safe). Source code never leaves the machine; for CVE / GHSA ids only public advisory metadata is read from api.osv.dev (cached; none with --offline).
- No PoC / exploit / payload content is emitted.
- NOT SCANNED: no rules heuristics registered for CWE-287. Supported: CWE-89, CWE-79, CWE-22, CWE-78, CWE-94, CWE-502, CWE-918, CWE-611, CWE-798, CWE-601. Zero findings is not a clean negative.
- Read-only snapshot: 2015 files (destroyed after run)
- Resolved CWE-287 → CWE-287 (authentication) via cwe-direct
- Rules mode is container-free (no Docker / no Semgrep) — CI-safe keyless localize.

## Exploration trace (analyst detail)

1. **other** `rules:unsupported-cwe` — No rules pack for CWE-287; repo NOT scanned for it (not a clean negative).
2. **submit** `submit_vulnerable_files` — Not scanned: no rules for CWE-287.

---

_Compose with [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) (Detector-lane candidates) and [Project CodeGuard](https://project-codeguard.org/) — do not replace them. Powered by Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/) localization._
