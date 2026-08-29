# ZERODAY

```
 ███████╗███████╗██████╗  ██████╗ ██████╗  █████╗ ██╗   ██╗
 ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝
   ███╔╝ █████╗  ██████╔╝██║   ██║██║  ██║███████║ ╚████╔╝
  ███╔╝  ██╔══╝  ██╔══██╗██║   ██║██║  ██║██╔══██║  ╚██╔╝
 ███████╗███████╗██║  ██║╚██████╔╝██████╔╝██║  ██║   ██║
 ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝
```

**The daily-driver security workstation around Cisco Foundation AI’s Antares models.**

Cisco shipped the models. ZERODAY is what a security engineer opens every morning — and what a platform team leaves on every PR.

> **One command a junior analyst can run. A report a CISO can read. Localization first. Human in the loop. Forever.**

---

## What ZERODAY is

ZERODAY turns [Antares](https://cisco-foundation-ai.github.io/antares/) — open-weight SLMs for **agentic vulnerability localization** — into a local-first daily driver:

| You give | You get |
|----------|---------|
| A **CWE**, **CVE**, or **GHSA** + a local repo path | Ranked candidate files, evidence spans, exploration trace |
| | **SARIF** for GitHub Code Scanning |
| | A human report a CISO can skim |
| | JSON for tooling |

It does **not** write exploits, PoCs, payloads, or attack procedures. Localization is **not** proof of exploitability. Fixes are never auto-merged. Optional CodeGuard-aligned patch *drafts* are a later increment and only after a human asks.

Sister Cisco pieces we **compose**, not replace: **Foundry Security Spec** and **CodeGuard**.

---

## What Antares is

[Antares](https://huggingface.co/collections/fdtn-ai/antares) (Cisco Foundation AI) is a family of compact models for **file-level vulnerability localization**. Given a CWE and terminal access to a repository snapshot, the model explores with `grep` / `find` / `cat` (budget ~15 calls) and submits `submit_vulnerable_files` or `submit_no_vulnerability_found`.

| Model | Role | Notes |
|-------|------|-------|
| [`fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b) | Laptop / workstation | File F1 0.209, 128K context, **highest recall** — ZERODAY’s default |
| [`fdtn-ai/antares-350m`](https://huggingface.co/fdtn-ai/antares-350m) | Edge | Smaller footprint |
| Antares-3B | Cisco-internal | **Not** available here — we never claim it |

- Paper / site: https://cisco-foundation-ai.github.io/antares/
- Blog: https://blogs.cisco.com/ai/introducing-antares-the-most-efficient-open-weight-ai-models-for-vulnerability-localization
- Collection: https://huggingface.co/collections/fdtn-ai/antares
- Built on **IBM Granite 4.0**
- Official **Antares CLI**: public PyPI package [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/) (`uv tool install cisco-antares-cli`); also mirrored as gated `assets/antares-cli.zip` on HF. Read-only snapshot, OpenAI-compatible **`/v1/completions`** endpoint only, human / JSON / SARIF out.

**Weights are gated.** Accept Cisco’s terms on Hugging Face for [`fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b). ZERODAY never scrapes or bypasses that gate.

---

## Local-first promise

1. **Code never leaves the machine** for cloud inference of customer source.
2. Runs against a **read-only snapshot** (copied, scanned, destroyed).
3. Live inference talks only to a **local** OpenAI-compatible Antares endpoint (or the official CLI you installed).
4. Fixture mode ships recorded localizations so the UX works **without GPU weights**.

---

## Quick start (fixture — no GPU, no HF token)

```bash
npm install

# One command — works out of the box
npm run zeroday -- locate --cwe CWE-89 --fixture

# Or against the bundled demo app explicitly
npm run zeroday -- locate --cve CVE-2024-89001 --repo fixtures/locate/demo-app --fixture
```

Artifacts land in `zeroday-reports/<advisory>-<timestamp>/`:

- `report.json` — ranked files, evidence, exploration trace
- `report.sarif` — GitHub Code Scanning compatible
- `report.md` — human / CISO report

```bash
npm test
```

---

## Live mode (official Antares CLI + local weights)

**CLI (ungated, PyPI):**

```bash
uv tool install cisco-antares-cli
export PATH="$(uv tool dir --bin):$PATH"
antares --version
```

Preview CWEs locally with **no inference**:

```bash
npm run zeroday -- plan fixtures/locate/demo-app --max-cwes 5
```

**Weights (gated)** — accept Cisco terms on [`fdtn-ai/antares-1b`](https://huggingface.co/fdtn-ai/antares-1b), then serve locally. Antares requires streaming **`POST /v1/completions`** (chat completions are rejected; validated with vLLM 0.19.1):

```bash
vllm serve fdtn-ai/antares-1b
# Use the exact served model id with the CLI / ZERODAY --model
export ANTARES_ENDPOINT="http://127.0.0.1:8000/v1/completions"

npm run zeroday -- locate --cwe CWE-89 --repo /path/to/your/repo --live \
  --endpoint "$ANTARES_ENDPOINT"
```

ZERODAY creates a read-only snapshot (Antares caps: 100k files / 2 GiB / 256 MiB per file), shells into `antares query`, adapts the result into ZERODAY’s report shape, and writes SARIF (file-level, note severity) + markdown. This increment does **not** download model weights.

Optional: the same CLI also ships as the gated `assets/antares-cli.zip` on the HF repo — **skip for Increment 1**; use PyPI.

Configure `~/.antares/profiles.toml` as in Cisco’s [Antares Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md) when you want named profiles. Default profile context is **16,384** tokens (not the 1B’s full 128K). Linux/macOS only.

---

## Acceptable use (defensive only)

| Allowed | Not allowed |
|---------|-------------|
| Localize candidate files for CWEs you are authorized to assess | Exploits, PoCs, payloads, attack procedures |
| Emit SARIF for code scanning / human review | Auto-merge of “fixes” |
| Draft patches **later**, only when a human asks | Treating localization as exploitability proof |
| Compose with Foundry Security Spec / CodeGuard | Claiming Antares-3B access |
| Fixture demos on the bundled demo-app | Bypassing Hugging Face gating |

If asked for both a fix and a PoC: **ship the fix only; refuse the PoC.**

Engagement doctrine for the optional War Room remains in [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md).

---

## What is NOT included (yet / never)

- Auto-remediation or auto-merge (**never**)
- Exploit / PoC generation (**never**)
- Antares-3B
- Cloud inference of private source / weight downloads in CI
- Live GPU inference in the GitHub Action (fixture only — by design)

---

## GitHub Action CI gate (Increment 2)

Drop-in workflow a platform team can leave on forever. Runs on `ubuntu-latest` with **no GPU and no model weights**.

### Enable (one file)

The workflow ships at [`.github/workflows/zeroday-locate.yml`](./.github/workflows/zeroday-locate.yml). On this repo it already runs on every PR/push to `main`.

To adopt elsewhere:

1. Copy `.github/workflows/zeroday-locate.yml` and `.github/actions/zeroday-locate-gate/` into your repo (or call the composite action after vendoring).
2. Ensure GitHub **Code Scanning** is available (public repos: on by default for SARIF upload; private: enable code scanning / Advanced Security as needed).
3. Leave it on. PRs get:
   - Fixture `zeroday locate` → `report.sarif` (SARIF 2.1.0, file-level, **note** severity)
   - Upload to Code Scanning (`category: zeroday-antares-fixture`)
   - A reviewable PR comment (ranked files + evidence + exploration trace)
   - Job summary — findings are never silent

### Soft fail by default

Findings do **not** fail the job by default — localization is not exploitability, and we do not block merge by pretending otherwise. SARIF + the PR comment are the review surface.

To fail *after* publishing findings (still labeled as review, not exploit proof):

```bash
# Repository variable
ZERODAY_FAIL_ON_FINDINGS=true
```

### Local parity with CI

```bash
npm ci && npm test
npm run zeroday -- locate --cwe CWE-89 --repo fixtures/locate/demo-app --fixture --output zeroday-reports/ci
# → zeroday-reports/ci/{report.json,report.sarif,report.md,comment.md}
```

---

## CLI

```bash
npm run zeroday -- locate --cwe CWE-89 --fixture
npm run zeroday -- locate --cve CVE-2024-89001 --repo ./my-app --fixture
npm run zeroday -- locate --ghsa GHSA-demo-0000-sql1 --fixture
npm run zeroday -- plan fixtures/locate/demo-app --max-cwes 5
npm run zeroday -- locate --cwe CWE-89 --repo ./my-app --live --endpoint http://127.0.0.1:8000/v1/completions
npm run zeroday -- locate --cwe CWE-89 --fixture --json
npm run zeroday -- locate --cwe CWE-89 --fixture --fail-on-findings   # CI-shaped exit
```

War Room headless commands (`health`, `missions`, …) remain available when the Next.js app is running — see [`docs/cli-api.md`](./docs/cli-api.md).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  zeroday locate --cwe|--cve|--ghsa  --repo  [--fixture|--live]│
│  zeroday plan [repo]   ← antares plan, no inference          │
│  GitHub Action → fixture locate → SARIF upload + PR comment  │
├──────────────────────────────────────────────────────────────┤
│  parse advisory → CWE                                        │
│  read-only snapshot (tmpdir, Antares caps, destroy after run)│
│  ┌─ fixture: recorded Antares-style localization ─────────┐  │
│  └─ live: official cisco-antares-cli query on snapshot ───┘  │
│  no-exploit invariant gate                                   │
│  report.json + report.sarif + report.md + comment.md         │
└──────────────────────────────────────────────────────────────┘
```

Optional: the existing **War Room** UI (`npm run dev` → http://localhost:3333) remains in-tree as the broader workstation shell (missions, evidence vault, vendor loadouts). Antares localization is the product spine.

---

## Project layout

| Path | Purpose |
|------|---------|
| `cli/index.ts` | `zeroday` CLI (`locate` / `plan` + War Room) |
| `src/locate/` | Parse, snapshot, fixture, live adapter, SARIF, report, comment, invariants |
| `fixtures/locate/demo-app/` | Tiny intentional CWE-89 surface |
| `fixtures/locate/recordings/` | Recorded localizations for offline UX |
| `.github/workflows/zeroday-locate.yml` | Drop-in CI gate |
| `.github/actions/zeroday-locate-gate/` | Composite Action (SARIF + PR comment) |
| `tests/locate/` | SARIF, parse, invariant, comment, e2e fixture |
| `docs/` | Antares + workstation guides |

---

## Tests

```bash
npm test
```

Covers advisory parsing, SARIF 2.1.0 shape (note severity), the no-exploit invariant, PR comment posture, end-to-end fixture `locate`, and `antares plan` when the CLI is installed.

---

## Roadmap (later)

1. **Live CI** (optional, opt-in) — Antares-1B/350M on self-hosted runners with local `/v1/completions` — never download weights into GitHub-hosted runners by default.
2. **Sandbox harden** — isolated container, `network=none`, command timeout.
3. **Human-asked patch drafts** — CodeGuard-aligned, localization-first, never with a PoC.
4. War Room wiring so localize runs show up in the Evidence Vault.

---

## License & credits

Engagement posture: authorized / defensive use only. No warranty.

- **Antares** — Cisco Foundation AI ([site](https://cisco-foundation-ai.github.io/antares/), [collection](https://huggingface.co/collections/fdtn-ai/antares))
- Official CLI — [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/)
- Optional Plinius adapters — see [`vendor/plinius/README.md`](./vendor/plinius/README.md)
