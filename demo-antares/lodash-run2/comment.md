## ZERODAY Antares localization (CI)

> **Human review required.** File-level localization candidates — **not** proof of exploitability. No auto-merge. No exploits, PoCs, or payloads.

| | |
|--|--|
| Advisory | `CVE-2021-23337` → `CWE-94` |
| Mode | `live` (live Antares — local completions endpoint) |
| Model | `fdtn-ai/antares-1b` |
| Findings | **1** ranked file(s) |
| Incomplete | no |

### Ranked candidate files

#### 1. `src/email.js`

- **Title:** Improper Control of Generation of Code ('Code Injection')
- **CWEs:** CWE-94
- **Evidence:** `src/email.js` — Antares submitted this file as a localization candidate.
- **Evidence:** `src/email.js:4-4` — Rules agree: `template` is the vulnerable function named by GHSA-35jh-r3h4-6jhm (advisory-text). Upgrade to 4.17.21 or later. [rule advisory/vulnerable-call]

<details>
<summary>Exploration trace (1 steps)</summary>

1. **other** `antares query` — Live Antares CLI run (trace not present in report.json; see Antares private history under ANTARES_DATA_DIR).

</details>

### Posture

- Localization only · not exploitability proof
- SARIF uploaded at **note** severity (GitHub Code Scanning)
- Foundry Detector-lane **candidate** — true-positive waits for human triage
- Sister pieces: Foundry Security Spec · CodeGuard (compose, don’t replace)

_Powered by [ZERODAY](https://github.com/pandeyaby/ZERODAY) around Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/)._
