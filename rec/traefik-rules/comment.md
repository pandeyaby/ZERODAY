## ZERODAY localization (CI)

> **Human review required.** File-level localization candidates — **not** proof of exploitability. No auto-merge. No exploits, PoCs, or payloads.

| | |
|--|--|
| Advisory | `CWE-287` → `CWE-287` |
| Mode | `rules` (rules — static analysis of syntax trees; no model involved) |
| Model | `zeroday/rules-heuristics` |
| Findings | **0** ranked file(s) |
| Incomplete | no |

### Result

**Not scanned** — rules mode has no heuristics for CWE-287. The repo was not checked for this CWE; do not treat this as a clean result.

<details>
<summary>Exploration trace (2 steps)</summary>

1. **other** `rules:unsupported-cwe` — No rules pack for CWE-287; repo NOT scanned for it (not a clean negative).
2. **submit** `submit_vulnerable_files` — Not scanned: no rules for CWE-287.

</details>

### Posture

- Localization only · not exploitability proof
- SARIF uploaded at **note** severity (GitHub Code Scanning)
- Foundry Detector-lane **candidate** — true-positive waits for human triage
- Sister pieces: Foundry Security Spec · CodeGuard (compose, don’t replace)

_Powered by [ZERODAY](https://github.com/pandeyaby/ZERODAY) around Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/)._
