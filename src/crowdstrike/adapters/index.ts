/**
 * CrowdStrike Falcon adapters — hosts, detections, Spotlight, IOA, identity (safe_local sim).
 */

import type { Mission, ToolDefinition } from "@/lib/types";
import { uid } from "@/lib/utils";

const runId = () => uid("run");

export const crowdstrikeTools: ToolDefinition[] = [
  {
    id: "crowdstrike.falcon_host_inventory",
    name: "Falcon Host Inventory",
    description: "List Falcon-managed hosts, sensor versions, and last-seen health.",
    vendor: "crowdstrike",
    category: "cs-recon",
    mode: "safe_local",
    roles: ["recon", "scanner", "coordinator"],
    parameters: {
      host: { type: "string", description: "API / cloud region host hint", default: "api.crowdstrike.com" },
      filter: { type: "string", description: "FQL filter", default: "product_type_desc:'Server'" },
    },
  },
  {
    id: "crowdstrike.detection_triage",
    name: "Detection Triage Snapshot",
    description: "Summarize open detections by severity and tactic (metadata only).",
    vendor: "crowdstrike",
    category: "cs-detect",
    mode: "safe_local",
    roles: ["scanner", "analyst", "ghost"],
    parameters: {
      host: { type: "string", description: "API host hint", default: "api.crowdstrike.com" },
      window: { type: "string", description: "Lookback", default: "24h" },
    },
  },
  {
    id: "crowdstrike.spotlight_vuln_scan",
    name: "Spotlight Vulnerability Scan",
    description: "Aggregate Spotlight CVEs for scoped hosts (no raw credential dump).",
    vendor: "crowdstrike",
    category: "cs-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      host: { type: "string", description: "API host hint", default: "api.crowdstrike.com" },
      severity: { type: "string", description: "Min severity", default: "HIGH" },
    },
  },
  {
    id: "crowdstrike.ioa_coverage",
    name: "IOA / Prevention Policy Coverage",
    description: "Check prevention policy groups for missing IOA categories.",
    vendor: "crowdstrike",
    category: "cs-scan",
    mode: "safe_local",
    roles: ["ghost", "scanner", "analyst"],
    parameters: {
      host: { type: "string", description: "API host hint", default: "api.crowdstrike.com" },
    },
  },
  {
    id: "crowdstrike.identity_protection_audit",
    name: "Identity Protection Audit",
    description: "Falcon Identity / AD assessment for risky entities and Kerberos issues.",
    vendor: "crowdstrike",
    category: "cs-identity",
    mode: "safe_local",
    roles: ["infiltrator", "scanner", "analyst"],
    parameters: {
      host: { type: "string", description: "API host hint", default: "api.crowdstrike.com" },
      domain: { type: "string", description: "AD domain", default: "corp.lab" },
    },
  },
  {
    id: "crowdstrike.rtr_session",
    name: "Real Time Response Session (Gated)",
    description: "Interactive RTR — receipt_required; lab containment only.",
    vendor: "crowdstrike",
    category: "cs-exec",
    mode: "receipt_required",
    roles: ["exploiter", "infiltrator", "ghost"],
    spicy: true,
    parameters: {
      deviceId: { type: "string", description: "Falcon device id", required: true },
      command: { type: "string", description: "RTR command", default: "ps" },
    },
  },
];

export async function runCrowdStrikeTool(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { simulate: boolean; mission: Mission }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "crowdstrike.falcon_host_inventory":
      return {
        summary: `Falcon hosts (${args.filter || "default"}): 5 agents (sim)`,
        data: {
          runId: runId(),
          host: args.host,
          agents: [
            { hostname: "dc01.corp.lab", os: "Windows Server 2022", sensor: "7.18.19106", lastSeenMinutes: 3, status: "normal" },
            { hostname: "web-prod-03", os: "RHEL 9", sensor: "7.16.18001", lastSeenMinutes: 8, status: "normal" },
            { hostname: "laptop-jdoe", os: "Windows 11", sensor: "7.18.19106", lastSeenMinutes: 120, status: "stale" },
            { hostname: "build-ci-02", os: "Ubuntu 22.04", sensor: "7.14.17000", lastSeenMinutes: 1, status: "reduced_functionality" },
            { hostname: "legacy-sql", os: "Windows Server 2016", sensor: "6.50.16006", lastSeenMinutes: 15, status: "eol_sensor" },
          ],
          simulate: ctx.simulate,
        },
      };
    case "crowdstrike.detection_triage":
      return {
        summary: `Detections window=${args.window || "24h"}: 4 open`,
        data: {
          window: args.window || "24h",
          open: [
            { id: "ldt:aa11", severity: "high", tactic: "Credential Access", technique: "T1003", host: "dc01.corp.lab" },
            { id: "ldt:bb22", severity: "medium", tactic: "Execution", technique: "T1059.001", host: "laptop-jdoe" },
            { id: "ldt:cc33", severity: "critical", tactic: "Impact", technique: "T1486", host: "web-prod-03" },
            { id: "ldt:dd44", severity: "low", tactic: "Discovery", technique: "T1082", host: "build-ci-02" },
          ],
          note: "Metadata only — raw process dumps omitted",
        },
      };
    case "crowdstrike.spotlight_vuln_scan":
      return {
        summary: `Spotlight ≥${args.severity || "HIGH"}: 3 CVE groups`,
        data: {
          minSeverity: args.severity || "HIGH",
          vulns: [
            { cve: "CVE-2024-21338", severity: "CRITICAL", hosts: 2, exploitStatus: "actively_exploited" },
            { cve: "CVE-2023-36884", severity: "HIGH", hosts: 5, exploitStatus: "available" },
            { cve: "CVE-2024-38063", severity: "HIGH", hosts: 1, exploitStatus: "none" },
          ],
        },
      };
    case "crowdstrike.ioa_coverage":
      return {
        summary: "IOA / prevention policy gaps: 2",
        data: {
          policies: [
            { name: "Windows-Server-Strict", coverage: 0.92, missing: [] },
            { name: "Developer-Laptops", coverage: 0.61, missing: ["credential_dumping", "script_based_execution"] },
            { name: "Linux-Build", coverage: 0.7, missing: ["container_escape"] },
          ],
        },
      };
    case "crowdstrike.identity_protection_audit":
      return {
        summary: `Identity audit domain=${args.domain || "corp.lab"}`,
        data: {
          domain: args.domain || "corp.lab",
          findings: [
            {
              id: "CS-ID-KERBEROASTABLE",
              severity: "high",
              detail: "Service account svc-backup has SPN + weak encryption types",
            },
            {
              id: "CS-ID-DORMANT-ADMIN",
              severity: "medium",
              detail: "Domain admin account unused 90d still privileged",
            },
          ],
        },
      };
    case "crowdstrike.rtr_session":
      return {
        summary: `RTR sim device=${args.deviceId} cmd=${args.command}`,
        data: {
          deviceId: args.deviceId,
          command: args.command,
          output: "simulated process list (redacted)",
          simulate: true,
        },
      };
    default:
      throw new Error(`Unhandled crowdstrike tool ${toolId}`);
  }
}
