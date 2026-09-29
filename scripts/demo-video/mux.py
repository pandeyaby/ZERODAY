"""Mix the per-scene narration onto the silent capture at each scene's start → zeroday-demo.mp4 (+ poster frame)."""
import json, os, shutil, subprocess

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("OUT", os.path.join(D, "..", "..", "zeroday-reports", "demo-video"))
try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FF = shutil.which("ffmpeg") or "ffmpeg"

t = json.load(open(os.path.join(OUT, "timeline.json")))
args = [FF, "-y", "-i", t["webm"]]
for s in t["timeline"]:
    args += ["-i", os.path.join(OUT, f"n_{s['id']}.wav")]
parts = [f"[{i}:a]adelay={int(s['start'] * 1000)}|{int(s['start'] * 1000)}[a{i}]" for i, s in enumerate(t["timeline"], start=1)]
mix = "".join(f"[a{i}]" for i in range(1, len(parts) + 1))
fc = ";".join(parts) + f";{mix}amix=inputs={len(parts)}:normalize=0,volume=0.7,alimiter=limit=0.8[out]"
video = os.path.join(OUT, "zeroday-demo.mp4")
args += ["-filter_complex", fc, "-map", "0:v", "-map", "[out]", "-c:v", "libx264", "-crf", "20", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", video]
subprocess.run(args, check=True, capture_output=True)
traefik = next(s["start"] for s in t["timeline"] if s["id"] == "traefik")
subprocess.run([FF, "-loglevel", "error", "-y", "-ss", str(traefik + 21), "-i", video, "-frames:v", "1", os.path.join(OUT, "poster-src.png")], check=True)
print(video)
