# Stability contract

From **0.7.0**, part of ZERODAY is a stable surface you can build scripts and CI
on. Everything else is marked experimental and may change in any 0.x release.

## Stable

| Command | What is stable |
|---------|----------------|
| `zeroday locate` | Flags `--cwe` `--cve` `--ghsa` `--map-cwe` `--repo` `--rules` `--live` `--samples` `--endpoint` `--model` `--remote-inference` `--from-sarif` `--fixture` `--offline` `--output` `--json` `--fail-on-findings` `--baseline` `--changed-since`; output files below; exit codes |
| `zeroday scan` | Flags `--repo` `--output` `--max-cwes` `--cwe` `--rules-only` `--samples` `--require-antares` `--endpoint` `--model` `--remote-inference` `--json`; `report.json` / `report.sarif` / `report.md` / `evidence/`; exit codes |
| `zeroday antares up` / `down` / `status` | `up`: `--max-minutes` `--gpu` `--model` `--yes`; the pod is always capped and deleted at `--max-minutes`; keys are read from `RUNPOD_API_KEY` / `HF_TOKEN` and never written to disk. Exit codes |
| `zeroday verify` | `--from <dir>`; PASS / FAIL result and exit code |
| `zeroday operate` | `--cwe` `--repo` `--emit-brief` `--from` `--output` `--fixture`; submission schema `zeroday-operator-submission/v1` |
| `zeroday doctor` | `--json` `--out`; `zeroday.doctor/v1` JSON |
| `zeroday mvp` | Runs and prints PASS / FAIL (self-test) |

Endpoint discovery for `locate --live` / `scan` (environment → saved endpoint →
local vLLM / Ollama / LM Studio) is stable in what it looks at; the order may
gain new sources. A non-loopback endpoint always needs `--remote-inference` (or
`ZERODAY_REMOTE_INFERENCE_ACK=1`), because repository content is sent to it.

`zeroday --help` lists these under **Core commands (stable)**.

### Output files (`locate` / `scan --output <dir>`)

| File | Contract |
|------|----------|
| `report.sarif` | SARIF 2.1.0. `runs[0].tool.driver.version` is the ZERODAY version |
| `report.json` | Format `zeroday.report/v1` (the `schema` field), JSON Schema: [`schemas/zeroday.report.v1.schema.json`](./schemas/zeroday.report.v1.schema.json). Also written by `scan` (adds `summary.scan`) and `operate --from`. New optional fields may be added; required fields are not removed or retyped within v1. Ignore fields you don't know. Every report ZERODAY's tests produce is validated against the schema |
| `report.md`, `comment.md` | Human-readable; wording may change |
| `evidence/manifest.json` | Hash manifest checked by `zeroday verify` |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Completed (`verify`: all hashes match) |
| `1` | `locate`: candidates found and `--fail-on-findings` was set (with `--baseline`: new candidates only) · `verify`: FAIL (hash or schema mismatch) · `antares up`: cancelled at the prompt |
| `2` | Not scanned (rules mode has no rules for the CWE), incomplete live run, Antares required but unavailable, or error |

### GitHub Action

`pandeyaby/ZERODAY/.github/actions/zeroday-locate-gate@vX.Y.Z` inputs and outputs
documented in [`github-action.md`](./github-action.md) follow the same rules.

## Experimental

`locate --context` / `scan --context` (sending the rules findings to Antares;
it did not help in the [benchmark](./antares-benchmark.md)), `antares doctor`,
and every other command (`factory`, `inventory`, `paired-probe`, `prove-doors`,
`report`, `evidence-pack`, the Desk web UI and its HTTP API, …) can change or be
removed in any minor release. `zeroday --help` lists them under
**Advanced / experimental commands**.

## Changes to the stable surface

- **Before 1.0:** a breaking change to anything above ships in a new minor
  version (0.8, 0.9, …), is listed under **Breaking** in
  [`CHANGELOG.md`](../CHANGELOG.md), and — where practical — keeps working with a
  deprecation warning for one minor release first.
- **From 1.0:** breaking changes only in a new major version.

## Release integrity

Release artifacts (Docker image, CLI tarball, SBOMs) are signed or attested by
the release workflow; how to check them: [`verify-release.md`](./verify-release.md).
This is part of the stable surface: later releases keep shipping them.
