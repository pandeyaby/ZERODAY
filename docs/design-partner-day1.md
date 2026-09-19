# Design-partner Day-1 checklist

Water-flow for strangers and design partners on public `main`. Sequences what is
already shipped — keyless Door A first, optional Door B **citation** only.
Defensive localization. No PoC / exploit theater. No invented metrics. No GPU
spend from this path.

**Audience:** anyone cloning (or opening a Codespace of) this Apache-2.0 repo.  
**Not a Cisco product.** Not a support SLA.

---

## Day-1 flow (do in order)

### 1 · Open the tree

```bash
git clone https://github.com/pandeyaby/ZERODAY.git && cd ZERODAY
```

Or clone-free: [Open in GitHub Codespaces](https://codespaces.new/pandeyaby/ZERODAY)
(`.devcontainer/` runs `npm install` in `postCreateCommand`). Default Codespace
is CPU / keyless — **not** live Antares.

### 2 · Install + fixture smoke (Door A)

```bash
npm install
npm run mvp
```

Expect **PASS** and SARIF under `zeroday-reports/mvp/`. Proves workstation +
factory shape — not live Antares File F1.

### 3 · Stranger trust loop

```bash
npm run trust-loop
# or: npm run trust-loop -- --mvp   # run fixture locate first
```

Same story as mvp → `paired-probe:from-sarif` → paths printed. Detail:
[`paired-probes.md`](./paired-probes.md).

### 4 · Prove doors + CI trust

```bash
npm run stranger:verify
# alias: npm run doors
# machine-readable: npm run --silent stranger:verify -- --json
```

| Surface | What you get |
|---------|----------------|
| Local / Codespace | Door A **PASS** + Door B **citation** card (no GPU) · optional `--json` for parsers |
| Desk UI | `npm run play` → **Prove doors** tab (copy-paste only) |
| This repo’s Actions badge | `stranger-verify` job on [`zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml) |

Badge honesty: [`ci-trust.md`](./ci-trust.md) · companion:
[`stranger-verify.md`](./stranger-verify.md).

### 5 · Optional — reusable `workflow_call` (other repos)

Point another org’s workflow at ZERODAY’s public prove-doors entry (checks out
**ZERODAY** fixtures/scripts — not the caller’s private tree):

```yaml
jobs:
  stranger-verify:
    uses: pandeyaby/ZERODAY/.github/workflows/stranger-verify.yml@main
```

Full snippet: [`stranger-verify.md`](./stranger-verify.md) § Reusable Actions
workflow · file:
[`.github/workflows/stranger-verify.yml`](../.github/workflows/stranger-verify.yml).

### 6 · Optional Door B — cite Live re-proof only (never auto-provision)

Do **not** run GPU from Day-1. Cite the dated measured session already on
[`gpu-claims.md`](./gpu-claims.md) § Live re-proof (2026-09-19 PT):

- Pod `d65ny3xqf7bwza` · Secure Cloud · NVIDIA A40
- Estimated spend ~$0.034 (under ≤$0.50 ceiling; rate at create $0.49/hr)
- `GET /v1/models` → 200 · `POST /v1/completions` → 200
- Live locate ranked `src/users.js` (CWE-89 fixture) · localization-only

To re-run yourself later: [`runpod-antares.md`](./runpod-antares.md) — **you**
provision + terminate. ZERODAY never auto-provisions pods.

---

## Explicit non-claims

- Localization ≠ exploitability · `needs_human` always · never auto-merge
- No AUROC / File-F1 / org-scale latency SLAs invented here
- DIPTYCH grades separately · ZeroDay emits
- Sample grade ([`reports/diptych-sample-grade.md`](./reports/diptych-sample-grade.md)) is illustrative — not a live DIPTYCH harness run
- CI badge ≠ vuln proof · Codespace ≠ live Antares

---

## Related

| Doc | Role |
|-----|------|
| [`design-partner-trust.md`](./design-partner-trust.md) | Full trust pack (limits + dry-run) |
| [`stranger-verify.md`](./stranger-verify.md) | Prove-doors + Codespaces + reusable workflow |
| [`ci-trust.md`](./ci-trust.md) | What the Actions badge proves / does not |
| [`gpu-claims.md`](./gpu-claims.md) | Proven vs deferred + Live re-proof |
| Root [`README.md`](../README.md) | Skim path · stranger section · design partners |
| [`SUPPORT.md`](../SUPPORT.md) | Help (no SLA) |
