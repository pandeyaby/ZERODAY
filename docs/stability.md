# Stability contract

From **0.7.0**, part of ZERODAY is a stable surface you can build scripts and CI
on. Everything else is marked experimental and may change in any 0.x release.

## Stable

| Command | What is stable |
|---------|----------------|
| `zeroday locate` | Flags `--cwe` `--cve` `--ghsa` `--map-cwe` `--repo` `--rules` `--from-sarif` `--endpoint` `--fixture` `--offline` `--output` `--json` `--fail-on-findings`; output files below; exit codes |
| `zeroday verify` | `--from <dir>`; PASS / FAIL result and exit code |
| `zeroday operate` | `--cwe` `--repo` `--emit-brief` `--from` `--output` `--fixture`; submission schema `zeroday-operator-submission/v1` |
| `zeroday doctor` | `--json` `--out`; `zeroday.doctor/v1` JSON |
| `zeroday mvp` | Runs and prints PASS / FAIL (self-test) |

`zeroday --help` lists these under **Core commands (stable)**.

### Output files (`locate --output <dir>`)

| File | Contract |
|------|----------|
| `report.sarif` | SARIF 2.1.0. `runs[0].tool.driver.version` is the ZERODAY version |
| `report.json` | `LocalizationResult` — fields in [`src/locate/types.ts`](../src/locate/types.ts). New optional fields may be added; existing fields are not removed or retyped |
| `report.md`, `comment.md` | Human-readable; wording may change |
| `evidence/manifest.json` | Hash manifest checked by `zeroday verify` |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Completed (`verify`: all hashes match) |
| `1` | `locate`: candidates found and `--fail-on-findings` was set · `verify`: FAIL (hash or schema mismatch) |
| `2` | Not scanned (rules mode has no rules for the CWE), incomplete live run, or error |

## Experimental

Every other command (`factory`, `inventory`, `paired-probe`, `prove-doors`,
`report`, `evidence-pack`, the Desk web UI and its HTTP API, …) can change or be
removed in any 0.x release. `zeroday --help` lists them under
**Advanced / experimental commands**.

## Changes to the stable surface

- **Before 1.0:** a breaking change to anything above ships in a new minor
  version (0.8, 0.9, …), is listed under **Breaking** in
  [`CHANGELOG.md`](../CHANGELOG.md), and — where practical — keeps working with a
  deprecation warning for one minor release first.
- **From 1.0:** breaking changes only in a new major version.
