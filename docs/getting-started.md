# Getting started

## MVP path (keyless, &lt;10 min)

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
npm install
npm run mvp
# optional: npm run play → http://localhost:3333/play (Desk Console home)
```

Expect **PASS** and SARIF under `zeroday-reports/mvp/`. No GPU. No HF token. No spend.

## Local OpenAI-compatible brain (Keyless K4, print-only)

```bash
npm run zeroday -- doctor   # $0 checklist — no download / auto-start
# After YOU start a completions host on loopback:
npm run zeroday -- locate --cwe CWE-89 --repo /path/to/authorized/repo \
  --endpoint http://127.0.0.1:8000/v1 --model <your-model-id>
```

Completions-only (`POST /v1/completions`). Chat-only hosts refused. Arbitrary local
models ≠ Antares File F1. See [`local-brain.md`](./local-brain.md).

## Live Antares (opt-in, costs $)

```bash
npm run zeroday -- antares doctor   # print-only checklist — no spend
# Human: accept terms at https://huggingface.co/fdtn-ai/antares-1b
# Provision Secure A40 yourself (docs/runpod-antares.md), serve vLLM, then:

npm run zeroday -- locate --repo /path/to/authorized/repo --cwe CWE-89 \
  --endpoint http://127.0.0.1:8000/v1
# or: bash scripts/quickstart-live.sh /path/to/repo CWE-89
# Then terminate the pod.
```

Live path **refuses** silent fixture/mock fallback when `--endpoint` / `--live` is set.
Remote endpoints need `--remote-inference` / `ZERODAY_REMOTE_INFERENCE_ACK=1`.

## Desk Console UI

```bash
npm run play
# → http://localhost:3333/play  (Desk Console default; FAQ + fixture smoke as tabs)
```

Desk Console wraps locate `--rules` / `--from-sarif` and Desk
`inventory → packet → harden → classify → craft` **in-process** (path-sandboxed
under cwd / `ZERODAY_UI_ROOTS`). Not a live Antares / RunPod spend UI.

**Reports & cassettes** (UI-2): after a Desk run, open the Reports panel to list
`zeroday-reports/`, preview locate summaries (copy paths only), then
**record** a redacted org cassette (redact always ON — UI refuses `--no-redact`)
and **replay** with honest `mode: "recording"`. Org cassettes are for CI
regression — not discovery.

Read [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md) before assessing any repo you do not own.
Full details: root [`README.md`](../README.md) · [`local-brain.md`](./local-brain.md) · [`runpod-antares.md`](./runpod-antares.md) · [`antares.md`](./antares.md).
