# Use ZERODAY in your GitHub Actions

The `zeroday-locate-gate` Action scans **your** repository with `locate --rules`,
uploads SARIF to GitHub Code Scanning and posts a reviewable PR comment. It
brings its own ZERODAY: you do not check ZERODAY out or install anything.

Findings are localization candidates for human review — never proof of
exploitability, never auto-merged, no exploit content.

## Pull requests: block only what the PR introduces

```yaml
# .github/workflows/zeroday.yml
name: ZERODAY
on: pull_request

permissions:
  contents: read
  security-events: write   # SARIF upload
  pull-requests: write     # PR comment

jobs:
  zeroday:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        cwe: [CWE-89, CWE-79, CWE-22, CWE-78, CWE-918]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0             # changed-since needs history

      - uses: pandeyaby/ZERODAY/.github/actions/zeroday-locate-gate@v0.11.0
        with:
          mode: rules
          repo: .
          cwe: ${{ matrix.cwe }}
          output: zeroday-reports/${{ matrix.cwe }}
          changed-since: origin/${{ github.base_ref }}
          sarif-category: zeroday-${{ matrix.cwe }}
          fail-on-findings: "true"
```

`changed-since` keeps findings in files the PR changed (plus findings whose
request input comes from a changed file), so existing debt does not block
unrelated work.

## Adopting on a codebase with existing findings: a baseline

Record today's findings once and commit the report:

```bash
npx zeroday-cli locate --cwe CWE-89 --repo . --rules --offline --output .zeroday/CWE-89
git add .zeroday/CWE-89/report.json
```

Then gate on new findings only:

```yaml
      - uses: pandeyaby/ZERODAY/.github/actions/zeroday-locate-gate@v0.11.0
        with:
          mode: rules
          repo: .
          cwe: CWE-89
          baseline: .zeroday/CWE-89/report.json
          fail-on-findings: "true"   # counts only findings not in the baseline
```

Fingerprints ignore line-number shifts, so edits elsewhere in a file do not turn
an old finding into a new one. SARIF results carry `baselineState` (`new` /
`unchanged`).

## An advisory just landed: which files matter?

```yaml
on:
  workflow_dispatch:
    inputs:
      advisory:
        description: CVE-… or GHSA-… id
        required: true

jobs:
  exposure:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    steps:
      - uses: actions/checkout@v4
      - uses: pandeyaby/ZERODAY/.github/actions/zeroday-locate-gate@v0.11.0
        with:
          mode: rules
          repo: .
          advisory: ${{ inputs.advisory }}
          post-comment: "false"
          sarif-category: zeroday-advisory
```

ZERODAY reads the public advisory from [OSV](https://osv.dev) (only the id is
sent — never your code), checks the pinned versions in your lockfiles, and ranks
calls to the vulnerable functions above plain imports and the lockfile entry to
bump. Set `offline: "true"` to never fetch.

## Inputs

| Input | Default | Meaning |
|-------|---------|---------|
| `mode` | `fixture` | `rules` for your code · `fixture` bundled demo · `recording` cassette replay. Live inference is never allowed in the Action. |
| `repo` | bundled demo | Path to scan, relative to your workspace (`.`). |
| `cwe` | `CWE-89` | One of the 10 rules-mode CWEs ([list](../README.md#what-it-covers)). An unsupported CWE fails closed (exit 2). |
| `advisory` | — | `CVE-…` / `GHSA-…`: dependency matching + the advisory's CWE rules. |
| `changed-since` | — | Git ref; keep findings in changed files. |
| `baseline` | — | Earlier `report.json`; mark findings new / unchanged. |
| `fail-on-findings` | `false` | Fail the job when there are (new) findings — after SARIF + comment are published. |
| `offline` | `auto` | `auto`: CWE scans never fetch; advisory scans read OSV metadata. `true`: never fetch. |
| `upload-sarif` / `post-comment` | `true` | Code Scanning upload / PR comment (fail-closed on `pull_request`). |
| `output` | `zeroday-reports/ci` | Report directory in your workspace. |

Outputs: `sarif-path`, `comment-path`, `finding-count`, `new-finding-count`, `locate-mode`.

Pin the Action to a release tag (`@v0.11.0`). It runs the matching published
`zeroday-cli` package; an unreleased ref installs from the Action's own copy.
