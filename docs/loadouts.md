# Vendor Loadouts

> Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, AWS — what each unlocks.

[Open in app](http://localhost:3333/docs/loadouts)

| Loadout | Focus |
| --- | --- |
| cisco | DNA / Meraki / ISE / IOS / Firepower |
| splunk | Search, apps, SPL hygiene, Cisco→Splunk sources, detection gaps |
| paloalto | Panorama rules, threat profiles, GlobalProtect, Prisma, XSOAR |
| fortinet | FortiGate policy/VPN/IPS, FortiAnalyzer, FortiSIEM gaps |
| crowdstrike | Falcon hosts, detections, Spotlight, IOA, Identity (+ gated RTR) |
| aws | Security Hub, GuardDuty, IAM Analyzer, CloudTrail, Config, WAF, S3 |

## Brief detection examples

- “…Cisco DNA Center and Splunk…” → cisco + splunk
- “…Palo Alto Panorama and Fortinet FortiGate…” → paloalto + fortinet
- “…CrowdStrike Falcon and AWS Security Hub…” → crowdstrike + aws

## Add your own loadout

1. Create adapters under src/<vendor>/adapters/
2. Register VendorLoadout + LOADOUT_ROLE_TOOLS in src/loadouts/registry.ts
3. Wire tools in src/arsenal/registry.ts
4. Extend detectLoadoutsFromBrief and finding synthesis
