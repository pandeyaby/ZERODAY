#!/usr/bin/env python3
"""Minimal OpenAI-compatible completions server for local Antares (Mac MPS-safe).

Why this exists
---------------
Antares CLI requires POST /v1/completions (NOT chat). On Apple Silicon (MPS),
float16 sampling can produce NaNs; greedy decoding (do_sample=False, temperature
ignored / forced 0) is required for stable generations.

This is a workstation helper — not CI, not a production inference stack.
Accept HF terms for fdtn-ai/antares-1b yourself before loading weights.
ZERODAY never downloads model.safetensors in CI.

Usage
-----
  # After: hf auth + accepting https://huggingface.co/fdtn-ai/antares-1b
  pip install 'torch' 'transformers' 'accelerate'   # operator workstation
  python scripts/completions_server.py \\
    --model fdtn-ai/antares-1b \\
    --host 127.0.0.1 --port 8000

  # Then:
  npm run zeroday -- locate --repo /path --cwe CWE-89 \\
    --endpoint http://127.0.0.1:8000/v1

Endpoints
---------
  GET  /v1/models
  POST /v1/completions          (supported)
  POST /v1/chat/completions     (HTTP 400 — Antares rejects chat; we refuse too)

Honesty: greedy-only on MPS by default. Localization ≠ exploitability.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse


def _pick_device(prefer: str) -> str:
    import torch

    if prefer == "cpu":
        return "cpu"
    if prefer == "mps":
        if torch.backends.mps.is_available():
            return "mps"
        print("MPS not available — falling back to CPU", file=sys.stderr)
        return "cpu"
    if prefer == "cuda" and torch.cuda.is_available():
        return "cuda"
    if prefer == "auto":
        if torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
        return "cpu"
    return "cpu"


class CompletionsServer:
    def __init__(self, model_id: str, device: str, max_new_tokens: int) -> None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.model_id = model_id
        self.device = device
        self.max_new_tokens = max_new_tokens
        self.torch = torch

        print(f"Loading {model_id} on {device} (greedy decoding)…", flush=True)
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        dtype = torch.float16 if device in ("mps", "cuda") else torch.float32
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=dtype,
        )
        self.model.to(device)
        self.model.eval()
        print("Ready — POST /v1/completions only (chat rejected).", flush=True)

    def complete(self, prompt: str, max_tokens: int | None, temperature: float | None) -> str:
        # Mac MPS: float16 sampling → NaN. Always greedy here.
        if temperature is not None and temperature > 0:
            print(
                f"warning: temperature={temperature} ignored — greedy required on MPS/float16",
                file=sys.stderr,
            )
        inputs = self.tokenizer(prompt, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        n = max_tokens or self.max_new_tokens
        with self.torch.no_grad():
            out = self.model.generate(
                **inputs,
                max_new_tokens=max(1, min(n, 2048)),
                do_sample=False,  # greedy — required for MPS stability
                pad_token_id=self.tokenizer.eos_token_id,
            )
        gen = out[0][inputs["input_ids"].shape[-1] :]
        text = self.tokenizer.decode(gen, skip_special_tokens=True)
        # Guard against NaN garbage leaking as text
        if "nan" in text.lower() and len(text.strip()) < 8:
            raise RuntimeError(
                "Model produced NaN-like output. On Mac MPS use greedy decoding "
                "(this server already forces do_sample=False). Check weights / dtype."
            )
        return text


def make_handler(server: CompletionsServer):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: Any) -> None:
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

        def _json(self, code: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            return json.loads(raw.decode("utf-8") or "{}")

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path.rstrip("/") or "/"
            if path in ("/v1/models", "/models"):
                self._json(
                    200,
                    {
                        "object": "list",
                        "data": [
                            {
                                "id": server.model_id,
                                "object": "model",
                                "owned_by": "local-zeroday-helper",
                            }
                        ],
                    },
                )
                return
            if path in ("/health", "/v1/health"):
                self._json(200, {"ok": True, "model": server.model_id, "device": server.device})
                return
            self._json(404, {"error": {"message": f"not found: {path}"}})

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path.rstrip("/") or "/"
            if path.endswith("/chat/completions") or path == "/v1/chat/completions":
                self._json(
                    400,
                    {
                        "error": {
                            "message": (
                                "Chat completions are rejected. Antares requires "
                                "POST /v1/completions (raw tool prompt). "
                                "Point --endpoint at http://127.0.0.1:8000/v1"
                            ),
                            "type": "invalid_request_error",
                        }
                    },
                )
                return
            if path not in ("/v1/completions", "/completions"):
                self._json(404, {"error": {"message": f"not found: {path}"}})
                return
            try:
                req = self._read_json()
                prompt = req.get("prompt")
                if not isinstance(prompt, str) or not prompt:
                    self._json(
                        400,
                        {"error": {"message": "prompt (string) is required"}},
                    )
                    return
                # Streaming not implemented — Antares may request stream; we return non-stream JSON.
                # Operators needing true SSE should use vLLM on CUDA.
                if req.get("stream"):
                    print(
                        "warning: stream=true requested; returning non-stream completion",
                        file=sys.stderr,
                    )
                text = server.complete(
                    prompt,
                    max_tokens=req.get("max_tokens"),
                    temperature=req.get("temperature"),
                )
                self._json(
                    200,
                    {
                        "id": "cmpl-zeroday-local",
                        "object": "text_completion",
                        "model": server.model_id,
                        "choices": [
                            {
                                "text": text,
                                "index": 0,
                                "finish_reason": "stop",
                            }
                        ],
                    },
                )
            except Exception as e:  # noqa: BLE001 — surface to client for operator debug
                traceback.print_exc()
                self._json(
                    500,
                    {"error": {"message": str(e), "type": "server_error"}},
                )

    return Handler


def main() -> int:
    p = argparse.ArgumentParser(
        description="Mac-friendly greedy /v1/completions server for Antares (not chat)."
    )
    p.add_argument(
        "--model",
        default=os.environ.get("ANTARES_MODEL", "fdtn-ai/antares-1b"),
        help="HF model id (must match --model / ANTARES_MODEL in zeroday locate)",
    )
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument(
        "--device",
        choices=("auto", "mps", "cuda", "cpu"),
        default="auto",
        help="auto prefers MPS on Apple Silicon",
    )
    p.add_argument("--max-new-tokens", type=int, default=256)
    args = p.parse_args()

    device = _pick_device(args.device)
    try:
        svc = CompletionsServer(args.model, device, args.max_new_tokens)
    except Exception as e:  # noqa: BLE001
        print(f"Failed to load model: {e}", file=sys.stderr)
        print(
            "Accept HF terms at https://huggingface.co/fdtn-ai/antares-1b and ensure "
            "weights are available locally (ZERODAY CI never downloads them).",
            file=sys.stderr,
        )
        return 1

    httpd = ThreadingHTTPServer((args.host, args.port), make_handler(svc))
    print(
        f"Serving completions-only on http://{args.host}:{args.port}/v1 "
        f"(model={args.model}, device={device}, greedy=True)",
        flush=True,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
