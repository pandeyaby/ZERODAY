# Getting started

## Product path (<30 min): live Antares → SARIF

```bash
npm install
uv tool install cisco-antares-cli
# Human: accept terms at https://huggingface.co/fdtn-ai/antares-1b
# Then serve locally (completions-only /v1/completions), e.g.:
#   vllm serve fdtn-ai/antares-1b

npm run zeroday -- locate --repo /path/to/repo --cwe CWE-89 \
  --endpoint http://127.0.0.1:8000/v1
# or: bash scripts/quickstart-live.sh /path/to/repo CWE-89
```

Live path **refuses** silent fixture/mock fallback when `--endpoint` / `--live` is set.

## CI / no-GPU smoke (not the product path)

```bash
npm install
npm run zeroday -- locate --cwe CWE-89 --fixture
npm run zeroday -- operate --cwe CWE-89 --fixture
npm run zeroday -- verify --from zeroday-reports/<run-dir>
```

## Playground UI

```bash
npm run play
# → http://localhost:3333/play
```

Read [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md) before assessing any repo you do not own.
Full live details: root [`README.md`](../README.md) · [`antares.md`](./antares.md).
