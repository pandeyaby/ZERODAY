# ZERODAY

![ZERODAY workflow — default keyless mvp path (code → localize → SARIF → human gate) plus optional Antares live brain](./docs/images/zeroday-readme-hero.png)

**Public OSS · Apache-2.0 · not a Cisco product.** ZERODAY is a local-first
defensive **localization** desk around
[Antares](https://cisco-foundation-ai.github.io/antares/): given a CWE / CVE /
GHSA, it helps you rank which files matter, then writes **SARIF** + hashed
evidence for a human to review.

> **Hard limits** (unchanged product rules)
>
> - No PoCs, exploits, payloads, or attack procedures — ever
> - Localization ≠ proof of exploitability · `needs_human` always · never auto-merge
> - Default is keyless (`npm run mvp`) — no GPU, no HF token, no spend
> - Live Antares is **opt-in** and **costs $** — you accept HF terms and host
>   completions yourself; ZERODAY never auto-provisions pods
> - This repo is public; **customer source stays private** unless you explicitly
>   ACK remote inference (`--remote-inference`)
> - Scope: [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md) ·
>   disclosure: [`SECURITY.md`](./SECURITY.md) · help: [`SUPPORT.md`](./SUPPORT.md)

---

## Start in 2 minutes

Clone, install, run the fixture smoke. Offline. No GPU. No HF token. No spend.

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
npm install
npm run mvp
```

Expect **PASS**, then open the printed SARIF under `zeroday-reports/mvp/`
(`report.sarif`). Same door as `locate --fixture` — proves the workstation +
SARIF habit. Honest: this is not live Antares File F1; it validates the factory
shape.

More stranger detail: [`docs/getting-started.md`](./docs/getting-started.md) ·
[`docs/first-time-users.md`](./docs/first-time-users.md)

---

## Desk Console

Want a browser UI on the same keyless path?

```bash
npm run play
# → http://localhost:3333/play
```

One screen for fixture smoke, rules / SARIF ingest commands, Desk
`inventory → packet → harden → classify → craft`, reports & cassettes, FAQ, and
the opt-in **Live brain** tab (including **Validate live (≤60s)** when you already
have a completions host). Desk runs on **your** tree without Antares — it is
not vuln discovery. Deeper walkthrough:
[`docs/howto.md`](./docs/howto.md) · [`docs/getting-started.md`](./docs/getting-started.md)

### Watch the Desk

No clone required — play inline on github.com (or open the file view).

<video src="./artifacts/desk-ui-demo/desk-console-keyless-demo.webm" controls width="100%" poster="./artifacts/desk-ui-demo/04-locate-result.png">
  <a href="./artifacts/desk-ui-demo/desk-console-keyless-demo.webm">Keyless Desk demo</a>
</video>

<video src="./artifacts/desk-ui-demo/desk-console-live-antares-demo.webm" controls width="100%" poster="./artifacts/desk-ui-demo/live-06-locate-result.png">
  <a href="./artifacts/desk-ui-demo/desk-console-live-antares-demo.webm">Live Antares Desk demo</a>
</video>

[Open keyless demo](./artifacts/desk-ui-demo/desk-console-keyless-demo.webm) ·
[Open live Antares demo](./artifacts/desk-ui-demo/desk-console-live-antares-demo.webm)

Keyless = `$0` fixture path; live clip = opt-in completions host you run (not Cisco hosting); localization only — no PoC. Re-record notes: [`artifacts/desk-ui-demo/README.md`](./artifacts/desk-ui-demo/README.md).

---

## How it works

**Same pipeline, different brain.** Every locate door shares one shape:

CWE / CVE / GHSA → explore → ranked files + hashed evidence → SARIF / `report.md`

| | Antares (brain) | ZERODAY (desk) |
|--|-----------------|----------------|
| Job | “Which files?” for a CWE / advisory | Workstation + CI habit around that answer |
| Morning path | Model + your completions host | `npm run mvp` — fixture → SARIF; $0 |
| After locate | Ranked files | Desk on your tree, exporters, human gate |
| Live weights | You host them | Opt-in `--endpoint` / Desk **Live brain**; never auto-provisions pods |

Keyless does not invent a second product — only the localization brain swaps
(fixture · rules · SARIF ingest · live · org recording). Full door map:
[`docs/paths.md`](./docs/paths.md). Honesty Q&A: [`docs/faq.md`](./docs/faq.md)
(also a tab in `npm run play`).

---

## When you want live Antares

Not the default. You accept HF gated terms for `fdtn-ai/antares-1b`, serve
`POST /v1/completions` (CUDA / vLLM — see
[`docs/runpod-antares.md`](./docs/runpod-antares.md)), then point ZERODAY at it.
ZERODAY never downloads `model.safetensors`, never scrapes HF, and **never
creates paid RunPod pods**. Non-loopback needs `--remote-inference`. **No silent
fixture fallback** if the endpoint is down.

```bash
# Print-only checklist ($0 — no spend)
npm run zeroday -- antares doctor

# Or any local completions host you already run (Keyless K4; ≠ Antares File F1):
npm run zeroday -- doctor
# → docs/local-brain.md
```

**Validate live in under a minute** (Desk CTA from Live brain): with a healthy
completions endpoint already running (loopback `http://127.0.0.1:8000/v1` or
last-good Antares):

```bash
npm run play
# → Live brain → **Validate live (≤60s)**
#    applies Antares-1B / last-good Antares (never a stray llama3.2 save)
#    → doctor → spend banner → one click locate on fixtures/locate/rules-sample + CWE-89

# CLI mirror (green doctor only; add --spend-ack for one explicit live locate):
npm run zeroday -- live validate
```

Hard limits unchanged: spend banner + remote-inference ACK for non-loopback;
localization ≠ exploitability; no PoC; no auto-merge.

```bash
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint http://127.0.0.1:8000/v1 --model fdtn-ai/antares-1b
# or: bash scripts/quickstart-live.sh /path/to/repo CWE-89
```

Install Antares CLI, HF accept, RunPod / MPS caveats, incomplete-run classes:
[`docs/paths.md`](./docs/paths.md#live-antares-opt-in) ·
[`docs/runpod-antares.md`](./docs/runpod-antares.md) ·
[Antares site](https://cisco-foundation-ai.github.io/antares/) ·
[cookbook Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md)

---

## Proof (fixture-shaped sample)

Open without a GPU — same SARIF schema as live; `mode` differs (`fixture` vs `live`).

```bash
npm run mvp                                  # regenerates under zeroday-reports/mvp/
bash scripts/demo-proof.sh                   # refreshes examples/sample-live-sarif/
```

Sample: [`examples/sample-live-sarif/report.sarif`](./examples/sample-live-sarif/report.sarif)
· [excerpt](./examples/sample-live-sarif/report.excerpt.sarif.json)

![ZERODAY locate CLI — ranked files + SARIF path](./docs/images/zeroday-locate-cli.png)

![SARIF findings list — CWE-89 note severity](./docs/images/zeroday-sarif-findings.png)

![30-min live path one-liner](./docs/images/zeroday-live-path.png)

---

## Honesty

- **Keyless default** — `npm run mvp`; customer source stays local unless
  `--remote-inference` / `ZERODAY_REMOTE_INFERENCE_ACK`
- **No partnership claims** — not an official Cisco product or partnership
- **Localization ≠ exploitability** — candidates only; `needs_human` always
- **No PoCs / exploits / payloads / attack procedures**
- **Never auto-merge** — drafts only after `--i-asked-for-a-fix`
- **No silent fixture fallback** on the live path
- **No silent spend** — print-only `doctor` / `antares doctor`; you provision and terminate
- **Local brain honesty** — arbitrary local models ≠ Antares File F1

Full Q&A: [`docs/faq.md`](./docs/faq.md) · play UI FAQ tab (`npm run play`).
Trust pack: [`docs/design-partner-trust.md`](./docs/design-partner-trust.md)
(honest dry-run; no fake F1 marketing claims).

---

## Go deeper

| Want | Go here |
|------|---------|
| All locate doors (rules, ingest, recordings, K3/K4, Desk chain, Action, cheat sheet) | [`docs/paths.md`](./docs/paths.md) |
| Person + org habits + playground | [`docs/howto.md`](./docs/howto.md) |
| Org forever path (Action + spend gates) | [`docs/org-ops-runbook.md`](./docs/org-ops-runbook.md) |
| Docs index | [`docs/README.md`](./docs/README.md) |
| Get help | [`SUPPORT.md`](./SUPPORT.md) |

CI on `pull_request`: keyless locate → upload SARIF → reviewable comment
(fail-closed). Never pulls weights. Never auto-merge. Live Antares is **not**
wired into CI. Workflow:
[`.github/workflows/zeroday-locate.yml`](./.github/workflows/zeroday-locate.yml)

---

## License & credits

**Apache-2.0** public OSS — see [`LICENSE`](./LICENSE)
(`SPDX-License-Identifier: Apache-2.0`). **Not a Cisco product.** Authorized /
defensive use only ([`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md)).
No warranty.

- **Antares** — [site](https://cisco-foundation-ai.github.io/antares/) ·
  [Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md) ·
  [HF `fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b) ·
  [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/)
- Foundry Security Spec · Project CodeGuard — compose, don’t replace
