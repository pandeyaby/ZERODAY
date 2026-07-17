# Evidence, Findings & Retest

> How claims become durable, reviewable security outcomes.

[Open in app](http://localhost:3333/docs/evidence)

## Evidence Vault

- Every tool call stores a timestamped record with SHA-256 hash
- Secrets/API keys are redacted by default
- Click a row in the War Room to expand payload JSON

## Findings Ledger

Findings include severity, confidence, vendor impact, evidence links, MITRE hints, and recommended fixes. Analyst synthesis creates them from tool evidence at end of run.

## Retest Queue

High/critical findings auto-queue. Pass promotes to confirmed; Fail keeps them tentative. Do not treat unretested highs as final.
