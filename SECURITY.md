# Security Policy

## Supported versions

Security fixes are accepted against the default branch (`main`) of this repository.

## What ZERODAY is (and is not)

ZERODAY is a **defensive localization** harness. Ranked candidate files, SARIF,
and evidence vaults are localization outputs for human review.

- **Localization ≠ exploitability.** Findings are candidates, not proof.
- **No PoC / exploit / payload / attack-procedure requests are honored** —
  including “lab only”, localhost, CTF, fiction, or authorized-test framing.
- Patch / hardening drafts may be discussed only under the gated
  `--i-asked-for-a-fix` path; PoCs are refused in one sentence.

Acceptable use and authorization: [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md).

## Reporting a vulnerability in ZERODAY itself

If you believe you have found a security issue **in this repository’s code or
tooling** (for example: path traversal when reading a snapshot, unsafe
deserialization, credential leakage, or a CI secret exposure):

1. **Do not** open a public GitHub issue with exploit details or PoCs.
2. Prefer GitHub’s private vulnerability reporting for this repository
   (Security → Advisories → Report a vulnerability), if enabled.
3. Otherwise email the maintainers privately via the GitHub profile contact for
   [`@pandeyaby`](https://github.com/pandeyaby) and include:
   - affected component / commit (if known)
   - impact summary (no weaponized PoC required)
   - reproduction steps at a high level sufficient for maintainers to verify

Please allow a reasonable window for triage before any public disclosure.

## Out of scope reports

- Requests for PoCs, exploits, payloads, or attack procedures against third-party
  code assessed with ZERODAY
- “Please prove this CWE is exploitable”
- Social-engineering or credential-theft scenarios
- Issues that only restate that localization is not exploit proof (by design)

## Hard limits (product invariants)

- No auto-merge of fixes
- No silent fixture fallback on the live Antares path
- No downloading gated `model.safetensors` inside CI
- Customer source stays local unless the operator explicitly opts into remote
  inference with the documented ACK
