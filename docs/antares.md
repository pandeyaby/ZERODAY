# Antares + ZERODAY

How ZERODAY wraps Cisco Foundation AI’s Antares for daily-driver localization.

## Official sources

- Site / paper: https://cisco-foundation-ai.github.io/antares/
- Collection: https://huggingface.co/collections/fdtn-ai/antares
- Antares-1B (default): https://huggingface.co/fdtn-ai/antares-1b
- Antares-350m (edge): https://huggingface.co/fdtn-ai/antares-350m
- Blog: https://blogs.cisco.com/ai/introducing-antares-the-most-efficient-open-weight-ai-models-for-vulnerability-localization
- Cookbook quickstart: https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md
- Official CLI (PyPI): [`cisco-antares-cli`](https://pypi.org/project/cisco-antares-cli/) · source https://github.com/cisco-foundation-ai/antares-cli

Antares-3B is Cisco-internal. ZERODAY does not ship or claim it.

## Install the official CLI (no weights)

```bash
uv tool install cisco-antares-cli
export PATH="$(uv tool dir --bin):$PATH"
antares --version   # antares-cli 0.1.0+
```

Install from PyPI only for daily use. The public source is https://github.com/cisco-foundation-ai/antares-cli — read it if needed; do not clone it onto operator machines as the install path. The gated Hugging Face ZIP (`assets/antares-cli.zip`) is the same product; skip it for Increment 1.

## Gated weights (live inference only)

1. Sign in to Hugging Face.
2. Open `fdtn-ai/antares-1b` and **accept Cisco’s access conditions**.
3. Serve locally — **do not** use chat completions:

```bash
vllm serve fdtn-ai/antares-1b
# Antares requires streaming POST /v1/completions
export ANTARES_ENDPOINT="http://127.0.0.1:8000/v1/completions"
```

ZERODAY never downloads weights in this increment and never bypasses the gate.

## CLI contract (Cisco)

| Fact | Detail |
|------|--------|
| Inference route | Streaming `POST /v1/completions` only (chat templates break the tool prompt) |
| Validated with | vLLM 0.19.1 |
| Outputs | JSON + Markdown + SARIF (file-level, **note** severity) |
| Snapshot | Read-only; allowlisted inspection utils; default tool budget 15 |
| Snapshot caps | 100k files / 2 GiB total / 256 MiB per file |
| `antares plan` | **Local** — does not call inference |
| Platform | Linux / macOS (native Windows not supported) |
| Default profile context | 16,384 tokens (not the 1B’s full 128K) |

## Fixture vs plan vs live

| Mode | Command | Needs |
|------|---------|-------|
| Fixture | `zeroday locate --cwe CWE-89 --fixture` | Nothing — recorded localization |
| Plan | `zeroday plan [repo]` | `cisco-antares-cli` — **no GPU / no weights** |
| Live | `zeroday locate --cwe CWE-89 --repo PATH --live` | CLI + local `/v1/completions` endpoint + accepted HF terms |

## Data boundary

- ZERODAY copies the target into a temp read-only snapshot, then deletes it.
- Live mode may send prompts + path listings + excerpts to **your** endpoint only.
- Keep reports outside the scanned repo (`zeroday-reports/` is gitignored).

## Sister Cisco pieces

Compose, do not replace:

- **Foundry Security Spec** — harness / roles / reviewable outputs
- **CodeGuard** — secure-coding rules (patch drafts only after a human asks — later increment)

## Outputs

Every successful `locate` writes:

- `report.json` — ZERODAY `LocalizationResult`
- `report.sarif` — SARIF 2.1.0 for GitHub Code Scanning
- `report.md` — human report

Posture flags are embedded: localization only, not exploit proof, no PoC, no auto-merge.
