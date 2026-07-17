/**
 * Cisco-specific tool adapters (DNA / Meraki / ISE / IOS / Firepower).
 * Default: safe_local simulation with realistic structured evidence.
 */

import type { Mission, ToolDefinition } from "@/lib/types";
import { uid } from "@/lib/utils";

const runId = () => uid("run");

export const ciscoTools: ToolDefinition[] = [
  {
    id: "cisco.dnac_inventory",
    name: "DNA Center Inventory",
    description: "Enumerate network devices via DNA Center intent API (read-only sim).",
    vendor: "Cisco",
    category: "cisco-recon",
    mode: "safe_local",
    roles: ["recon", "scanner", "coordinator"],
    parameters: {
      host: { type: "string", description: "DNA Center hostname", required: true },
      site: { type: "string", description: "Site filter", default: "Global" },
    },
  },
  {
    id: "cisco.meraki_org_recon",
    name: "Meraki Org Recon",
    description: "List networks/devices in a Meraki org (read-only sim).",
    vendor: "Cisco",
    category: "cisco-recon",
    mode: "safe_local",
    roles: ["recon", "scanner"],
    parameters: {
      host: { type: "string", description: "API host", default: "api.meraki.com" },
      orgId: { type: "string", description: "Org ID", required: true },
    },
  },
  {
    id: "cisco.ise_policy_audit",
    name: "ISE Policy Audit",
    description: "Audit authorization policies for overly permissive rules.",
    vendor: "Cisco",
    category: "cisco-scan",
    mode: "safe_local",
    roles: ["scanner", "infiltrator", "analyst"],
    parameters: {
      host: { type: "string", description: "ISE hostname", required: true },
    },
  },
  {
    id: "cisco.ios_config_lint",
    name: "IOS Config Lint",
    description: "Parse IOS/IOS-XE running-config for misconfigurations.",
    vendor: "Cisco",
    category: "cisco-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      config: { type: "string", description: "Running-config text", required: true },
      hostname: { type: "string", description: "Device hostname", default: "ios-device" },
    },
  },
  {
    id: "cisco.advisory_correlate",
    name: "PSIRT Advisory Correlate",
    description: "Correlate device inventory versions to Cisco PSIRT advisories.",
    vendor: "Cisco",
    category: "cisco-intel",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      platform: { type: "string", description: "Platform", required: true },
      version: { type: "string", description: "Software version", required: true },
    },
  },
  {
    id: "cisco.firepower_policy_diff",
    name: "Firepower Policy Diff",
    description: "Diff access-control policy snapshots for shadow/any-any rules.",
    vendor: "Cisco",
    category: "cisco-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      host: { type: "string", description: "FMC hostname", required: true },
    },
  },
  {
    id: "cisco.ios_ssh_exec",
    name: "IOS SSH Exec (Gated)",
    description: "Execute read-only show commands over SSH — receipt required.",
    vendor: "Cisco",
    category: "cisco-exec",
    mode: "receipt_required",
    roles: ["exploiter", "infiltrator", "scanner"],
    spicy: true,
    parameters: {
      host: { type: "string", description: "Device IP/host", required: true },
      command: { type: "string", description: "Show command", default: "show version" },
    },
  },
];

export async function runCiscoTool(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { simulate: boolean; mission: Mission }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "cisco.dnac_inventory": {
      const devices = [
        {
          hostname: "edge-sw-01",
          type: "Cisco Catalyst 9300",
          mgmtIp: "10.10.20.11",
          software: "17.9.4a",
          site: String(args.site || "Global"),
          reachability: "Reachable",
        },
        {
          hostname: "core-sw-02",
          type: "Cisco Catalyst 9500",
          mgmtIp: "10.10.20.2",
          software: "17.6.5",
          site: String(args.site || "Global"),
          reachability: "Reachable",
        },
        {
          hostname: "wlc-01",
          type: "Cisco Catalyst 9800",
          mgmtIp: "10.10.20.40",
          software: "17.9.3",
          site: String(args.site || "Global"),
          reachability: "Reachable",
        },
      ];
      return {
        summary: `DNA inventory @ ${args.host}: ${devices.length} devices (sim)`,
        data: { runId: runId(), host: args.host, devices, simulate: ctx.simulate },
      };
    }
    case "cisco.meraki_org_recon":
      return {
        summary: `Meraki org ${args.orgId}: 2 networks, 5 devices (sim)`,
        data: {
          runId: runId(),
          orgId: args.orgId,
          networks: [
            { id: "N_100", name: "HQ-LAN", productTypes: ["switch", "wireless"] },
            { id: "N_200", name: "Branch-01", productTypes: ["appliance", "switch"] },
          ],
          devices: [
            { name: "HQ-MS225", model: "MS225-24P", networkId: "N_100" },
            { name: "BR-MX68", model: "MX68", networkId: "N_200" },
          ],
        },
      };
    case "cisco.ise_policy_audit": {
      const issues = [
        {
          policy: "AuthZ-Guest-Wide",
          finding: "Guest identity group maps to full corporate DACL",
          severity: "high",
          recommendation: "Restrict guest DACL to internet-only + captive portal",
        },
        {
          policy: "MAB-Printers",
          finding: "MAB bypass without profiling confidence threshold",
          severity: "medium",
          recommendation: "Require profiling ≥ 80% or certificate-based auth",
        },
      ];
      return {
        summary: `ISE audit @ ${args.host}: ${issues.length} policy issues`,
        data: { runId: runId(), host: args.host, issues },
      };
    }
    case "cisco.ios_config_lint": {
      const config = String(args.config || "");
      const findings = [];
      if (!/service\s+password-encryption/i.test(config) && config.length > 0) {
        findings.push({
          id: "IOS-PASS-ENC",
          severity: "medium",
          detail: "service password-encryption not present",
        });
      }
      if (/transport\s+input\s+all/i.test(config) || /transport\s+input\s+telnet/i.test(config)) {
        findings.push({
          id: "IOS-VTY-TELNET",
          severity: "high",
          detail: "VTY allows telnet or all transports",
        });
      }
      if (/username\s+\S+\s+privilege\s+15\s+password\s+0\s+/i.test(config)) {
        findings.push({
          id: "IOS-CLEARTEXT-USER",
          severity: "critical",
          detail: "Privilege 15 user with cleartext password (type 0)",
        });
      }
      if (!/aaa\s+new-model/i.test(config) && config.length > 0) {
        findings.push({
          id: "IOS-NO-AAA",
          severity: "medium",
          detail: "AAA new-model not enabled",
        });
      }
      if (findings.length === 0 && config.length === 0) {
        findings.push({
          id: "IOS-SAMPLE",
          severity: "info",
          detail: "No config provided — loaded baseline checklist only",
        });
      }
      return {
        summary: `IOS lint ${args.hostname || "device"}: ${findings.length} findings`,
        data: { hostname: args.hostname, findings },
      };
    }
    case "cisco.advisory_correlate":
      return {
        summary: `PSIRT correlate ${args.platform} ${args.version}`,
        data: {
          platform: args.platform,
          version: args.version,
          advisories: [
            {
              id: "cisco-sa-demo-2024",
              severity: "high",
              title: "Demo advisory for lab correlation pipeline",
              fixedIn: "17.9.5",
              relevant: String(args.version).startsWith("17.6"),
            },
          ],
        },
      };
    case "cisco.firepower_policy_diff":
      return {
        summary: `FMC policy diff @ ${args.host}: 1 any-any shadow rule`,
        data: {
          host: args.host,
          issues: [
            {
              rule: "allow-any-temp",
              action: "ALLOW",
              src: "any",
              dst: "any",
              severity: "high",
              note: "Temporary rule still present after change window",
            },
          ],
        },
      };
    case "cisco.ios_ssh_exec":
      return {
        summary: `SSH exec (sim) ${args.host}: ${args.command}`,
        data: {
          host: args.host,
          command: args.command,
          output:
            "Cisco IOS XE Software, Version 17.9.4a\nCompiler tools produced simulated show output.",
          simulate: true,
        },
      };
    default:
      throw new Error(`Unhandled cisco tool ${toolId}`);
  }
}
