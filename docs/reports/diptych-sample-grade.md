# SAMPLE / ILLUSTRATIVE — DIPTYCH-shaped grade report

> **Not a live DIPTYCH harness run.** Regenerated keyless from ZeroDay
> `paired-probe` emit envelopes + local `gate_axis_mutate`. DIPTYCH grades;
> ZeroDay emits. Localization ≠ exploitability. No PoC / AUROC theater.

| Field | Value |
|-------|-------|
| kind | `zeroday.diptych_sample_grade/v1` |
| sample | `true` |
| live_diptych_run | `false` |
| diptych_schema | `0.2` |
| emit_content_sha256 | `35693114b3bf7898c05d9164e046b7cbc385b06f5fc3ae1974c26f5e60bf58f7` |
| story | FREEZEDRY…VARSCALE all-green story — emit twins + gate_axis_mutate power on every claimed-green cell. |

## Stranger path (no DIPTYCH clone required)

```bash
npm install
npm run paired-probe
# → zeroday-reports/paired-probe/  (+ diptych-probes/)
npm run paired-probe:sample-report
# → refreshes docs/reports/diptych-sample-grade.md + .json
```

Optional: clone [DIPTYCH](https://github.com/pandeyaby/DIPTYCH) and point its
grader at `zeroday-reports/paired-probe/` for a **live** grade — that step is
not required to read this sample.

## Coverage matrix (ZeroDay emit)

| Operator | Cell | Justification |
|----------|------|---------------|
| **FREEZEDRY** | green | Freeze rng+clock via serialize_restore of LocalizationResult → identical decision_fingerprint; un… |
| **RESEED** | green | meta.seed reshuffles multi-finding ranks; seed-independent grade stays ≤ε; seed-leaking policy ex… |
| **SCHEMAX** | green | Documented result.* + sarif.* required key sets equal across rules vs recording fixtures; drop/re… |
| **SIGNFLIP** | green | Signed score_margin=score(top1)−score(top2) from evidence weights; flip+re-sort preserves odd-sym… |
| **SATEXTEND** | green | Antares/ZERODAY tool-budget clip [1,50] via resolveLiveToolBudget is a real saturation bound; uns… |
| **HISTSWAP** | green | explorationTrace is the real history delay-line; clean self-splice preserves digest; alt-history … |
| **TRAJSWAP** | green | crn_closed_loop: explorationTrace trajectory + nonempty closed_loop_residual=1−Jaccard(proposed,v… |
| **VARSCALE** | green | crn_closed_loop: meta.var_scale jitters evidence weights; variance_proxy mean-matched on mean_fin… |

## Illustrative grade cells (DIPTYCH `GradeResult` shape)

Each cell’s `actual_verdict` **mirrors** the emit `expected_verdict`
(conforming→pass, violating→fail). That is the design-partner story ZeroDay
CI already gates — not a claim that `diptych.grade` was executed in this repo.

| Operator | Role | expected | actual (illustrative) | match | probe_id |
|----------|------|----------|------------------------|-------|----------|
| FREEZEDRY | conforming | pass | pass | yes | `zeroday.freezedry.conforming` |
| FREEZEDRY | violating | fail | fail | yes | `zeroday.freezedry.violating` |
| RESEED | conforming | pass | pass | yes | `zeroday.reseed.conforming` |
| RESEED | violating | fail | fail | yes | `zeroday.reseed.violating` |
| SCHEMAX | conforming | pass | pass | yes | `zeroday.schemax.conforming` |
| SCHEMAX | violating | fail | fail | yes | `zeroday.schemax.violating` |
| SIGNFLIP | conforming | pass | pass | yes | `zeroday.signflip.conforming` |
| SIGNFLIP | violating | fail | fail | yes | `zeroday.signflip.violating` |
| SATEXTEND | conforming | pass | pass | yes | `zeroday.satextend.conforming` |
| SATEXTEND | violating | fail | fail | yes | `zeroday.satextend.violating` |
| HISTSWAP | conforming | pass | pass | yes | `zeroday.histswap.conforming` |
| HISTSWAP | violating | fail | fail | yes | `zeroday.histswap.violating` |
| TRAJSWAP | conforming | pass | pass | yes | `zeroday.trajswap.conforming` |
| TRAJSWAP | violating | fail | fail | yes | `zeroday.trajswap.violating` |
| VARSCALE | conforming | pass | pass | yes | `zeroday.varscale.conforming` |
| VARSCALE | violating | fail | fail | yes | `zeroday.varscale.violating` |

## Axis power (`gate_axis_mutate`)

Real ZeroDay CI proof: mutate **only** the operator axis on the conforming
state → grade must flip pass→fail.

| Operator | Axis | conforming→pass | mutate→fail | Detail |
|----------|------|-----------------|-------------|--------|
| FREEZEDRY | `freeze_channels` | yes | yes | freeze→identical; unfreeze+clock/rng leak→diverge |
| RESEED | `meta.seed / grade policy` | yes | yes | seed-independent≤ε; seed-leak>ε |
| SCHEMAX | `required_schema_keys` | yes | yes | required keys equal; drop/rename → unequal |
| SIGNFLIP | `score_margin polarity` | yes | yes | flip+re-sort preserves; flip-without-reorder fails |
| SATEXTEND | `sat_lo/sat_hi clip` | yes | yes | clip holds in [1,50]; unsaturated leak enters violation |
| HISTSWAP | `hist_splice_at integrity` | yes | yes | clean splice preserves; corrupt splice diverges |
| TRAJSWAP | `traj_swap_at / closed_loop_residual` | yes | yes | valid mid-swap residual≤eps; poison submit swap >eps |
| VARSCALE | `meta.var_scale` | yes | yes | low var_scale ≤var_eps; raised var_scale breaks bound (mean-matched) |

## Honest non-claims

- Sample ≠ product proof of exploitability
- Greens are hyperproperty adapter cells (FREEZEDRY…VARSCALE), not vuln proof
- DIPTYCH grades; ZeroDay emits — this file is an illustrative DIPTYCH-shaped mirror
- Not a live DIPTYCH harness run unless you clone DIPTYCH and point it at the emit
- No PoC / AUROC / attack-procedure theater
- needs_human stays true; never auto-merge

## How DIPTYCH would grade these emits

1. Load each `paired-probe/<OP>/{conforming,violating}.json` envelope
   (`diptych_schema` 0.2, `source=zeroday`).
2. Run the per-operator substantive grader (FREEZEDRY fingerprint
   identity, RESEED stability≤ε, …, VARSCALE mean-matched variance).
3. Require conforming→pass **and** violating→fail for a green cell.
4. Require `gate_axis_mutate` power (ZeroDay already proves this in CI).

Related: [`docs/paired-probes.md`](../paired-probes.md) ·
[`docs/diptych-onepager.md`](../diptych-onepager.md) ·
[DIPTYCH](https://github.com/pandeyaby/DIPTYCH).
