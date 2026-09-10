## ZERODAY Antares localization (CI)

> **Human review required.** File-level localization candidates — **not** proof of exploitability. No auto-merge. No exploits, PoCs, or payloads.

| | |
|--|--|
| Advisory | `CWE-89` → `CWE-89` |
| Mode | `fixture` (fixture CI / no-GPU — recorded localization, not live weights) |
| Model | `fixture/antares-1b-recorded` |
| Findings | **2** ranked file(s) |
| Incomplete | no |

### Ranked candidate files

#### 1. `src/users.js`

- **Title:** SQL query built via string concatenation
- **CWEs:** CWE-89
- **Evidence:** `src/users.js:8-10` — User-controlled `name` is concatenated into a SQL string before db.query.

#### 2. `src/app.js`

- **Title:** Request parameter passed to unsafe finder
- **CWEs:** CWE-89
- **Evidence:** `src/app.js:7-9` — HTTP query `name` flows into findUserByName without neutralization.

<details>
<summary>Exploration trace (6 steps)</summary>

1. **find** `find . -type f -name '*.js'` — Listed JavaScript sources under the read-only snapshot.
2. **grep** `grep -Rni 'SELECT' .` — Found SQL-like strings in src/users.js.
3. **grep** `grep -Rni 'query' src/` — Correlated db.query call sites with string concatenation.
4. **cat** `cat src/users.js` — Read findUserByName; confirmed unparameterized SQL construction.
5. **cat** `cat src/app.js` — Confirmed request input reaches the unsafe helper.
6. **submit** `submit_vulnerable_files` — Submitted src/users.js (rank 1) and src/app.js (rank 2).

</details>

### Posture

- Localization only · not exploitability proof
- SARIF uploaded at **note** severity (GitHub Code Scanning)
- Foundry Detector-lane **candidate** — true-positive waits for human triage
- Sister pieces: Foundry Security Spec · CodeGuard (compose, don’t replace)

_Powered by [ZERODAY](https://github.com/pandeyaby/ZERODAY) around Cisco Foundation AI [Antares](https://cisco-foundation-ai.github.io/antares/)._
