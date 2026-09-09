# Antares + ZERODAY

ZERODAY wraps Cisco Foundation AI’s Antares for daily-driver localization.
It does **not** reimplement `cisco-antares-cli`.

## Official CLI (v0.1.0)

```bash
uv tool install cisco-antares-cli
antares --version
```

| Command | Role |
|---------|------|
| `antares query PATH --cwe` | Live localization (needs `/v1/completions`) |
| `antares plan PATH` | Local CWE portfolio — **no inference** |
| `antares sweep` | Multi-CWE sweeps |
| `--export FILE.tar.gz` | Bundle Antares reports |

There is **no** `antares locate`. `zeroday locate` wraps `query` (and `plan` via `zeroday plan`).

## Completions only

```bash
vllm serve fdtn-ai/antares-1b   # Antares CLI expects vLLM 0.19.1+ completions
# POST /v1/completions — chat completions are rejected
# ZERODAY does not claim independent “validated with vLLM” proof
npm run zeroday -- locate --cwe CWE-89 --repo /path --endpoint http://127.0.0.1:8000/v1

# Keyless default (no Antares weights):
npm run zeroday -- operate --cwe CWE-89 --fixture
```

Do **not** download `model.safetensors` onto CI machines. Accept HF terms on an operator workstation.

## Models

| Model | File F1 | Context |
|-------|---------|---------|
| `fdtn-ai/antares-1b` | 0.209 | 128K |
| `fdtn-ai/antares-350m` | 0.135 | 32K |
| Antares-3B | — | Cisco-internal; never claimed |

## Snapshot / platform

100k files / 2 GiB / 256 MiB per file · Linux/macOS · native Windows not supported.

## Sister pieces

- [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) — Detector-lane **candidates** only; human triage for true-positive
- [Project CodeGuard](https://project-codeguard.org/) — patch DRAFT rule map (`--i-asked-for-a-fix`)

## Exporters

See root README. Local projection from `report.json` only — no vendor cloud pushes.
