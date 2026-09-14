# SARIF ingest sample (Keyless K2)

Minimal SARIF 2.1 fixture with CodeQL-style + Semgrep-style results for
`zeroday locate --from-sarif`. Not a live scan; not exploitability proof.

```bash
npm run zeroday -- locate --from-sarif fixtures/locate/ingest-sample/sample.sarif
npm run zeroday -- locate --from-sarif fixtures/locate/ingest-sample/sample.sarif --cwe CWE-89
```
