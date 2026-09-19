# Paired probes — ZERODAY → DIPTYCH (diptych_schema 0.2)

Emit-only adapter for [DIPTYCH](https://github.com/pandeyaby/DIPTYCH)
hyperproperty / paired-trace grading. **ZERODAY does not implement DIPTYCH’s
operator orchestration** — we emit conforming + violating probe pairs; DIPTYCH
grades.

**DIPTYCH is optional.** Core `locate` / Desk / SARIF work without it. This
adapter is paired-probe / trust tooling, not a runtime dependency.

![ZERODAY trust pipeline — Desk → locate → SARIF/evidence → optional DIPTYCH](./images/zeroday-trust-pipeline.svg)

Architecture figure:
[`images/zeroday-diptych-architecture.png`](./images/zeroday-diptych-architecture.png).

Canonical enums + per-op table: [`diptych-onepager.md`](./diptych-onepager.md)
(mirrored from DIPTYCH ONEPAGER; **0.1 rejected**).

Witness recipes (SIGNFLIP / TRAJSWAP / VARSCALE): DIPTYCH
`WITNESSES_ZERODAY.md` (GRAX uplift off #41).

## What a single `/play` Desk session does **NOT** prove

- **Not exploitability** — localization candidates ≠ proof a vuln is exploitable
- **Not bit-reproducible science** — Desk UI is interactive; timestamps, human
  clicks, and live endpoints are not a FREEZEDRY freeze mask
- **Not full DIPTYCH hyperproperty coverage** — one Desk session is one open-loop
  trace, not a graded probe pair
- **Not auto-merge** — never merges; `needs_human` stays true
- **Not a Cisco product**

## What CI **does** prove (this repo)

Required on `main` / `pull_request` via the `paired-probe` job in
[`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml)
([badge on README](../README.md) · stranger one-pager [`ci-trust.md`](./ci-trust.md)).
After #41/#42: **all-8 green** + `gate_axis_mutate`. Keyless / offline —
**no GPU**, no HF, no spend in this gate.

| Operator | Cell | Hyperproperty (DIPTYCH) | Why the ZeroDay channel is a valid witness |
|----------|------|-------------------------|--------------------------------------------|
| **FREEZEDRY** | green | Freeze rng+clock → identical `decision_fingerprint`; unfrozen leak → diverge | `serialize_restore` of `LocalizationResult` + SARIF graded keys (`ruleId`, `level`, `uri`, region, partialFingerprints) |
| **RESEED** | green | Seeds differ; `channels.stability` ≤ ε vs > ε | `meta.seed` reshuffles multi-finding `rankedFiles` (mulberry32); conforming grades seed-independent identity; violating leaks seed into fp |
| **SCHEMAX** | green | Required schema key sets equal vs rename/drop | Documented `result.*` / `sarif.*` keys on rules vs recording fixtures — not cosmetic renames |
| **SATEXTEND** | green | `sat_lo`/`sat_hi` clip holds vs unsaturated leak | Real Antares/ZERODAY `--tool-budget` clip via `resolveLiveToolBudget` **[1, 50]** — saturation bound, not result-count |
| **HISTSWAP** | green | History splice integrity vs corruption | `explorationTrace` is the localize history delay-line; `hist_splice_at` + alt-history cassette |
| **SIGNFLIP** | green | Odd-symmetric order under `score_margin` sign flip | `meta.signflip_channel=score_margin`; `channels.score_margin.values=score(top1)−score(top2)` from evidence weights (can be negative); flip+re-sort preserves sign-normalized fp; flip-without-reorder fails. Rejected thin: SARIF level rename, negate ranks only |
| **TRAJSWAP** | green | Mid-horizon traj swap; residual ≤ε vs >ε | `coupling=crn_closed_loop`; trajectory from `explorationTrace`; nonempty `closed_loop_residual=1−Jaccard(proposed,verified)`; `meta.traj_swap_at`. Rejected thin: empty residual, rankedFiles-only permute, open_loop |
| **VARSCALE** | green | `var_scale` on exploration noise; mean-matched dispersion | `meta.var_scale` jitters evidence weights; `variance_proxy` + `mean_finding_count` matched; ≤`var_eps` vs break. Rejected thin: AUROC, rank/count scaling as variance |

`deferred` / `inconclusive` **≠ green**. Prefer honest deferral over cosmetic greens.
All 8 cells are green under the WITNESSES_ZERODAY recipes above.

## Run (keyless / offline)

```bash
npm run paired-probe
# or:
npm run zeroday -- paired-probe --output zeroday-reports
npm run test:paired-probes
```

### Stranger trust loop (≤3 commands)

One-screen story for design partners after locate — Desk UI / CLI → paired-probe
artifacts → checked-in sample DIPTYCH-shaped grade **without cloning DIPTYCH**:

```bash
npm run mvp                                                      # 1 · fixture locate → SARIF
npm run paired-probe:from-sarif -- --sarif zeroday-reports/mvp   # 2 · envelopes + matrix
# 3 · open sample grade (illustrative): docs/reports/diptych-sample-grade.md
```

One-shot (fixture SARIF → emit + print paths): `npm run trust-loop`  
(or `npm run trust-loop -- --mvp` to run fixture locate first).

| Step | What you get |
|------|----------------|
| 1 `mvp` / locate | `zeroday-reports/mvp/report.sarif` (keyless fixture) |
| 2 `paired-probe:from-sarif` | `zeroday-reports/…/paired-probe/` envelopes + `coverage/matrix.json` |
| 3 sample grade docs | [`reports/diptych-sample-grade.md`](./reports/diptych-sample-grade.md) (checked-in; illustrative) |

**Honest non-claims:** localization ≠ exploitability · no AUROC · DIPTYCH grades ·
ZeroDay emits · sample grade is **not** a live DIPTYCH harness run · `needs_human`
stays true. Trust pack: [`design-partner-trust.md`](./design-partner-trust.md) ·
help: [`SUPPORT.md`](../SUPPORT.md). Desk FAQ tab mirrors the same door
(`npm run play` → FAQ).

### Stranger door — locate SARIF / vault → paired-probe (no DIPTYCH clone)

Already have a locate `report.sarif`, `report.json`, or vault dir on disk?
One command emits the same envelopes + coverage matrix — **no GPU**, no
DIPTYCH clone, no HF token:

```bash
# from a SARIF file (in-repo sample works keyless):
npm run paired-probe:from-sarif -- --sarif fixtures/locate/ingest-sample/sample.sarif

# from a locate / vault directory (prefers report.json, else report.sarif):
npm run paired-probe:from-sarif -- --sarif zeroday-reports/mvp

# same door via the paired-probe flag:
npm run paired-probe -- --sarif path/to/report.sarif --output zeroday-reports
```

Pipeline: **locate → SARIF → `paired-probe:from-sarif` → optional DIPTYCH grade**
(or `npm run paired-probe:sample-report` for an illustrative DIPTYCH-shaped
mirror without cloning DIPTYCH).

**Honest non-claims:** emit-only; greens are adapter hyperproperties
(FREEZEDRY…VARSCALE), **not** exploitability; DIPTYCH grades (ZeroDay emits);
`needs_human` stays true; no PoC / AUROC theater.

### Artifacts

```
zeroday-reports/paired-probe/<OP>/{conforming,violating}.json   # diptych_schema 0.2 envelopes
zeroday-reports/diptych-probes/<OP>/{conforming,violating}/cassette.json|.bin
zeroday-reports/paired-probe/coverage/matrix.json
```

### Design-partner door — sample DIPTYCH-shaped grade (no DIPTYCH clone)

Strangers should see the **emit → grade-report** story without cloning
[DIPTYCH](https://github.com/pandeyaby/DIPTYCH) first:

```bash
npm run paired-probe                 # emit envelopes under zeroday-reports/paired-probe/
npm run paired-probe:sample-report   # regenerate checked-in sample grade
```

Checked-in sample (always labeled **sample / illustrative**):

- [`docs/reports/diptych-sample-grade.md`](./reports/diptych-sample-grade.md)
- [`docs/reports/diptych-sample-grade.json`](./reports/diptych-sample-grade.json)

**Honest non-claims:** the sample mirrors DIPTYCH’s `GradeResult` shape from
local emit envelopes + ZeroDay `gate_axis_mutate` proofs. It is **not** a live
DIPTYCH harness invocation unless you clone DIPTYCH and point it at
`zeroday-reports/paired-probe/`. Greens are hyperproperty adapter cells
(FREEZEDRY…VARSCALE) — localization ≠ exploitability. DIPTYCH grades; ZeroDay
emits. No PoC / AUROC theater.

Envelope hard keys: `diptych_schema`, `source="zeroday"`, `operator`, `coupling`,
`probe_id`, `control_role`, `traces` (≥2), `expected_verdict` ∈ {pass,fail,inconclusive}.

Coupling: Wave A/B `open_loop`; **TRAJSWAP + VARSCALE must be `crn_closed_loop`**.

Fingerprints (when graded): `meta.decision_fingerprint` = `sha256:<hex>`,
`meta.rule_ids[]`, `meta.sarif_result_count`. Optional `meta.grade_sarif_keys`.

Hard omit: exploit / PoC / payload / AUROC fields.

## Fingerprint function (FREEZEDRY / decision grading)

Canonical JSON of sorted rows `{ ruleId, level, uri, startLine, endLine, fingerprints[] }`
from SARIF `runs[0].results`, then SHA-256 → `sha256:<hex>`.
**Ignored** unless listed in `grade_sarif_keys`: `message.text`, timings, `generatedAt`,
extra SARIF props.

## GATING (CI fails when)

- Missing operator or missing violating twin
- TODO / stub / NotImplemented / hardcoded pass / empty traces
- Identical twins with no axis contrast on a claimed-green cell
- Green cell without conforming→pass AND violating→fail
- **gate_axis_mutate**: for every claimed-green cell, mutate only that
  operator’s axis on the conforming state and regrade — MUST fail
  (FREEZEDRY freeze mask · RESEED seed policy · SCHEMAX key set ·
  SIGNFLIP score_margin polarity · SATEXTEND sat clip · HISTSWAP splice ·
  TRAJSWAP traj_swap_at residual · VARSCALE var_scale). Prefer deferred
  over thin green if mutate-power cannot be proven.
- TRAJSWAP/VARSCALE without `crn_closed_loop`
- SIGNFLIP green without `score_margin` channel
- TRAJSWAP green with empty `closed_loop_residual`
- VARSCALE green without `var_scale` / `variance_proxy` / `mean_finding_count`
- AUROC / exploit-payload fields

## Design-partner posture

Localization ≠ exploitability. No auto-merge. No spend / no GPU in this CI job.
Not a Cisco product. **DIPTYCH greens ≠ vulnerability proof** — they grade
probe calibration as 2-safety hyperproperties, not exploitability. No exploit
theater. No AUROC-as-product-grade claims.

DIPTYCH consumers: start at
`zeroday-reports/paired-probe/coverage/matrix.json`, then per-op envelopes.
Repo: [github.com/pandeyaby/DIPTYCH](https://github.com/pandeyaby/DIPTYCH).

Related: [`ci-trust.md`](./ci-trust.md) · [`cassette-runbook.md`](./cassette-runbook.md)
· [`paths.md`](./paths.md) · [`design-partner-trust.md`](./design-partner-trust.md)
· root [`README.md`](../README.md)
