"""Synthesize narration per sentence with Piper; write n_<id>.wav + narration.json (per-sentence durations)."""
import json, re, subprocess, wave, os, sys

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("OUT", os.path.join(D, "..", "..", "zeroday-reports", "demo-video"))
VOICE = os.environ.get("PIPER_VOICE", "en_US-ryan-high.onnx")  # https://huggingface.co/rhasspy/piper-voices
os.makedirs(OUT, exist_ok=True)
GAP = 0.25  # seconds of silence between sentences

script = json.load(open(os.path.join(D, "script.json")))
out = []
for scene in script:
    sents = [s for s in re.split(r"(?<=[.?!:;])\s+", scene["text"].strip()) if s]
    frames, rate, params, info = [], None, None, []
    for i, s in enumerate(sents):
        tmp = os.path.join(OUT, "_s.wav")
        subprocess.run(["piper", "-m", VOICE, "-f", tmp, "--length_scale", "1.0"], input=s.encode(), check=True, capture_output=True)
        with wave.open(tmp) as w:
            params = w.getparams()
            rate = w.getframerate()
            data = w.readframes(w.getnframes())
        silence = b"\x00" * int(GAP * rate) * params.sampwidth * params.nchannels
        dur = len(data) / (rate * params.sampwidth * params.nchannels) + GAP
        frames.append(data + silence)
        info.append({"text": s, "dur": round(dur, 2)})
    with wave.open(os.path.join(OUT, f"n_{scene['id']}.wav"), "wb") as w:
        w.setparams(params)
        w.writeframes(b"".join(frames))
    total = round(sum(x["dur"] for x in info), 2)
    out.append({"id": scene["id"], "text": scene["text"], "dur": total, "sents": info})
    print(scene["id"], total, file=sys.stderr)
json.dump(out, open(os.path.join(OUT, "narration.json"), "w"), indent=1)
print("total", round(sum(x["dur"] for x in out), 1), file=sys.stderr)
