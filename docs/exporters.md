# Defender exporters

ZERODAY projects `report.json` into **local files** only. No BatchImportFindings, no Splunk push, no XSOAR incident POST, no FortiSIEM `/rawupload`, no CrowdStrike HEC live call.

## Formats

| `--format` | Output file | Notes |
|------------|-------------|-------|
| `sarif` | `report.sarif` | SARIF 2.1.0, note severity, partialFingerprints |
| `asff` | `asff-findings.json` | ASFF 2018-10-08; FindingProviderFields severity; Types use **CWE** |
| `splunk` | `splunk-cim-vulnerabilities.json` | CIM Vulnerabilities; sourcetype `zeroday:antares:json` (customer TA) |
| `xsoar` | `xsoar-incidents.json` | Mapper-ready incident dicts |
| `fortisiem` | `fortisiem-custom.json` | Generic JSON for customer parser |
| `crowdstrike` | `crowdstrike-hec-events.ndjson` | HEC objects; no `#cps` tags |

## Field posture

- Never invent CVEs, CVSS, line numbers, or exploit flags
- Omit `StartLine` / SARIF `region` when unknown
- Severity is informational / note — Detector-lane candidates awaiting human triage
