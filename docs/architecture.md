# Architecture

![ZERODAY → DIPTYCH — locate desk → SARIF/cassette → paired probes](./images/zeroday-diptych-architecture.png)

Public spine (defensive, honest):

```
Locate desk (CWE / CVE / GHSA)
        │  keyless mvp · rules · live · recording
        ▼
SARIF / redacted cassette
        │  report.sarif + hashed evidence · human gate
        ▼
ZERODAY paired-probe (emit-only)
        │  8× {conforming, violating} · diptych_schema 0.2
        │  CI: npm run test:paired-probes  (includes gate_axis_mutate)
        ▼
DIPTYCH  (https://github.com/pandeyaby/DIPTYCH)
        │  paired-trace / hyperproperty grade for calibration claims
        └─ ZERODAY does not implement DIPTYCH’s grader
```

**CI required:** `paired-probe` + `gate_axis_mutate` on every PR (see
[`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml)).
Prefer honest `deferred` over cosmetic greens. Localization ≠ exploitability.
No PoCs / exploits / payloads. Never auto-merge.

Docs: [`paired-probes.md`](./paired-probes.md) · [`diptych-onepager.md`](./diptych-onepager.md)
· [`cassette-runbook.md`](./cassette-runbook.md).

---

## Factory / operate / locate (CLI)

```
zeroday factory run --cwe|--cve|--ghsa --repo [--fixture] [--defend] [--i-asked-for-a-fix]
        │
        ├─ inventory → multi-repo paths + config surfaces → locate hints
        ├─ locate (fixture | live Antares | compose with operate)
        ├─ classify (optional fixture scenario)
        ├─ ownership → CODEOWNERS / blame → ownership.md + GitHub comment
        ├─ draft-fix (ONLY with --i-asked-for-a-fix)
        ├─ defend (existing tests / fail-closed — never exploit repro)
        └─ evidence/manifest.json → verify.json → factory.md

zeroday operate --cwe|--cve|--ghsa --repo [--fixture | --from submission.json]
        │
        ├─ resolve advisory → CWE (vendored / optional metadata APIs)
        ├─ read-only snapshot → destroy after run
        ├─ emit OPERATOR_SPEC.md + submission schema + brief
        ├─ accept agent submission (or fixture)
        ├─ validate schema + no-exploit invariant
        ├─ report.json + report.md (evidence citations) + comment.md
        ├─ exporters → sarif | asff | splunk | xsoar | fortisiem | crowdstrike
        └─ evidence/manifest.json (SHA-256) → zeroday verify

zeroday locate  …  optional Antares fixture / live wrap (same artifact spine)
        └─ non-loopback endpoint requires --remote-inference (RunPod / remote CUDA)

zeroday paired-probe [--output zeroday-reports]
        └─ emit DIPTYCH probe pairs (all 8 ops) — keyless / offline

zeroday packet --from <inventory-reports-dir>
        └─ Desk A offline security packet (summary + findings + SARIF; no auto-send)

zeroday harden --from <reports-dir> [--draft]
        └─ Desk C agent/package harden recommendations (recommend-only; optional draft notes; no auto-apply)
```

Live explore may use Docker `network=none`. Fixture + Action stay container-free.
Mac MPS unsupported for schema-faithful live locate — prefer CUDA / RunPod vLLM.
