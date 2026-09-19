# Getting started

Follow the [root README](../README.md) skim path first. This page is the same
doors with a little more detail — not a second encyclopedia.

## 1. Start in 2 minutes (keyless)

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
npm install
npm run mvp
```

Expect **PASS** and SARIF under `zeroday-reports/mvp/`. No GPU. No HF token. No
spend. Same door as `locate --fixture`.

Checklist mirror: [`first-time-users.md`](./first-time-users.md)

## 2. Desk Console (optional UI)

```bash
npm run play
# → http://localhost:3333/play
```

Desk wraps locate `--rules` / `--from-sarif` and
`inventory → packet → harden → classify → craft` in-process (path-sandboxed
under cwd / `ZERODAY_UI_ROOTS`). Commands stay keyless (no silent spend).

**Reports & cassettes:** list `zeroday-reports/`, record a redacted org cassette
(redact always ON), replay with `mode: "recording"`. Org cassettes are CI
regression — not discovery. See [`cassette-runbook.md`](./cassette-runbook.md).

**Live brain:** configure a completions endpoint (Antares-1B recommended; or
local OpenAI-compatible). Save → doctor → spend banner → live locate.
Non-loopback needs the remote-inference checkbox. No auto RunPod / auto-spend.
Optional Antares-350M via Ollama (import yourself; no F1 claim):
[`antares-350m-ollama.md`](./antares-350m-ollama.md).

**Validate live (≤60s):** with a healthy completions endpoint already running,
click **Validate live (≤60s)** — applies Antares-1B / last-good Antares
(ignores a stray `llama3.2` save), runs doctor, then opens the spend confirm
prefilled with `fixtures/locate/rules-sample` + `CWE-89`. CLI mirror:
`npm run zeroday -- live validate` (add `--spend-ack` for one explicit locate).

Person / org habits: [`howto.md`](./howto.md)

## 3. When you want live Antares (opt-in, costs $) — Door B

Honest proven vs deferred: [`gpu-claims.md`](./gpu-claims.md).

```bash
npm run zeroday -- antares doctor   # print-only — no spend
# Human: accept terms at https://huggingface.co/fdtn-ai/antares-1b
# Provision Secure A40 yourself (docs/runpod-antares.md), serve vLLM, then:

npm run zeroday -- locate --repo /path/to/authorized/repo --cwe CWE-89 \
  --endpoint http://127.0.0.1:8000/v1
# or: bash scripts/quickstart-live.sh /path/to/repo CWE-89
# Then terminate the pod.
```

Live path **refuses** silent fixture fallback when `--endpoint` / `--live` is
set (fails closed if unreachable — see `tests/locate/live-guard.test.ts`).
Remote endpoints need `--remote-inference` /
`ZERODAY_REMOTE_INFERENCE_ACK=1`.

Any local completions host without Antares weights (Keyless K4):

```bash
npm run zeroday -- doctor   # $0 checklist
# → docs/local-brain.md
```

Install steps, MPS caveats, incomplete-run classes, Desk chain, Action, cheat
sheet: [`paths.md`](./paths.md) · RunPod: [`runpod-antares.md`](./runpod-antares.md)
· claims: [`gpu-claims.md`](./gpu-claims.md)

Read [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md) before
assessing any repo you do not own.
