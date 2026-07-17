/**
 * Vendor Loadout system — Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, AWS Security.
 */

import type { OperatorRole, ToolDefinition } from "@/lib/types";

export interface VendorLoadout {
  id: string;
  name: string;
  vendor: string;
  description: string;
  products: string[];
  /** Tool IDs contributed by this loadout. */
  toolIds: string[];
  /** Operator prompt addendum. */
  doctrineAddendum: string;
  mitreOverlays?: string[];
  color: string;
}

export const CISCO_LOADOUT: VendorLoadout = {
  id: "cisco",
  name: "Cisco Security Stack",
  vendor: "Cisco",
  description:
    "DNA Center, Meraki, ISE, Firepower/FTD, IOS-XE config analysis, and Cisco advisory correlation.",
  products: ["DNA Center", "Meraki", "ISE", "Firepower", "IOS-XE", "SecureX"],
  toolIds: [
    "cisco.dnac_inventory",
    "cisco.meraki_org_recon",
    "cisco.ise_policy_audit",
    "cisco.ios_config_lint",
    "cisco.advisory_correlate",
    "cisco.firepower_policy_diff",
  ],
  doctrineAddendum: `
Cisco loadout priorities:
- Prefer read-only API adapters (DNA/Meraki/ISE) in safe_local.
- IOS config interaction is receipt_required; never push config changes.
- Correlate findings to Cisco PSIRT advisories when CVEs appear.
- Validate network segmentation claims against ISE policy and DNA fabric intent.
`.trim(),
  mitreOverlays: ["TA0007", "TA0008", "TA0006"],
  color: "#049fd9",
};

export const SPLUNK_LOADOUT: VendorLoadout = {
  id: "splunk",
  name: "Splunk Observability & SIEM",
  vendor: "Splunk",
  description:
    "REST search, app/input analysis, SPL hygiene, Cisco→Splunk integration validation, detection gaps.",
  products: ["Splunk Enterprise", "Splunk Cloud", "SOAR", "Enterprise Security"],
  toolIds: [
    "splunk.rest_search",
    "splunk.app_inventory",
    "splunk.input_audit",
    "splunk.spl_hygiene",
    "splunk.cisco_source_validate",
    "splunk.detection_gap_scan",
  ],
  doctrineAddendum: `
Splunk loadout priorities:
- SPL execution is gated (safe_local simulated or receipt_required against live).
- Never dump raw event payloads containing PII/secrets into evidence.
- Focus on detection engineering: missing sourcetypes, broken Cisco integrations, weak correlation searches.
- Prefer index/metadata queries over full event pulls.
`.trim(),
  mitreOverlays: ["TA0005", "TA0009", "TA0040"],
  color: "#65a637",
};

export const PALOALTO_LOADOUT: VendorLoadout = {
  id: "paloalto",
  name: "Palo Alto Networks",
  vendor: "Palo Alto",
  description:
    "Panorama/PAN-OS rule & threat-profile audit, GlobalProtect posture, Prisma Access, Cortex XSOAR hygiene.",
  products: ["PAN-OS", "Panorama", "Prisma Access", "GlobalProtect", "Cortex XSOAR"],
  toolIds: [
    "paloalto.panorama_device_inventory",
    "paloalto.security_rule_audit",
    "paloalto.threat_profile_check",
    "paloalto.globalprotect_posture",
    "paloalto.prisma_access_inventory",
    "paloalto.cortex_xsoar_playbook_hygiene",
  ],
  doctrineAddendum: `
Palo Alto loadout priorities:
- Prefer Panorama/Prisma read-only inventory and rule audits in safe_local.
- Config commit/push is receipt_required — never auto-push.
- Flag any/any rules, missing threat profiles, and GP MFA gaps.
- XSOAR: no hard-coded secrets; require approval gates on containment playbooks.
`.trim(),
  mitreOverlays: ["TA0008", "TA0011", "TA0006"],
  color: "#f04e23",
};

export const FORTINET_LOADOUT: VendorLoadout = {
  id: "fortinet",
  name: "Fortinet Security Fabric",
  vendor: "Fortinet",
  description:
    "FortiGate policy/VPN/IPS audits, FortiAnalyzer log health, FortiSIEM ATT&CK coverage gaps.",
  products: ["FortiGate", "FortiManager", "FortiAnalyzer", "FortiSIEM", "FortiClient EMS"],
  toolIds: [
    "fortinet.fortigate_inventory",
    "fortinet.firewall_policy_audit",
    "fortinet.ssl_vpn_posture",
    "fortinet.ips_sensor_coverage",
    "fortinet.fortianalyzer_log_health",
    "fortinet.fortisiem_rule_gaps",
  ],
  doctrineAddendum: `
Fortinet loadout priorities:
- Inventory and policy audits are safe_local by default.
- Emphasize any-any policies, SSL-VPN MFA, VIP exposure, and IPS attachment.
- FortiAnalyzer silence/lag is a detection-engineering finding, not just ops noise.
`.trim(),
  mitreOverlays: ["TA0011", "TA0008", "TA0005"],
  color: "#ee3124",
};

export const CROWDSTRIKE_LOADOUT: VendorLoadout = {
  id: "crowdstrike",
  name: "CrowdStrike Falcon",
  vendor: "CrowdStrike",
  description:
    "Falcon host inventory, detection triage, Spotlight CVEs, IOA policy coverage, Identity Protection.",
  products: ["Falcon Insight", "Spotlight", "Identity Protection", "OverWatch", "RTR"],
  toolIds: [
    "crowdstrike.falcon_host_inventory",
    "crowdstrike.detection_triage",
    "crowdstrike.spotlight_vuln_scan",
    "crowdstrike.ioa_coverage",
    "crowdstrike.identity_protection_audit",
  ],
  doctrineAddendum: `
CrowdStrike loadout priorities:
- Metadata-only detection triage — no raw memory/process dumps into evidence.
- Spotlight and IOA gaps drive patching and prevention hardening.
- RTR is receipt_required and lab-scoped only.
- Identity findings should map to AD hardening recommendations.
`.trim(),
  mitreOverlays: ["TA0002", "TA0006", "TA0005"],
  color: "#ec0000",
};

export const AWS_LOADOUT: VendorLoadout = {
  id: "aws",
  name: "AWS Security",
  vendor: "AWS",
  description:
    "Security Hub, GuardDuty, IAM Access Analyzer, CloudTrail hygiene, Config compliance, WAF, S3 exposure.",
  products: [
    "Security Hub",
    "GuardDuty",
    "IAM Access Analyzer",
    "CloudTrail",
    "AWS Config",
    "WAF",
    "S3",
  ],
  toolIds: [
    "aws.security_hub_findings",
    "aws.guardduty_detectors",
    "aws.iam_access_analyzer",
    "aws.cloudtrail_hygiene",
    "aws.config_compliance",
    "aws.waf_webacl_audit",
    "aws.s3_public_exposure",
  ],
  doctrineAddendum: `
AWS Security loadout priorities:
- Account/region must be in mission scope (treat accountId as a scope target).
- Prefer Security Hub + GuardDuty + Config aggregations over raw log pulls.
- Never store AWS access keys in evidence; redact Account credentials.
- S3 exposure checks list bucket names only — no object content enumeration by default.
`.trim(),
  mitreOverlays: ["TA0001", "TA0006", "TA0010"],
  color: "#ff9900",
};

const LOADOUTS: Record<string, VendorLoadout> = {
  cisco: CISCO_LOADOUT,
  splunk: SPLUNK_LOADOUT,
  paloalto: PALOALTO_LOADOUT,
  fortinet: FORTINET_LOADOUT,
  crowdstrike: CROWDSTRIKE_LOADOUT,
  aws: AWS_LOADOUT,
};

export function listLoadouts(): VendorLoadout[] {
  return Object.values(LOADOUTS);
}

export function getLoadout(id: string): VendorLoadout | undefined {
  return LOADOUTS[id];
}

export function resolveLoadouts(ids: string[]): VendorLoadout[] {
  return ids.map((id) => LOADOUTS[id]).filter(Boolean);
}

export function loadoutPromptBlock(ids: string[]): string {
  const loads = resolveLoadouts(ids);
  if (!loads.length) return "";
  return loads.map((l) => `### Loadout: ${l.name}\n${l.doctrineAddendum}`).join("\n\n");
}

/** Roles that primarily use a given loadout tool set. */
export const LOADOUT_ROLE_HINTS: Record<string, OperatorRole[]> = {
  cisco: ["recon", "scanner", "infiltrator", "analyst"],
  splunk: ["recon", "scanner", "ghost", "analyst", "exfiltrator"],
  paloalto: ["recon", "scanner", "infiltrator", "ghost", "analyst"],
  fortinet: ["recon", "scanner", "ghost", "analyst", "infiltrator"],
  crowdstrike: ["recon", "scanner", "ghost", "analyst", "infiltrator"],
  aws: ["recon", "scanner", "ghost", "analyst", "exfiltrator", "infiltrator"],
};

/** Preferred tools per loadout × role for mission orchestration. */
export const LOADOUT_ROLE_TOOLS: Record<string, Partial<Record<OperatorRole, string[]>>> = {
  cisco: {
    recon: ["cisco.dnac_inventory", "general.nmap_syn"],
    scanner: ["cisco.ise_policy_audit", "cisco.ios_config_lint"],
    infiltrator: ["cisco.ise_policy_audit"],
    analyst: ["cisco.advisory_correlate"],
  },
  splunk: {
    recon: ["splunk.app_inventory"],
    scanner: ["splunk.spl_hygiene"],
    ghost: ["splunk.detection_gap_scan", "splunk.cisco_source_validate"],
    analyst: ["splunk.spl_hygiene"],
  },
  paloalto: {
    recon: ["paloalto.panorama_device_inventory", "paloalto.prisma_access_inventory"],
    scanner: ["paloalto.security_rule_audit", "paloalto.threat_profile_check"],
    infiltrator: ["paloalto.globalprotect_posture"],
    ghost: ["paloalto.cortex_xsoar_playbook_hygiene"],
    analyst: ["paloalto.security_rule_audit"],
  },
  fortinet: {
    recon: ["fortinet.fortigate_inventory"],
    scanner: ["fortinet.firewall_policy_audit", "fortinet.ips_sensor_coverage"],
    infiltrator: ["fortinet.ssl_vpn_posture"],
    ghost: ["fortinet.fortisiem_rule_gaps", "fortinet.fortianalyzer_log_health"],
    analyst: ["fortinet.firewall_policy_audit"],
  },
  crowdstrike: {
    recon: ["crowdstrike.falcon_host_inventory"],
    scanner: ["crowdstrike.spotlight_vuln_scan", "crowdstrike.detection_triage"],
    infiltrator: ["crowdstrike.identity_protection_audit"],
    ghost: ["crowdstrike.ioa_coverage"],
    analyst: ["crowdstrike.detection_triage"],
  },
  aws: {
    recon: ["aws.s3_public_exposure", "aws.guardduty_detectors"],
    scanner: ["aws.security_hub_findings", "aws.config_compliance", "aws.waf_webacl_audit"],
    infiltrator: ["aws.iam_access_analyzer"],
    ghost: ["aws.cloudtrail_hygiene", "aws.guardduty_detectors"],
    analyst: ["aws.security_hub_findings"],
    exfiltrator: ["aws.s3_public_exposure"],
  },
};

/** Helper used by arsenal registry when merging vendor tools. */
export function annotateVendorTools(tools: ToolDefinition[], vendor: string): ToolDefinition[] {
  return tools.map((t) => ({ ...t, vendor }));
}

/** Detect loadout ids from a natural-language brief. */
export function detectLoadoutsFromBrief(brief: string): string[] {
  const l: string[] = [];
  if (/cisco|dna|meraki|ise|firepower|ios/i.test(brief)) l.push("cisco");
  if (/splunk|siem(?!\s*forti)|soar(?!\s*cortex)/i.test(brief) || /\bsplunk\b/i.test(brief)) {
    l.push("splunk");
  }
  if (/palo\s*alto|pan-?os|panorama|prisma\s*access|globalprotect|cortex\s*xsoar|xsoar/i.test(brief)) {
    l.push("paloalto");
  }
  if (/fortinet|fortigate|fortimanager|fortianalyzer|fortisiem|forticlient/i.test(brief)) {
    l.push("fortinet");
  }
  if (/crowdstrike|falcon|spotlight|overwatch/i.test(brief)) l.push("crowdstrike");
  if (/aws|amazon\s*web|guardduty|security\s*hub|cloudtrail|iam\s*access|waf\b/i.test(brief)) {
    l.push("aws");
  }
  if (!l.length) l.push("cisco", "splunk");
  return [...new Set(l)];
}
