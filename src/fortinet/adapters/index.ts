/**
 * Fortinet adapters — FortiGate / FortiManager / FortiAnalyzer / FortiSIEM (safe_local sim).
 */

import type { Mission, ToolDefinition } from "@/lib/types";
import { uid } from "@/lib/utils";

const runId = () => uid("run");

export const fortinetTools: ToolDefinition[] = [
  {
    id: "fortinet.fortigate_inventory",
    name: "FortiGate Inventory",
    description: "Enumerate FortiGates via FortiManager or direct API (read-only sim).",
    vendor: "fortinet",
    category: "forti-recon",
    mode: "safe_local",
    roles: ["recon", "scanner", "coordinator"],
    parameters: {
      host: { type: "string", description: "FortiManager or FortiGate host", required: true },
    },
  },
  {
    id: "fortinet.firewall_policy_audit",
    name: "Firewall Policy Audit",
    description: "Detect any-any policies, disabled logging, and VIP exposure risks.",
    vendor: "fortinet",
    category: "forti-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst", "infiltrator"],
    parameters: {
      host: { type: "string", description: "FortiGate host", required: true },
      vdom: { type: "string", description: "VDOM", default: "root" },
    },
  },
  {
    id: "fortinet.ssl_vpn_posture",
    name: "SSL-VPN Posture",
    description: "Audit SSL-VPN portal realms, MFA, and split-tunnel settings.",
    vendor: "fortinet",
    category: "forti-scan",
    mode: "safe_local",
    roles: ["scanner", "infiltrator", "ghost"],
    parameters: {
      host: { type: "string", description: "FortiGate host", required: true },
    },
  },
  {
    id: "fortinet.ips_sensor_coverage",
    name: "IPS Sensor Coverage",
    description: "Check IPS sensors attached to policies and signature update freshness.",
    vendor: "fortinet",
    category: "forti-scan",
    mode: "safe_local",
    roles: ["scanner", "ghost", "analyst"],
    parameters: {
      host: { type: "string", description: "FortiGate host", required: true },
    },
  },
  {
    id: "fortinet.fortianalyzer_log_health",
    name: "FortiAnalyzer Log Health",
    description: "Validate ADOM log ingestion latency and missing device sources.",
    vendor: "fortinet",
    category: "forti-detect",
    mode: "safe_local",
    roles: ["recon", "ghost", "analyst"],
    parameters: {
      host: { type: "string", description: "FortiAnalyzer host", required: true },
      adom: { type: "string", description: "ADOM", default: "root" },
    },
  },
  {
    id: "fortinet.fortisiem_rule_gaps",
    name: "FortiSIEM Rule Gaps",
    description: "Map ATT&CK coverage against enabled FortiSIEM rules.",
    vendor: "fortinet",
    category: "forti-detect",
    mode: "safe_local",
    roles: ["ghost", "analyst", "scanner"],
    parameters: {
      host: { type: "string", description: "FortiSIEM host", required: true },
    },
  },
];

export async function runFortinetTool(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { simulate: boolean; mission: Mission }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "fortinet.fortigate_inventory":
      return {
        summary: `FortiGate inventory @ ${args.host}: 3 devices (sim)`,
        data: {
          runId: runId(),
          host: args.host,
          devices: [
            { hostname: "fg-edge-01", model: "FortiGate-200F", version: "7.2.8", vdoms: ["root", "guest"] },
            { hostname: "fg-dc-01", model: "FortiGate-600F", version: "7.4.3", vdoms: ["root"] },
            { hostname: "fg-branch-03", model: "FortiGate-80F", version: "7.2.5", vdoms: ["root"] },
          ],
          simulate: ctx.simulate,
        },
      };
    case "fortinet.firewall_policy_audit":
      return {
        summary: `Policy audit ${args.host}/${args.vdom || "root"}: 3 issues`,
        data: {
          host: args.host,
          vdom: args.vdom || "root",
          issues: [
            {
              policyId: 12,
              name: "allow-all-temp",
              severity: "critical",
              detail: "src all / dst all / service ALL — logging disabled",
            },
            {
              policyId: 44,
              name: "vip-rdp-expose",
              severity: "high",
              detail: "VIP publishes RDP to WAN without geo or IPS",
            },
            {
              policyId: 61,
              name: "vendor-support",
              severity: "medium",
              detail: "Expired schedule still active for vendor /32",
            },
          ],
        },
      };
    case "fortinet.ssl_vpn_posture":
      return {
        summary: `SSL-VPN posture @ ${args.host}`,
        data: {
          host: args.host,
          findings: [
            {
              id: "SSLVPN-NO-MFA",
              severity: "high",
              detail: "Realm full-access uses local password without MFA",
            },
            {
              id: "SSLVPN-TUNNEL-MODE-ANY",
              severity: "medium",
              detail: "Tunnel mode permits all destinations; prefer restricted portal",
            },
          ],
        },
      };
    case "fortinet.ips_sensor_coverage":
      return {
        summary: `IPS coverage @ ${args.host}: 1 sensor stale`,
        data: {
          host: args.host,
          sensors: [
            { name: "default", lastUpdateHours: 4, policiesAttached: 18, status: "ok" },
            { name: "dmz-strict", lastUpdateHours: 240, policiesAttached: 3, status: "stale" },
          ],
          gaps: [{ policy: "wan-to-dmz", severity: "high", detail: "No IPS sensor attached" }],
        },
      };
    case "fortinet.fortianalyzer_log_health":
      return {
        summary: `FAZ log health ADOM=${args.adom || "root"}`,
        data: {
          host: args.host,
          adom: args.adom || "root",
          devices: [
            { hostname: "fg-edge-01", lagSeconds: 12, status: "ok" },
            { hostname: "fg-branch-03", lagSeconds: 5400, status: "delayed" },
            { hostname: "fg-legacy-09", lagSeconds: null, status: "silent", detail: "No logs in 24h" },
          ],
        },
      };
    case "fortinet.fortisiem_rule_gaps":
      return {
        summary: `FortiSIEM gaps @ ${args.host}: 3 techniques uncovered`,
        data: {
          host: args.host,
          gaps: [
            { technique: "T1133", name: "External Remote Services", coverage: "partial" },
            { technique: "T1190", name: "Exploit Public-Facing Application", coverage: "none" },
            { technique: "T1078", name: "Valid Accounts", coverage: "partial" },
          ],
        },
      };
    default:
      throw new Error(`Unhandled fortinet tool ${toolId}`);
  }
}
