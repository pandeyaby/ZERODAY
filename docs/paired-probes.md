# Paired probes — ZERODAY → DIPTYCH (diptych_schema 0.2)

Emit-only adapter for DIPTYCH hyperproperty grading. **ZERODAY does not
implement DIPTYCH’s operator orchestration** — we emit conforming + violating
probe pairs; DIPTYCH grades.

Canonical enums + per-op table: [`diptych-onepager.md`](./diptych-onepager.md)
(mirrored from DIPTYCH ONEPAGER; **0.1 rejected**).

## What a single `/play` Desk session does **NOT** prove

- **Not exploitability** — localization candidates ≠ proof a vuln is exploitable
- **Not bit-reproducible science** — Desk UI is interactive; timestamps, human
  clicks, and live endpoints are not a FREEZEDRY freeze mask
- **Not full DIPTYCH hyperproperty coverage** — one Desk session is one open-loop
  trace, not a graded probe pair
- **Not auto-merge** — never merges; `needs_human` stays true
- **Not a Cisco product**

## What CI **does** prove (this repo)

| Operator | Cell | Hyperproperty (DIPTYCH) | Why the ZeroDay channel is a valid witness |
|----------|------|-------------------------|--------------------------------------------|
| **FREEZEDRY** | green | Freeze rng+clock → identical `decision_fingerprint`; unfrozen leak → diverge | `serialize_restore` of `LocalizationResult` + SARIF graded keys (`ruleId`, `level`, `uri`, region, partialFingerprints) |
| **RESEED** | green | Seeds differ; `channels.stability` ≤ ε vs > ε | `meta.seed` reshuffles multi-finding `rankedFiles` (mulberry32); conforming grades seed-independent identity; violating leaks seed into fp |
| **SCHEMAX** | green | Required schema key sets equal vs rename/drop | Documented `result.*` / `sarif.*` keys on rules vs recording fixtures — not cosmetic renames |
| **SATEXTEND** | green | `sat_lo`/`sat_hi` clip holds vs unsaturated leak | Real Antares/ZERODAY `--tool-budget` clip via `resolveLiveToolBudget` **[1, 50]** — saturation bound, not result-count |
| **HISTSWAP** | green | History splice integrity vs corruption | `explorationTrace` is the localize history delay-line; `hist_splice_at` + alt-history cassette |
| **SIGNFLIP** | deferred | — | No signed continuous polarity channel (levels categorical; ranks positive ordinals). `deferred_without_semantic_witness` |
| **TRAJSWAP** | deferred | — | No `closed_loop_residual` / CRN trajectory on open-loop locate. Coupling tagged `crn_closed_loop` but inconclusive |
| **VARSCALE** | deferred | — | No `variance_proxy`; rank scale ≠ variance; AUROC hard-omitted |

`deferred` / `inconclusive` **≠ green**. Prefer honest deferral over cosmetic greens.

## Run (keyless / offline)

```bash
npm run paired-probe
# or:
npm run zeroday -- paired-probe --output zeroday-reports
npm run test:paired-probes
```

### Artifacts

```
zeroday-reports/paired-probe/<OP>/{conforming,violating}.json   # diptych_schema 0.2 envelopes
zeroday-reports/diptych-probes/<OP>/{conforming,violating}/cassette.json|.bin
zeroday-reports/paired-probe/coverage/matrix.json
```

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
- TRAJSWAP/VARSCALE without `crn_closed_loop`
- AUROC / exploit-payload fields

## Design-partner posture

Localization ≠ exploitability. No auto-merge. No spend in this CI job.
Not a Cisco product. DIPTYCH consumers: start at
`zeroday-reports/paired-probe/coverage/matrix.json`, then per-op envelopes.

Related: [`cassette-runbook.md`](./cassette-runbook.md) · [`paths.md`](./paths.md)
