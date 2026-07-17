/**
 * T3MP3ST production adapter — mission/operator patterns bridged into ZERODAY.
 *
 * We intentionally mirror archetype + RoE + kill-chain contracts here rather than
 * importing T3MP3ST's Node runtime (heavy deps). An optional local clone can
 * be used for health checks; health() verifies it when present.
 */

import fs from "fs";
import path from "path";
import type { MissionPhase, OperatorRole } from "@/lib/types";
import { uid } from "@/lib/utils";
import { pliniusLibPresent, pliniusLibRoot } from "@/plinius/paths";

export interface TempestArchetypeProfile {
  role: OperatorRole;
  name: string;
  description: string;
  mitreTactics: string[];
  techniques: string[];
  capabilities: string[];
  suggestedZerodayTools: string[];
}

/** Bridged from T3MP3ST ARCHETYPE_PROFILES → ZERODAY OperatorRole. */
export const TEMPEST_ARCHETYPES: TempestArchetypeProfile[] = [
  {
    role: "recon",
    name: "Reconnaissance Operator",
    description: "OSINT, network discovery, asset enumeration",
    mitreTactics: ["TA0043"],
    techniques: ["T1595", "T1592", "T1589", "T1590"],
    capabilities: ["osint", "dns_enum", "subdomain_discovery", "port_scanning"],
    suggestedZerodayTools: ["recon.port_scan", "cisco.dna_inventory", "splunk.index_survey"],
  },
  {
    role: "scanner",
    name: "Vulnerability Scanner",
    description: "Vulnerabilities and security misconfigurations",
    mitreTactics: ["TA0007"],
    techniques: ["T1046", "T1082", "T1083"],
    capabilities: ["vuln_scanning", "web_scanning", "config_audit"],
    suggestedZerodayTools: ["scanner.nuclei_sim", "cisco.config_audit", "splunk.detection_gaps"],
  },
  {
    role: "exploiter",
    name: "Exploitation Specialist",
    description: "Gated PoC / initial access validation",
    mitreTactics: ["TA0001", "TA0002"],
    techniques: ["T1190", "T1133", "T1078"],
    capabilities: ["exploit_dev", "payload_delivery", "initial_access"],
    suggestedZerodayTools: ["general.ssh_exec", "cisco.ise_policy_probe"],
  },
  {
    role: "infiltrator",
    name: "Lateral Movement Specialist",
    description: "Network traversal and privilege escalation modeling",
    mitreTactics: ["TA0008", "TA0004"],
    techniques: ["T1021", "T1078", "T1068"],
    capabilities: ["priv_esc", "lateral_movement", "credential_access"],
    suggestedZerodayTools: ["cisco.segment_map", "crowdstrike.host_graph"],
  },
  {
    role: "exfiltrator",
    name: "Data Exfiltration Specialist",
    description: "Collection and exfil / stego channel assessment",
    mitreTactics: ["TA0009", "TA0010"],
    techniques: ["T1041", "T1048", "T1567"],
    capabilities: ["data_collection", "exfiltration", "stego"],
    suggestedZerodayTools: ["stego.invisible", "st3gg.analyze", "st3gg.encode"],
  },
  {
    role: "ghost",
    name: "Persistence / OPSEC Specialist",
    description: "Evasion and detection-gap analysis",
    mitreTactics: ["TA0003", "TA0005"],
    techniques: ["T1547", "T1053", "T1070"],
    capabilities: ["persistence", "evasion", "anti_forensics"],
    suggestedZerodayTools: ["splunk.detection_gaps", "ghost.opsec_score"],
  },
  {
    role: "coordinator",
    name: "Mission Coordinator",
    description: "Orchestration, RoE enforcement, phase control",
    mitreTactics: ["TA0011"],
    techniques: ["T1071", "T1095"],
    capabilities: ["orchestration", "task_management", "decision_making"],
    suggestedZerodayTools: ["t3mp3st.roe", "t3mp3st.map_phases"],
  },
  {
    role: "analyst",
    name: "Evidence Analyst",
    description: "Evidence → findings with retest discipline",
    mitreTactics: ["TA0007"],
    techniques: ["T1082"],
    capabilities: ["synthesis", "reporting", "retest"],
    suggestedZerodayTools: ["stego.decode", "st3gg.detect"],
  },
];

export interface TempestRoE {
  profile: "default" | "strict";
  forbiddenTechniques: string[];
  requireManualApproval: string[];
  maxDetectionEvents: number;
  notes: string;
}

export function tempestDefaultRoE(): TempestRoE {
  return {
    profile: "default",
    forbiddenTechniques: [],
    requireManualApproval: ["T1078", "T1059", "T1548"],
    maxDetectionEvents: 5,
    notes: "Bridged from T3MP3ST createDefaultRoE — credential use, command exec, priv-esc need receipts.",
  };
}

export function tempestStrictRoE(): TempestRoE {
  return {
    profile: "strict",
    forbiddenTechniques: ["T1485", "T1489", "T1490", "T1499"],
    requireManualApproval: ["T1078", "T1059", "T1548", "T1055", "T1134"],
    maxDetectionEvents: 2,
    notes: "Bridged from T3MP3ST createStrictRoE — destructive/DoS techniques forbidden.",
  };
}

/** Kill-chain phase order aligned with T3MP3ST → ZERODAY MissionPhase[]. */
export function tempestKillChainPhases(): MissionPhase[] {
  const mk = (name: string, operatorRole: OperatorRole): MissionPhase => ({
    id: uid("ph"),
    name,
    operatorRole,
    status: "pending",
  });
  return [
    mk("Coordinate & RoE lock (T3MP3ST)", "coordinator"),
    mk("Reconnaissance", "recon"),
    mk("Weaponize / vuln survey", "scanner"),
    mk("Deliver / exploit validation", "exploiter"),
    mk("Install / lateral model", "infiltrator"),
    mk("Actions on objectives / exfil+stego", "exfiltrator"),
    mk("C2 / OPSEC & detection gaps", "ghost"),
    mk("Evidence synthesis & retest queue", "analyst"),
  ];
}

export function tempestArchetypePromptBlock(role: OperatorRole): string {
  const a = TEMPEST_ARCHETYPES.find((x) => x.role === role);
  if (!a) return "";
  return [
    `## T3MP3ST archetype bridge — ${a.name}`,
    a.description,
    `MITRE: ${a.mitreTactics.join(", ")} | Techniques: ${a.techniques.join(", ")}`,
    `Capabilities: ${a.capabilities.join(", ")}`,
    `Prefer tools: ${a.suggestedZerodayTools.join(", ")}`,
  ].join("\n");
}

export function tempestHealth() {
  const present = pliniusLibPresent("t3mp3st");
  const root = pliniusLibRoot("t3mp3st");
  const markers = ["src/operators/index.ts", "src/mission/index.ts", "package.json", "README.md"];
  const files = markers.map((rel) => ({
    rel,
    exists: present && fs.existsSync(path.join(root, rel)),
  }));
  let version: string | null = null;
  try {
    if (present) {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
        version?: string;
        name?: string;
      };
      version = pkg.version || pkg.name || null;
    }
  } catch {
    version = null;
  }
  return {
    library: "t3mp3st" as const,
    present,
    path: root,
    version,
    files,
    archetypes: TEMPEST_ARCHETYPES.length,
    ready: present && files.every((f) => f.exists),
  };
}
