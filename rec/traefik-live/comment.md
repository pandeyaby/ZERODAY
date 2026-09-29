## ZERODAY Antares localization (CI)

> **Human review required.** File-level localization candidates — **not** proof of exploitability. No auto-merge. No exploits, PoCs, or payloads.

| | |
|--|--|
| Advisory | `CWE-287` → `CWE-287` |
| Mode | `live` (live Antares — local completions endpoint) |
| Model | `fdtn-ai/antares-1b` |
| Findings | **2** ranked file(s) |
| Incomplete | no |

### Ranked candidate files

#### 1. `pkg/middlewares/auth/basic_auth.go`

- **Title:** Improper Authentication
- **CWEs:** CWE-287
- **Evidence:** `pkg/middlewares/auth/basic_auth.go` — Antares submitted this file as a localization candidate.
- **Evidence:** `pkg/middlewares/auth/basic_auth.go` — Antares ranked this file in 1 of 2 runs.

#### 2. `pkg/middlewares/auth/forward.go`

- **Title:** Improper Authentication
- **CWEs:** CWE-287
- **Evidence:** `pkg/middlewares/auth/forward.go` — Antares submitted this file as a localization candidate.
- **Evidence:** `pkg/middlewares/auth/forward.go` — Antares ranked this file in 1 of 2 runs.

<details>
<summary>Exploration trace (2 steps)</summary>

1. **other** `antares query` — Live Antares CLI run (trace not present in report.json; see Antares private history under ANTARES_DATA_DIR).
1. **other** `antares query` — Live Antares CLI run (trace not present in report.json; see Antares private history under ANTARES_DATA_DIR).

</details>

### Posture

- Localization only · not exploitability proof
- SARIF uploaded at **note** severity (GitHub Code Scanning)
- Foundry Detector-lane **candidate** — true-positive waits for human triage
- Sister pieces: Foundry Security Spec · CodeGuard (compose, don’t replace)

_Powered by [ZERODAY](https://github.com/pandeyaby/ZERODAY) around Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/)._
