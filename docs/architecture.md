# Architecture

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
```

Live explore may use Docker `network=none`. Fixture + Action stay container-free.
Mac MPS unsupported for schema-faithful live locate — prefer CUDA / RunPod vLLM.
