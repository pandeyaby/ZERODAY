/**
 * Example mission seed data — multi-vendor security stack assessments.
 */

import { defaultPhases } from "@/agents/operators";
import { dbRepo } from "@/lib/db/repo";
import type { Mission } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";

export function buildExampleMissions(): Mission[] {
  const now = nowIso();

  const m1: Mission = {
    id: uid("mis"),
    name: "Cisco DNA + Splunk Staging Kill Chain",
    objective:
      "Perform full kill-chain assessment on Cisco DNA Center and Splunk deployment in staging. Validate controls, detection coverage, and config hygiene.",
    naturalLanguageBrief:
      "Perform full kill chain assessment on our Cisco DNA Center and Splunk deployment in staging environment",
    status: "draft",
    loadouts: ["cisco", "splunk"],
    targets: [
      {
        id: uid("tgt"),
        hostname: "dnac.staging.lab",
        product: "Cisco DNA Center",
        vendor: "Cisco",
        environment: "staging",
        notes: "Read-only API credentials via vault — not stored in ZERODAY",
      },
      {
        id: uid("tgt"),
        hostname: "ise.staging.lab",
        product: "Cisco ISE",
        vendor: "Cisco",
        environment: "staging",
      },
      {
        id: uid("tgt"),
        hostname: "splunk.staging.lab",
        product: "Splunk Enterprise",
        vendor: "Splunk",
        environment: "staging",
        url: "https://splunk.staging.lab:8000",
      },
      {
        id: uid("tgt"),
        cidr: "10.10.20.0/24",
        environment: "staging",
        notes: "Fabric underlay management",
      },
    ],
    authorization: {
      id: uid("auth"),
      authorizedBy: "Security Lead (example)",
      authorizedAt: now,
      expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
      scopeSummary: "Staging DNA Center, ISE, Splunk, and 10.10.20.0/24 only",
      rulesOfEngagement:
        "safe_local default. No production. No config pushes. No credential dumping into evidence. receipt_required for SSH exec / spicy scanners.",
      writtenApprovalRef: "TICKET-SEC-2026-0711",
      acknowledged: false,
    },
    phases: defaultPhases(),
    createdAt: now,
    updatedAt: now,
    tags: ["cisco", "splunk", "staging", "example"],
  };

  const m2: Mission = {
    id: uid("mis"),
    name: "Splunk Detection Engineering — Cisco Sources",
    objective:
      "Purple-team validation of Cisco→Splunk sourcetypes, SPL hygiene in shared apps, and ATT&CK coverage gaps.",
    status: "draft",
    loadouts: ["splunk", "cisco"],
    targets: [
      {
        id: uid("tgt"),
        hostname: "splunk.staging.lab",
        product: "Splunk ES",
        vendor: "Splunk",
        environment: "staging",
      },
    ],
    authorization: {
      id: uid("auth"),
      authorizedBy: "Detection Eng Lead",
      authorizedAt: now,
      scopeSummary: "splunk.staging.lab metadata searches only",
      rulesOfEngagement: "No raw event export. Metadata aggregations only.",
      acknowledged: false,
    },
    phases: defaultPhases().filter((p) =>
      ["coordinator", "recon", "ghost", "analyst"].includes(p.operatorRole)
    ),
    createdAt: now,
    updatedAt: now,
    tags: ["splunk", "detection", "example"],
  };

  const m3: Mission = {
    id: uid("mis"),
    name: "Palo Alto + Fortinet Edge Posture",
    objective:
      "Audit Panorama/FortiGate edge policies, VPN posture, threat/IPS coverage, and SOAR/SIEM detection gaps in staging.",
    naturalLanguageBrief:
      "Assess Palo Alto Panorama and Fortinet FortiGate staging edge — rules, GlobalProtect, SSL-VPN, IPS",
    status: "draft",
    loadouts: ["paloalto", "fortinet"],
    targets: [
      {
        id: uid("tgt"),
        hostname: "panorama.staging.lab",
        product: "Panorama",
        vendor: "Palo Alto",
        environment: "staging",
      },
      {
        id: uid("tgt"),
        hostname: "fortimanager.staging.lab",
        product: "FortiManager",
        vendor: "Fortinet",
        environment: "staging",
      },
      {
        id: uid("tgt"),
        hostname: "fg-edge-01.staging.lab",
        product: "FortiGate",
        vendor: "Fortinet",
        environment: "staging",
      },
    ],
    authorization: {
      id: uid("auth"),
      authorizedBy: "Network Security Lead",
      authorizedAt: now,
      scopeSummary: "Staging Panorama + FortiManager/FortiGate only",
      rulesOfEngagement: "safe_local. No config commits. No VPN user session disruption.",
      writtenApprovalRef: "TICKET-SEC-2026-EDGE",
      acknowledged: false,
    },
    phases: defaultPhases(),
    createdAt: now,
    updatedAt: now,
    tags: ["paloalto", "fortinet", "staging", "example"],
  };

  const m4: Mission = {
    id: uid("mis"),
    name: "CrowdStrike Falcon + AWS Security Lab",
    objective:
      "Validate Falcon sensor/IOA/Spotlight posture and AWS Security Hub, GuardDuty, IAM, CloudTrail, S3 exposure in lab account.",
    naturalLanguageBrief:
      "Run CrowdStrike Falcon and AWS Security Hub / GuardDuty / IAM assessment on staging lab account",
    status: "draft",
    loadouts: ["crowdstrike", "aws"],
    targets: [
      {
        id: uid("tgt"),
        hostname: "api.crowdstrike.com",
        product: "Falcon",
        vendor: "CrowdStrike",
        environment: "staging",
        notes: "Cloud API metadata only",
      },
      {
        id: uid("tgt"),
        hostname: "123456789012",
        product: "AWS Account",
        vendor: "AWS",
        environment: "staging",
        notes: "Lab account 123456789012",
      },
    ],
    authorization: {
      id: uid("auth"),
      authorizedBy: "Cloud Security Lead",
      authorizedAt: now,
      scopeSummary: "Falcon tenant metadata + AWS lab account 123456789012",
      rulesOfEngagement:
        "safe_local. No RTR without receipt. No production AWS accounts. Redact secrets.",
      writtenApprovalRef: "TICKET-SEC-2026-CLOUD",
      acknowledged: false,
    },
    phases: defaultPhases(),
    createdAt: now,
    updatedAt: now,
    tags: ["crowdstrike", "aws", "staging", "example"],
  };

  return [m1, m2, m3, m4];
}

/**
 * Seed example missions. Adds any missing example by name (safe for upgrades).
 */
export function seedExamples(): boolean {
  const existing = dbRepo.listMissions();
  const byName = new Set(existing.map((m) => m.name));
  let added = false;
  for (const mission of buildExampleMissions()) {
    if (!byName.has(mission.name)) {
      dbRepo.saveMission(mission);
      added = true;
    }
  }
  return added || existing.length === 0;
}
