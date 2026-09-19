# Design-partner trust pack (honest dry-run)

One-pager for operators and design partners who want to run Desk / keyless
locate with clear hard limits. Not a brochure. Not outreach.

**Audience:** anyone cloning this **public** Apache-2.0 repo to assess trees they
are authorized to touch.  
**Posture:** localization + evidence + Desk around
[Cisco Antares](https://cisco-foundation-ai.github.io/antares/).
**Not a Cisco product.** Not an official Cisco partnership.

**Privacy split (honest):**

| Surface | Visibility |
|---------|------------|
| This ZERODAY repo | **Public** OSS |
| Customer / partner source you assess | Must stay **private** / local unless you explicitly opt into remote inference with the documented ACK |

---

## What ZERODAY does

| Surface | Honest job |
|---------|------------|
| **Locate / operate** | CWE / CVE / GHSA → ranked candidate files + hashed evidence + SARIF |
| **Desk** | Keyless loop on *your* tree: `inventory` → `packet` → `harden` → `classify` → `craft` (config / packet / recommend-only / classify / craft — **not** vuln discovery) |
| **Evidence** | Offline vault + `verify` hashes; exporters write **local files only** |
| **CI default** | Fixture / keyless smoke → SARIF → human-reviewed PR comment |
| **DIPTYCH (optional)** | Paired-probe / trust layer that grades calibration on locate artifacts — **not** required for `locate` / Desk / SARIF ([DIPTYCH](https://github.com/pandeyaby/DIPTYCH) · [`paired-probes.md`](./paired-probes.md)) |

Localization is detector-lane **candidates**. Always `needs_human: true`.
Localization ≠ exploitability. DIPTYCH greens ≠ vulnerability proof.

### Stranger trust loop (after locate)

Three commands max — Desk / CLI → paired-probe artifacts → checked-in sample
grade **without cloning DIPTYCH** (keyless / no GPU):

```bash
npm run mvp
npm run paired-probe:from-sarif -- --sarif zeroday-reports/mvp
# open: docs/reports/diptych-sample-grade.md
```

Or one-shot: `npm run trust-loop`. Details:
[`paired-probes.md`](./paired-probes.md) · help: [`SUPPORT.md`](../SUPPORT.md).
No AUROC · localization ≠ exploitability · DIPTYCH grades · ZeroDay emits.

---

## What it does **not** do

- No PoCs, exploits, payloads, or attack procedures (lab / localhost framing included)
- No auto-merge, auto-PR, auto-apply harden, or auto-install craft artifacts
- No public File-F1 / marketing metrics for fixture / rules / ingest / recording / arbitrary local models
- No auto GPU / RunPod spend — print-only doctors; **you** provision and terminate
- No silent fixture fallback on the live `--endpoint` path
- No claim that public OSS means customer source is fair game — **assessed trees stay private**
- No claim that DIPTYCH greens / AUROC-style scores prove exploitability — calibration ≠ vuln proof
- No exploit theater (PoC / payload / attack-procedure demos)

---

## How to run (honest dry-run)

### Keyless (preferred start — $0)

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

| Path | Role |
|------|------|
| [`docs/org-ops-runbook.md`](./org-ops-runbook.md) | Org daily-driver: keyless vs live, spend gates, no auto-merge |
| [`docs/cassette-runbook.md`](./cassette-runbook.md) | Record / redact / replay org cassettes for CI |
| [`examples/ops/zeroday-org-locate.yml`](../examples/ops/zeroday-org-locate.yml) | Copy-paste consumer Action (fixture / rules / recording — no live GPU in CI) |

Also: root [`README.md`](../README.md) (MVP / Desk / Honesty),
[`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml),
and stranger CI trust (badge ≠ vuln proof / ≠ live Antares F1):
[`ci-trust.md`](./ci-trust.md).

---

## Security & support surface

| Need | Where |
|------|--------|
| Acceptable use / authorization | [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md) |
| Product hard limits + reporting a bug **in ZERODAY** | [`SECURITY.md`](../SECURITY.md) |
| Product / docs questions | [`SUPPORT.md`](../SUPPORT.md) · GitHub Issues or Discussions on this public repo |
| Responsible disclosure of a ZERODAY defect | Prefer GitHub private vulnerability reporting; else contact [`@pandeyaby`](https://github.com/pandeyaby) privately — impact summary, no weaponized PoC required |

**Do not** open public issues with exploit details against assessed third-party code.
ZERODAY will not help prove exploitability of a CWE it localized.

---

## Operator checklist

- [ ] Customer / partner source under assessment stays **private** (this public repo ≠ your tree)
- [ ] Ran `npm run mvp` (or fixture Action) before any live spend
- [ ] Desk / rules / ingest only on trees you are authorized to assess
- [ ] Live Antares only after HF accept + human-approved GPU budget
- [ ] Read [`SECURITY.md`](../SECURITY.md) + [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md)
- [ ] No F1 / partnership / exploitability claims in write-ups

More detail: [`howto.md`](./howto.md) · [`faq.md`](./faq.md) · [`agent-operator.md`](./agent-operator.md) · [`defense-factory.md`](./defense-factory.md)
