# Demo video

Builds [`docs/media/zeroday-demo.mp4`](../../docs/media/zeroday-demo.mp4) and its
poster. The Antares scenes replay the real terminal output of the 2026-09-28
recording session (RunPod A40, `fdtn-ai/antares-1b`), trimmed to fit, in
`t_*.txt`. The lodash and Desk scenes run live on this checkout. Every number
in `script.json` comes from those transcripts or
[`docs/antares-benchmark.md`](../../docs/antares-benchmark.md).

Needs [Piper](https://github.com/rhasspy/piper) with a voice (`en_US-ryan-high`),
Playwright's Chromium and ffmpeg (or `pip install imageio-ffmpeg`).

```bash
npm run play &                                           # Desk on :3333
PIPER_VOICE=/path/to/en_US-ryan-high.onnx python3 scripts/demo-video/tts.py
node scripts/demo-video/record.mjs                       # silent capture, scene timeline
python3 scripts/demo-video/mux.py                        # narration + video → zeroday-reports/demo-video/
node scripts/demo-video/poster.mjs                       # README poster
```

Change the words in `script.json`; scene timing follows the narration.
