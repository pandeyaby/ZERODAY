/**
 * Palo Alto Networks adapters — Panorama / PAN-OS / Prisma / Cortex (safe_local sim).
 */

import type { Mission, ToolDefinition } from "@/lib/types";
import { uid } from "@/lib/utils";

const runId = () => uid("run");

export const paloaltoTools: ToolDefinition[] = [
  {
    id: "paloalto.panorama_device_inventory",
    name: "Panorama Device Inventory",
    description: "Enumerate managed firewalls and HA pairs via Panorama (read-only sim).",
    vendor: "paloalto",
    category: "palo-recon",
    mode: "safe_local",
    roles: ["recon", "scanner", "coordinator"],
    parameters: {
      host: { type: "string", description: "Panorama hostname", required: true },
      dg: { type: "string", description: "Device group filter", default: "all" },
    },
  },
  {
    id: "paloalto.security_rule_audit",
    name: "Security Rulebase Audit",
    description: "Find overly permissive, shadowed, or unused security rules.",
    vendor: "paloalto",
    category: "palo-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst", "infiltrator"],
    parameters: {
      host: { type: "string", description: "Panorama or NGFW host", required: true },
      rulebase: { type: "string", description: "pre|post|local", default: "pre" },
    },
  },
  {
    id: "paloalto.threat_profile_check",
    name: "Threat Profile Coverage",
    description: "Validate antivirus/anti-spyware/vulnerability/URL profiles on allow rules.",
    vendor: "paloalto",
    category: "palo-scan",
    mode: "safe_local",
    roles: ["scanner", "ghost", "analyst"],
    parameters: {
      host: { type: "string", description: "Target host", required: true },
    },
  },
  {
    id: "paloalto.globalprotect_posture",
    name: "GlobalProtect Posture Audit",
    description: "Check GP portal/gateway auth, HIP, and split-tunnel posture.",
    vendor: "paloalto",
    category: "palo-scan",
    mode: "safe_local",
    roles: ["scanner", "infiltrator", "analyst"],
    parameters: {
      host: { type: "string", description: "Portal hostname", required: true },
    },
  },
  {
    id: "paloalto.prisma_access_inventory",
    name: "Prisma Access Inventory",
    description: "List Prisma Access locations, remote networks, and service connections.",
    vendor: "paloalto",
    category: "palo-recon",
    mode: "safe_local",
    roles: ["recon", "scanner"],
    parameters: {
      tenant: { type: "string", description: "Prisma tenant id", required: true },
    },
  },
  {
    id: "paloalto.cortex_xsoar_playbook_hygiene",
    name: "Cortex XSOAR Playbook Hygiene",
    description: "Flag playbooks with unsafe scripts, hard-coded secrets, or missing approvals.",
    vendor: "paloalto",
    category: "palo-soar",
    mode: "safe_local",
    roles: ["scanner", "analyst", "ghost"],
    parameters: {
      host: { type: "string", description: "XSOAR host", required: true },
    },
  },
  {
    id: "paloalto.config_push",
    name: "PAN-OS Config Push (Gated)",
    description: "Commit/push candidate config — receipt required; never auto-run.",
    vendor: "paloalto",
    category: "palo-exec",
    mode: "receipt_required",
    roles: ["exploiter", "infiltrator"],
    spicy: true,
    parameters: {
      host: { type: "string", description: "Device host", required: true },
      description: { type: "string", description: "Commit description", default: "authorized lab" },
    },
  },
];

export async function runPaloAltoTool(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { simulate: boolean; mission: Mission }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "paloalto.panorama_device_inventory":
      return {
        summary: `Panorama inventory @ ${args.host}: 4 firewalls (sim)`,
        data: {
          runId: runId(),
          host: args.host,
          deviceGroup: args.dg || "all",
          devices: [
            { hostname: "fw-edge-01", model: "PA-3220", version: "11.1.2", ha: "active", serial: "0123456789" },
            { hostname: "fw-edge-02", model: "PA-3220", version: "11.1.2", ha: "passive", serial: "0123456790" },
            { hostname: "fw-dc-01", model: "PA-5220", version: "10.2.9", ha: "active", serial: "0123456791" },
            { hostname: "fw-branch-14", model: "PA-440", version: "11.0.4", ha: "standalone", serial: "0123456792" },
          ],
          simulate: ctx.simulate,
        },
      };
    case "paloalto.security_rule_audit":
      return {
        summary: `Rulebase audit @ ${args.host}: 3 high-risk rules`,
        data: {
          runId: runId(),
          host: args.host,
          rulebase: args.rulebase || "pre",
          issues: [
            {
              rule: "temp-any-any-lab",
              severity: "critical",
              detail: "Allow any/any/any application any — still enabled after change window",
            },
            {
              rule: "vendor-access",
              severity: "high",
              detail: "Source any → DMZ servers without App-ID or User-ID",
            },
            {
              rule: "shadowed-web-out",
              severity: "medium",
              detail: "Rule shadowed by broader allow above it",
            },
          ],
        },
      };
    case "paloalto.threat_profile_check":
      return {
        summary: `Threat profile check @ ${args.host}: 2 gaps`,
        data: {
          host: args.host,
          gaps: [
            {
              rule: "outbound-web",
              missing: ["vulnerability", "file-blocking"],
              severity: "high",
            },
            {
              rule: "server-to-server",
              missing: ["anti-spyware"],
              severity: "medium",
            },
          ],
          recommendation: "Attach best-practice security profiles to all allow rules",
        },
      };
    case "paloalto.globalprotect_posture":
      return {
        summary: `GlobalProtect posture @ ${args.host}`,
        data: {
          host: args.host,
          findings: [
            {
              id: "GP-NO-MFA",
              severity: "high",
              detail: "Portal auth uses LDAP only — MFA not enforced",
            },
            {
              id: "GP-SPLIT-TUNNEL-BROAD",
              severity: "medium",
              detail: "Split tunnel excludes large RFC1918 ranges without HIP check",
            },
          ],
        },
      };
    case "paloalto.prisma_access_inventory":
      return {
        summary: `Prisma Access tenant ${args.tenant}: 3 locations`,
        data: {
          tenant: args.tenant,
          locations: [
            { name: "us-east-1", status: "up", users: 420 },
            { name: "eu-west-1", status: "up", users: 180 },
            { name: "ap-southeast-1", status: "degraded", users: 55 },
          ],
          remoteNetworks: [{ name: "branch-14", bandwidth: "100Mbps", status: "connected" }],
        },
      };
    case "paloalto.cortex_xsoar_playbook_hygiene":
      return {
        summary: `XSOAR hygiene @ ${args.host}: 2 playbook issues`,
        data: {
          host: args.host,
          issues: [
            {
              playbook: "Auto-Isolate-Endpoint",
              severity: "high",
              detail: "No human approval gate before containment action",
            },
            {
              playbook: "Enrich-IP",
              severity: "medium",
              detail: "API key embedded in script task — move to credential store",
            },
          ],
        },
      };
    case "paloalto.config_push":
      return {
        summary: `Config push sim @ ${args.host}`,
        data: {
          host: args.host,
          description: args.description,
          result: "simulated-commit-ok",
          simulate: true,
        },
      };
    default:
      throw new Error(`Unhandled paloalto tool ${toolId}`);
  }
}
