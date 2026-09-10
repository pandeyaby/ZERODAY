# SCOPE AND AUTHORIZATION — Localization & Evidence Defense Factory

ZERODAY is a **defensive** Localization & Evidence Defense Factory. It turns an
existing AI coding agent (or optional Antares on local/Nebius CUDA) into a
structured, auditable localization workflow for authorized codebases.

## What is in scope

1. **Factory loop** — inventory → locate → classify → ownership route →
   human-gated CodeGuard draft → defend-only checks → verify-after-merge marker.
2. **Localization** — Given a CWE / CVE / GHSA and a local repository you are
   authorized to assess, produce ranked candidate files with evidence quotes.
3. **Evidence audit** — Every material claim links to hashed, reviewable artifacts
   (JSON + Markdown + SARIF + vendor projections) under `zeroday-reports/<run>/`.
4. **Human review** — `needs_human` is always required. Localization is **not**
   proof of exploitability. No auto-merge.
5. **Vendor projections (local files)** — SARIF, ASFF, Splunk CIM, XSOAR,
   FortiSIEM, CrowdStrike HEC-shaped NDJSON for **customer-owned** ingest.
6. **Opt-in Nebius / remote CUDA** — only with `--remote-inference` /
   `ZERODAY_REMOTE_INFERENCE_ACK` for authorized orgs (see `docs/nebius-antares.md`).

## What is out of scope (KEEP forever)

- Exploits, PoCs, payloads, shellcode, attack procedures, attack-path chaining
  (even localhost / lab / fiction)
- Vulnerability reproduction or exploit confirmation harnesses
- Network scanning, credential theft, access bypass
- Live vendor API pushes or bundled cloud credentials
- Cloud / remote inference of customer source **without** explicit operator ACK
- Auto-merge or “CodeGuard-approved” claims
- Red / purple team engagement theater, offensive mission UIs, mutation labs,
  jailbreak packs, covert-channel tooling, attack-chain product surfaces

If asked for a fix **and** a PoC: emit only a gated patch **DRAFT**
(`--i-asked-for-a-fix`) and **refuse the PoC in one sentence**.

## Authorization

Only run ZERODAY against repositories and systems you own or have explicit written
permission to assess. Unauthorized targeting is illegal. Responsibility rests with
the operator.

## Default path (keyless / local-first)

```
zeroday factory run --repo <path> --cwe CWE-89 --fixture
zeroday operate --repo <path> --cwe CWE-89
```

The coding agent already running the tool explores a read-only snapshot and
submits structured JSON. No Antares HF token. No vendor API keys. No Nebius.

Optional live Antares (`zeroday locate --endpoint …`) requires an operator-hosted
completions-only endpoint for `fdtn-ai/antares-1b` (CUDA/Nebius preferred; Mac MPS
unsupported for schema-faithful tools). Non-loopback endpoints require
`--remote-inference`. ZERODAY never downloads `model.safetensors` and never pulls
gated weights in CI.

## Evidence

- Vault: `zeroday-reports/<run-id>/evidence/`
- Manifest: `evidence/manifest.json` (SHA-256 of inputs, submission, outputs)
- Offline check: `zeroday verify --from <run-dir>`
- Factory summary: `factory.json` / `factory.md`
