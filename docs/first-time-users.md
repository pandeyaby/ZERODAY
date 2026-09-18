# First-time users

Same skim path as the [root README](../README.md) — three steps, then optional
doors.

1. `git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY`
2. `npm install`
3. `npm run mvp` → expect **PASS** and SARIF under `zeroday-reports/mvp/`
4. Optional UI: `npm run play` → http://localhost:3333/play (Desk Console)
5. Optional live checklist ($0): `npm run zeroday -- antares doctor`
6. Optional local completions checklist ($0): `npm run zeroday -- doctor`

You do not need a GPU or Hugging Face token for the MVP / fixture / Desk path.
Live Antares is opt-in and costs $. Full door map: [`paths.md`](./paths.md) ·
walkthrough: [`getting-started.md`](./getting-started.md)
