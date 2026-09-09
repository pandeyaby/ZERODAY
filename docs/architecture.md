# Architecture

```
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
```

Live explore may use Docker `network=none`. Fixture + Action stay container-free.
