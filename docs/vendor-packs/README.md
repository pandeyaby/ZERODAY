# Vendor operator packs

ZERODAY writes **local files** for each security desk. Your team owns ingest.
There is **no** partnership claim, **no** live push, and **no** credentials bundled.

| Desk | File | How *your* team ingests |
|------|------|-------------------------|
| **Cisco** | `report.sarif` (+ Foundry Detector-lane candidates in report.md) | Upload SARIF to Code Scanning / review as Detector-lane **candidates**. Compose [Foundry Security Spec](https://github.com/CiscoDevNet/foundry) — do not replace. |
| **Splunk** | `splunk-cim-vulnerabilities.json` | Customer TA: sourcetype `zeroday:antares:json` → CIM Vulnerabilities. Your credentials. |
| **Palo Alto** | `xsoar-incidents.json` | Customer XSOAR mapper / generic webhook. No live incident POST. |
| **Fortinet** | `fortisiem-custom.json` | Customer FortiSIEM parser or rawupload. No live `/rawupload`. |
| **CrowdStrike** | `crowdstrike-hec-events.ndjson` | Customer HEC / LogScale ingest token. No live HEC. |
| **AWS Security** | `asff-findings.json` | Replace `AwsAccountId` placeholders; **your** process calls `BatchImportFindings`. |

Patch drafts remain human-gated (`zeroday draft-fix --i-asked-for-a-fix`) and compose
[Project CodeGuard](https://project-codeguard.org/) — never auto-merge.

See also [`docs/exporters.md`](../exporters.md).
