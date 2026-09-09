#!/usr/bin/env python3
"""Minimal OpenAI-compatible completions server for local Antares (Mac MPS-safe).

Why this exists
---------------
Antares CLI requires POST /v1/completions (NOT chat). On Apple Silicon (MPS),
**float16 compute produces NaN logits** → argmax collapses to token 0 (`!`) forever
→ Antares live runs see tool_call_count=0 / no_submit. **Greedy decoding is a
false fix.** Use **float32 on MPS**; float16 remains OK on CUDA. Prefer vLLM on
CUDA when a GPU is available.

This is a workstation helper — not CI, not a production inference stack, not a
Cisco partnership. Accept HF terms for fdtn-ai/antares-1b yourself before loading
weights. ZERODAY never downloads model.safetensors in CI.

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

Honesty: local Apple Silicon helper only. Localization ≠ exploitability.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Sequence
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Pure helpers (importable / unit-testable without torch or GPU)
# ---------------------------------------------------------------------------


def select_torch_dtype_name(device: str) -> str:
    """Return torch dtype name for the device.

    MPS must be float32 — float16 yields NaN logits for Antares on Apple Silicon.
    CUDA may use float16; CPU uses float32.
    """
    if device == "mps":
        return "float32"
    if device == "cuda":
        return "float16"
    return "float32"


def map_frequency_to_repetition_penalty(
    frequency_penalty: float | None,
) -> float | None:
    """Map OpenAI frequency_penalty → transformers repetition_penalty.

    OpenAI frequency_penalty is typically in [-2, 2]. Transformers expects
    repetition_penalty >= 1.0 (1.0 = no penalty). Positive frequency_penalty
    maps to 1.0 + frequency_penalty; non-positive / missing → None (omit).
    """
    if frequency_penalty is None:
        return None
    try:
        fp = float(frequency_penalty)
    except (TypeError, ValueError):
        return None
    if fp <= 0:
        return None
    return 1.0 + fp


def normalize_stop_sequences(stop: Any) -> list[str]:
    """Normalize OpenAI `stop` (str | list[str] | null) to a list of strings."""
    if stop is None:
        return []
    if isinstance(stop, str):
        return [stop] if stop else []
    if isinstance(stop, (list, tuple)):
        out: list[str] = []
        for s in stop:
            if isinstance(s, str) and s:
                out.append(s)
        return out
    return []


def is_degenerate_exclamation_run(
    text: str,
    *,
    min_chars: int = 16,
    ratio: float = 0.9,
) -> bool:
    """Detect NaN→argmax(token 0) collapse that emits `!` forever.

    On broken MPS float16 runs, logits become NaN and greedy/sample argmax
    repeatedly picks tokenizer id 0 (often `!`). Clear error beats silent
    tool_call_count=0.
    """
    if not text:
        return False
    # Ignore leading/trailing whitespace for length, but count bangs on raw strip
    s = text.strip()
    if len(s) < min_chars:
        return False
    bangs = s.count("!")
    return (bangs / len(s)) >= ratio


def is_degenerate_token_ids(
    token_ids: Sequence[int],
    *,
    min_tokens: int = 16,
    dominant_id: int = 0,
    ratio: float = 0.9,
) -> bool:
    """True when generated ids collapse to a single dominant id (usually 0)."""
    if len(token_ids) < min_tokens:
        return False
    n_dom = sum(1 for t in token_ids if int(t) == dominant_id)
    return (n_dom / len(token_ids)) >= ratio


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
        self.dtype_name = select_torch_dtype_name(device)
        dtype = getattr(torch, self.dtype_name)

        print(
            f"Loading {model_id} on {device} (dtype={self.dtype_name})…",
            flush=True,
        )
        if device == "mps" and self.dtype_name != "float32":
            raise RuntimeError(
                "Internal error: MPS must use float32 (float16 NaN logits)."
            )
        if device == "mps":
            print(
                "note: MPS float16 is broken for Antares (NaN logits → '!' forever). "
                "Using float32. Prefer vLLM on CUDA when available.",
                file=sys.stderr,
                flush=True,
            )

        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=dtype,
        )
        self.model.to(device)
        self.model.eval()
        print(
            "Ready — POST /v1/completions only (chat rejected). "
            f"skip_special_tokens=False (tool tags preserved).",
            flush=True,
        )

    def _stopping_criteria(self, stop_strings: list[str], prompt_len: int):
        """Build StoppingCriteria that halt when a stop sequence is generated."""
        if not stop_strings:
            return None
        from transformers import StoppingCriteria, StoppingCriteriaList

        tokenizer = self.tokenizer
        device = self.device

        class _StopOnStrings(StoppingCriteria):
            def __init__(self) -> None:
                self._stop_ids = [
                    tokenizer.encode(s, add_special_tokens=False) for s in stop_strings
                ]
                # Drop empty encodings
                self._stop_ids = [ids for ids in self._stop_ids if ids]

            def __call__(self, input_ids, scores, **kwargs):  # noqa: ANN001
                for row in input_ids:
                    gen = row[prompt_len:].tolist()
                    if not gen:
                        continue
                    for stop_ids in self._stop_ids:
                        n = len(stop_ids)
                        if n and len(gen) >= n and gen[-n:] == stop_ids:
                            return True
                return False

        # Keep reference so device is not unused (encode is CPU; compare on lists)
        _ = device
        return StoppingCriteriaList([_StopOnStrings()])

    def complete(
        self,
        prompt: str,
        max_tokens: int | None,
        temperature: float | None,
        *,
        stop: Any = None,
        frequency_penalty: float | None = None,
        repetition_penalty: float | None = None,
    ) -> str:
        stop_strings = normalize_stop_sequences(stop)
        # Prefer explicit repetition_penalty; else map from frequency_penalty
        rep = repetition_penalty
        if rep is None:
            rep = map_frequency_to_repetition_penalty(frequency_penalty)

        inputs = self.tokenizer(prompt, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        prompt_len = int(inputs["input_ids"].shape[-1])
        n = max_tokens or self.max_new_tokens

        gen_kwargs: dict[str, Any] = {
            "max_new_tokens": max(1, min(int(n), 2048)),
            "pad_token_id": self.tokenizer.eos_token_id,
        }
        # float32 on MPS allows normal sampling; do not force greedy (false fix)
        temp = 0.0 if temperature is None else float(temperature)
        if temp > 0:
            gen_kwargs["do_sample"] = True
            gen_kwargs["temperature"] = temp
        else:
            gen_kwargs["do_sample"] = False

        if rep is not None and rep != 1.0:
            gen_kwargs["repetition_penalty"] = float(rep)

        criteria = self._stopping_criteria(stop_strings, prompt_len)
        if criteria is not None:
            gen_kwargs["stopping_criteria"] = criteria

        with self.torch.no_grad():
            out = self.model.generate(**inputs, **gen_kwargs)

        gen_ids = out[0][prompt_len:]
        id_list = gen_ids.tolist()

        # Strip trailing stop-sequence tokens from the returned text when possible
        text = self.tokenizer.decode(gen_ids, skip_special_tokens=False)
        for s in stop_strings:
            if s and text.endswith(s):
                text = text[: -len(s)]
                break

        if is_degenerate_token_ids(id_list) or is_degenerate_exclamation_run(text):
            raise RuntimeError(
                "Degenerate completion detected (near-constant '!' / token-id 0). "
                "On Mac MPS this usually means float16 NaN logits — this server "
                "must load with float32 on MPS. Do not rely on greedy decoding. "
                "Prefer vLLM on CUDA when available. "
                f"(device={self.device}, dtype={self.dtype_name})"
            )
        if "nan" in text.lower() and len(text.strip()) < 8:
            raise RuntimeError(
                "Model produced NaN-like output. On Mac MPS use float32 "
                f"(this server uses dtype={self.dtype_name}). Check weights / device."
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
                self._json(
                    200,
                    {
                        "ok": True,
                        "model": server.model_id,
                        "device": server.device,
                        "dtype": server.dtype_name,
                    },
                )
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
                    stop=req.get("stop"),
                    frequency_penalty=req.get("frequency_penalty"),
                    repetition_penalty=req.get("repetition_penalty"),
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
        description=(
            "Mac MPS-safe /v1/completions server for Antares (float32 on MPS; not chat)."
        )
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
        help="auto prefers MPS on Apple Silicon (loads float32 there)",
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
        f"(model={args.model}, device={device}, dtype={svc.dtype_name})",
        flush=True,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
