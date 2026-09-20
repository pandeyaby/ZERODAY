# Defender exporters

ZERODAY projects `report.json` into **local files** only. Your platform team owns ingest. No BatchImportFindings, Splunk push, XSOAR incident POST, FortiSIEM `/rawupload`, or CrowdStrike HEC call from this repo.

## How the CUSTOMER ingests each file

| File | Desk | Customer ingest path |
|------|------|----------------------|
| `report.sarif` | GitHub Code Scanning | Upload with `github/codeql-action/upload-sarif` (our Action already does this), `npm run upload-sarif -- --sarif report.sarif` (`--dry-run` for CI; live needs `security_events: write`), or your own workflow. Localization SARIF only — not exploit proof. Severity is **note**. `partialFingerprints` for dedupe. Omit invented line regions. |
| `asff-findings.json` | AWS Security Hub | Replace `AwsAccountId` / custom `ProductArn` placeholders, then **your** automation calls `BatchImportFindings` (or a product ARN you registered). SchemaVersion always `2018-10-08`. Severity lives under `FindingProviderFields`. `Types` = `Software and Configuration Checks/Vulnerabilities/<CWE-id>` — never invent a CVE. `Resources.Type=Other` + `Details.Other` for the file path. |
| `splunk-cim-vulnerabilities.json` | Splunk CIM / ESCU | Customer TA: sourcetype **`zeroday:antares:json`**. Map CIM Vulnerabilities: `dest`, `dvc`, `signature`, `severity` (`informational`), `category`, `xref` (CWE), `signature_id`, `vendor_product`. Emit `cve` only when the advisory input was a real CVE; never invent `cvss`. Not ES Notable JSON. |
| `xsoar-incidents.json` | Cortex XSOAR | JSON **array** of incident dicts → customer mapper / generic integration (`type`, `name`, `occurred`, `severity`, `details`, `cwe`, `file_path`). XSOAR does not natively ingest SARIF. No live incident POST. |
| `fortisiem-custom.json` | FortiSIEM | Customer XML parser or rawupload against generic keys (`vendor`, `model`, `eventType`, `severity`, `cwe`, `filePath`, `title`, `description`, `occurred`). No official finding schema. Do not claim `PH_DEV_MON_CUSTOM_JSON` as ours. No live `/rawupload`. |
| `crowdstrike-hec-events.ndjson` | CrowdStrike LogScale | Customer HEC / ingest token ships one JSON object per line (`host`, `message`, `cwe`, `file_path`, `signature`, `severity`, `vendor`, `product`). No `#cps` tags. No live HEC. |

## Posture

- Detector-lane **candidates** (Foundry) — human triage for true-positive
- Never invent CVEs, CVSS, line numbers, or exploit flags
- Omit `StartLine` / SARIF `region` when unknown
- Severity is informational / note

## CLI

```bash
npm run zeroday -- export --format asff --from path/to/report.json
```
