# Design-partner trust pack (honest private dry-run)

One-pager for **private** design partners who want to run Desk / keyless locate
without treating this repo as world-public ready. Not a brochure. Not outreach.

**Audience:** invited operators with access to this private clone.  
**Posture:** localization + evidence + Desk around [Cisco Antares](https://cisco-foundation-ai.github.io/antares/). **Not a Cisco product.**

---

## What ZERODAY does

| Surface | Honest job |
|---------|------------|
| **Locate / operate** | CWE / CVE / GHSA → ranked candidate files + hashed evidence + SARIF |
| **Desk** | Keyless loop on *your* tree: `inventory` → `packet` → `harden` → `classify` → `craft` (config / packet / recommend-only / classify / craft — **not** vuln discovery) |
| **Evidence** | Offline vault + `verify` hashes; exporters write **local files only** |
| **CI default** | Fixture / keyless smoke → SARIF → human-reviewed PR comment |

Localization is detector-lane **candidates**. Always `needs_human: true`.

---

## What it does **not** do

- No PoCs, exploits, payloads, or attack procedures (lab / localhost framing included)
- No auto-merge, auto-PR, auto-apply harden, or auto-install craft artifacts
- No public File-F1 marketing claims for fixture / rules / ingest / recording / arbitrary local models
- No auto GPU / RunPod spend — print-only doctors; **you** provision and terminate
- No silent fixture fallback on the live `--endpoint` path
- No world-public readiness claim — **this repo may stay private**

---

## How to run (private dry-run)

### Keyless (preferred partner start — $0)

```bash
npm install
npm run mvp                          # fixture → SARIF; no HF / no GPU
npm run play                         # Desk Console → http://localhost:3333/play
npm run zeroday -- inventory         # Desk on your authorized tree
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized-repo --rules
```

Also keyless: SARIF ingest (`locate --from-sarif`), org cassette replay
(`record --redact` → `locate --recording`), and `operate --emit-brief` for a
coding-agent handoff. Fixtures and cassettes prove **shape**, not Antares F1.

### Live Antares (opt-in — human spend yes)

1. Accept HF gated terms for `fdtn-ai/antares-1b` yourself (never scrape / bypass).
2. Host completions (`POST /v1/completions`) on CUDA/vLLM (or documented RunPod Secure A40).
3. Print-only first: `npm run zeroday -- antares doctor` (and `doctor` for local Ollama/vLLM/LM Studio).
4. Only then: `locate --endpoint …` (non-loopback needs `--remote-inference` / `ZERODAY_REMOTE_INFERENCE_ACK=1`).

ZERODAY never downloads `model.safetensors` and never auto-provisions pods.
Arbitrary local models ≠ Antares File F1. See [`antares.md`](./antares.md),
[`runpod-antares.md`](./runpod-antares.md), [`local-brain.md`](./local-brain.md).

---

## Ops runbooks

On current `main` (Ops package merged):

| Path | Role |
|------|------|
| [`docs/org-ops-runbook.md`](./org-ops-runbook.md) | Org daily-driver: keyless vs live, spend gates, no auto-merge |
| [`docs/cassette-runbook.md`](./cassette-runbook.md) | Record / redact / replay org cassettes for CI |
| [`examples/ops/zeroday-org-locate.yml`](../examples/ops/zeroday-org-locate.yml) | Copy-paste consumer Action (fixture / rules / recording — no live GPU in CI) |

Also: root [`README.md`](../README.md) (MVP / Desk / Honesty) and
[`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml).

---

## Security & support surface

| Need | Where |
|------|--------|
| Acceptable use / authorization | [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md) |
| Product hard limits + reporting a bug **in ZERODAY** | [`SECURITY.md`](../SECURITY.md) |
| Private partner questions / access | GitHub private issues or discussion with maintainers who granted you clone access |
| Responsible disclosure of a ZERODAY defect | Prefer GitHub private vulnerability reporting; else contact [`@pandeyaby`](https://github.com/pandeyaby) privately — impact summary, no weaponized PoC required |

**Do not** open public issues with exploit details against assessed third-party code.
ZERODAY will not help prove exploitability of a CWE it localized.

---

## Design-partner checklist

- [ ] Clone stays **private** unless maintainers explicitly flip visibility
- [ ] Ran `npm run mvp` (or fixture Action) before any live spend
- [ ] Desk / rules / ingest only on trees you are authorized to assess
- [ ] Live Antares only after HF accept + human-approved GPU budget
- [ ] Read [`SECURITY.md`](../SECURITY.md) + [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md)
- [ ] No F1 / partnership / public-readiness claims in partner write-ups

More detail: [`howto.md`](./howto.md) · [`faq.md`](./faq.md) · [`agent-operator.md`](./agent-operator.md) · [`defense-factory.md`](./defense-factory.md)
