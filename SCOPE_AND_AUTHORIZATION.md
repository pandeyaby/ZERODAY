# SCOPE AND AUTHORIZATION — Defensive localization & evidence audit

ZERODAY is a **defensive** security operator harness. It turns an existing AI
coding agent (or optional local Antares) into a structured, auditable localization
workflow for authorized codebases.

## What is in scope

1. **Localization** — Given a CWE / CVE / GHSA and a local repository you are
   authorized to assess, produce ranked candidate files with evidence quotes.
2. **Evidence audit** — Every material claim links to hashed, reviewable artifacts
   (JSON + Markdown + SARIF + vendor projections) under `zeroday-reports/<run>/`.
3. **Human review** — `needs_human` is always required. Localization is **not**
   proof of exploitability. No auto-merge.
4. **Vendor projections (local files)** — SARIF, ASFF, Splunk CIM, XSOAR,
   FortiSIEM, CrowdStrike HEC-shaped NDJSON for **customer-owned** ingest.

## What is out of scope

- Exploits, PoCs, payloads, shellcode, attack procedures (even localhost / lab / fiction)
- Network scanning, credential theft, access bypass
- Live vendor API pushes or bundled cloud credentials
- Cloud inference of customer source
- Auto-merge or “CodeGuard-approved” claims
- Red / purple team engagement theater, offensive mission UIs, mutation labs, jailbreak packs

If asked for a fix **and** a PoC: emit only a gated patch **DRAFT**
(`--i-asked-for-a-fix`) and **refuse the PoC in one sentence**.

## Authorization

Only run ZERODAY against repositories and systems you own or have explicit written
permission to assess. Unauthorized targeting is illegal. Responsibility rests with
the operator.

## Default path (keyless)

```
zeroday operate --repo <path> --cwe CWE-89
```

The coding agent already running the tool explores a read-only snapshot and
submits structured JSON. No Antares HF token. No vendor API keys.

Optional `--live` Antares (`zeroday locate --endpoint …`) requires an operator-hosted
completions-only endpoint for `fdtn-ai/antares-1b`. ZERODAY never downloads
`model.safetensors` and never pulls gated weights in CI.

## Evidence

- Vault: `zeroday-reports/<run-id>/evidence/`
- Manifest: `evidence/manifest.json` (SHA-256 of inputs, submission, outputs)
- Offline check: `zeroday verify --from <run-dir>`
