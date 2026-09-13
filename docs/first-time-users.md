# First-time users

1. `git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY`
2. `npm install`
3. `npm run mvp` → expect **PASS** and SARIF under `zeroday-reports/mvp/`
4. Optional playground UI (same fixtures): `npm run play` → http://localhost:3333/play
5. Live Antares (opt-in, costs $): `npm run zeroday -- antares doctor` (print-only — no spend)

You do not need a GPU or Hugging Face token for the MVP / fixture / playground path.
