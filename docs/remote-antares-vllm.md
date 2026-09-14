# Remote Antares via CUDA / vLLM (host-agnostic)

Any GPU host that serves OpenAI-compatible **`POST /v1/completions`** for
`fdtn-ai/antares-1b` can back ZERODAY live locate. The product **recommends
RunPod** as the remote CUDA path; the env contract is host-agnostic.

→ **Start here (recommended):** [`runpod-antares.md`](./runpod-antares.md)

## Completions contract

| Requirement | Detail |
|-------------|--------|
| API | `POST /v1/completions` (chat completions are rejected) |
| Model id | `fdtn-ai/antares-1b` (or override with `--model` / `ANTARES_MODEL`) |
| Server | vLLM 0.19.1+ (`vllm serve …`) preferred |
| ACK | Non-loopback hosts need `--remote-inference` or `ZERODAY_REMOTE_INFERENCE_ACK=1` |

## Environment (local-first default)

```bash
ZERODAY_INFERENCE_PROVIDER=local          # default — stay on-box
# Remote (any host):
ZERODAY_INFERENCE_PROVIDER=remote         # aliases: runpod, nebius → remote
ZERODAY_ANTARES_BASE_URL=https://<host>/v1
ZERODAY_ANTARES_API_KEY=                  # if gateway requires
ZERODAY_REMOTE_INFERENCE_ACK=1            # required for non-loopback
# On the GPU host only:
# HUGGING_FACE_HUB_TOKEN=hf_...
```

## Other hosts (optional)

Same serve + env pattern works on Lambda, Vast, a cloud VM, or your own box —
point `ZERODAY_ANTARES_BASE_URL` at that host’s `/v1` base. ZERODAY never
provisions those resources.

Print-only generic checklist:

```bash
bash scripts/remote-vllm-antares.sh --print-only
```

## Appendix: Nebius (optional, not the product path)

If you already run CUDA on Nebius, use the same `vllm serve` +
`ZERODAY_ANTARES_BASE_URL` + `--remote-inference` wiring. Prefer self-managed
vLLM exposing `/v1/completions` over chat-only gateways. ZERODAY does not create
Nebius resources and does not treat Nebius as the default remote host.

## Related

- [`local-brain.md`](./local-brain.md) — any local completions host (Ollama/vLLM/LM Studio; Keyless K4)
- [`runpod-antares.md`](./runpod-antares.md) — recommended remote path
- [`defense-factory.md`](./defense-factory.md)
- Root README § Remote CUDA / RunPod
