# 3-minute demo

One story: **an advisory lands → ZERODAY says whether you're exposed and which
files to read first → the same check runs on every pull request.** Everything
below runs offline from a clone, so conference Wi-Fi can't break it.

## Before you go on (10 minutes, once)

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY && npm install
export ZERODAY_OSV_DIR=fixtures/advisories/osv     # bundled advisory records → no network needed
npm run zeroday -- locate --cve CVE-2021-23337 --repo fixtures/advisory/npm-lodash --rules --offline
ZERODAY_UI_ROOTS=/path/to/your/demo-repo npm run play   # Desk on http://localhost:3333/play
```

Open three tabs: a terminal (large font), the Desk, and a pull request in a repo
that runs the Action ([`github-action.md`](./github-action.md)) showing the
ZERODAY checks and comment.

Rehearse the browser part hands-free — it fails if anything on screen is wrong:

```bash
npx playwright install chromium   # once (Playwright is a dev dependency)
ZERODAY_DEMO_REPO=/path/to/your/demo-repo ZERODAY_DEMO_CWE=CWE-502 \
  node scripts/desk-ui-advisory-demo.mjs   # screenshots → artifacts/desk-ui-demo/
```

## The script

**0:00 — The problem (20 s).**
"A CVE drops in a library you use. Two questions: *are we exposed*, and *where in
our code do I look*? Scanners give you the first as a wall of alerts; nobody
answers the second."

**0:20 — CLI (50 s).**

```bash
npm run zeroday -- locate --cve CVE-2021-23337 --repo fixtures/advisory/npm-lodash --rules --offline
```

Point at three lines:

- `Exposure : AFFECTED … lodash@4.17.15 package-lock.json → upgrade to 4.17.21` —
  read from the lockfile, not guessed from `package.json`.
- `1. src/email.js  Calls template from lodash` — the vulnerable function is
  actually called here, so this file ranks first.
- `3. src/cart.js  Imports lodash` — same package, but it never calls the
  vulnerable function, so it ranks last.

"No model, no API key, no GPU. Syntax trees plus the public OSV advisory — only
the advisory id leaves the machine."

**1:10 — Desk (50 s).** Same scan in the browser: paste `CVE-2021-23337` and
`fixtures/advisory/npm-lodash`, click **Run locate --rules**. Show the exposure
badge, then the code excerpt and the one-line reason under each file.

Then a CWE scan on a real repo (it needs to be under `ZERODAY_UI_ROOTS`). On
ML code use `CWE-502`: it flags `torch.load` without `weights_only=True`, pickle,
joblib, `numpy.load(allow_pickle=True)` and `trust_remote_code=True`. Read the
reason out loud — *"Value is built at runtime — check whether it can carry
untrusted input"* — and say that a human decides.

**2:00 — Pull request (40 s).** Switch to the PR tab. "One `uses:` line in any
repo. It scans only what the PR changed, uploads SARIF to Code Scanning, posts
this comment, and fails the check only on new findings — existing debt doesn't
block unrelated work."

**2:40 — What it is and isn't (20 s).**
"It localizes; it doesn't prove exploitability, and it never writes exploits.
Accuracy is published: OWASP Benchmark Java 57.7, Python 53.7, and you can
reproduce it with `npm run bench`. `npx zeroday-cli`, Apache-2.0."

## Likely questions

| Question | Answer |
|----------|--------|
| Is this an LLM? | Not by default. Rules mode is static analysis (tree-sitter + taint tracking). A local model is optional, for CWEs the rules don't cover. |
| How accurate? | High-confidence findings on OWASP Benchmark: Java 57.7 (80% precision, 80% recall), Python 53.7 (81% / 62%), scored TPR − FPR. The 100 on our own corpus is on cases we wrote; don't quote it alone. [`benchmark.md`](./benchmark.md) |
| vs CodeQL / Semgrep? | Complementary. ZERODAY imports their SARIF (`--from-sarif`); what it adds is advisory → lockfile → call-site ranking and a PR gate that needs no setup. |
| Why did it list every file importing torch? | For many Python / C++ libraries the advisory doesn't name the vulnerable function, so ZERODAY falls back to "files that import the package" — accurate, less precise. Go advisories and fixes that touch named functions give call sites. |
| Does my code leave the machine? | No. Advisory scans send only the advisory id to OSV; `--offline` sends nothing. |
| Languages? | JS/TS, Python, Java, Go (full engine); Ruby, PHP, C# (line heuristics, 3 CWEs). |
| Can I run the web UI for my team? | Localhost-only by default; token + host allow-list to share it — [`desk-security.md`](./desk-security.md). |

## If something breaks

- **No network:** `ZERODAY_OSV_DIR` (above) covers the lodash advisory; CWE scans
  never use the network.
- **Desk won't load:** use the CLI; a screenshot of the Desk result is
  [`images/desk-advisory.png`](./images/desk-advisory.png).
- **Port busy:** `npx next dev -H 127.0.0.1 -p 3334`, then open `/play` on that port.
