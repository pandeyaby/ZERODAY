# Desk Console demos (paced)

Shareable product walkthroughs for strangers — **localization / evidence only**.
No PoCs, exploits, payloads, or attack procedures.

Published demos live on the
[`desk-demos` release](https://github.com/pandeyaby/ZERODAY/releases/tag/desk-demos)
(canonical for watching). GitHub’s file browser can’t preview large videos —
play from the root [README](../../README.md#watch-the-desk) or download the
release assets.

| Clip | Watch (release) | Still (poster, in-repo) |
|------|-----------------|-------------------------|
| Keyless Desk (`$0` fixture path) | [`desk-console-keyless-demo.webm`](https://github.com/pandeyaby/ZERODAY/releases/download/desk-demos/desk-console-keyless-demo.webm) | [`04-locate-result.png`](./04-locate-result.png) |
| Live Antares (opt-in local completions) | [`desk-console-live-antares-demo.webm`](https://github.com/pandeyaby/ZERODAY/releases/download/desk-demos/desk-console-live-antares-demo.webm) | [`live-06-locate-result.png`](./live-06-locate-result.png) |

**Honesty:** keyless = fixture / rules, no spend. Live clip = opt-in OpenAI-compatible
completions host you already run (e.g. local `:8000`) — not Cisco hosting. Localization
≠ exploitability; `needs_human` always.

## Re-record

Requires Desk up (`npm run play` → `http://127.0.0.1:3333/play`) and Playwright
(`npx playwright install chromium` if needed).

```bash
# Default pace is slow (readable). Use =fast for CI speed.
npm run demo:desk:keyless

# Live: local completions endpoint already up (default http://127.0.0.1:8000/v1)
ZERODAY_LIVE_ENDPOINT=http://127.0.0.1:8000/v1 \
ZERODAY_LIVE_MODEL=fdtn-ai/antares-1b \
  npm run demo:desk:live
```

Env knobs: `ZERODAY_DEMO_PACE=slow|fast`, `ZERODAY_PAUSE_MS`, `ZERODAY_DWELL_MS`,
`ZERODAY_PLAY_URL`. Live also: `ZERODAY_LIVE_ENDPOINT`, `ZERODAY_LIVE_MODEL`,
`ZERODAY_LIVE_REPO`, `ZERODAY_LIVE_CWE`.

Local re-records land under `artifacts/desk-ui-demo/*.webm` (gitignored). Do **not**
commit the binaries — re-upload to the `desk-demos` release when publishing for
strangers. Keep posters + this README tracked; skip hash-named Playwright videos,
journey JSON logs, and the full screenshot set.
