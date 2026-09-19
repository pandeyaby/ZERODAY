# First-time users

Same skim path as the [root README](../README.md) — three steps, then optional
doors.

1. `git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY`
   (or [Open in GitHub Codespaces](https://codespaces.new/pandeyaby/ZERODAY) — no local Node)
2. `npm install` (Codespace runs this in `postCreateCommand`)
3. `npm run mvp` → expect **PASS** and SARIF under `zeroday-reports/mvp/`
   · or prove both doors: `npm run stranger:verify` (Door A PASS + Door B citation)
4. Optional UI: `npm run play` → http://localhost:3333/play (Desk Console)
5. Optional live checklist ($0): `npm run zeroday -- antares doctor`
6. Optional local completions checklist ($0): `npm run zeroday -- doctor`

You do not need a GPU or Hugging Face token for the MVP / fixture / Desk path.
Codespace ≠ live Antares (Door B stays citation-only there). Live Antares is
opt-in and costs $. Full door map: [`paths.md`](./paths.md) · walkthrough:
[`getting-started.md`](./getting-started.md) · prove-doors:
[`stranger-verify.md`](./stranger-verify.md)
