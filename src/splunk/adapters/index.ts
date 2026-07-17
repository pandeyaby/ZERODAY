/**
 * Splunk-specific tool adapters.
 */

import type { Mission, ToolDefinition } from "@/lib/types";
import { uid } from "@/lib/utils";

const runId = () => uid("run");

export const splunkTools: ToolDefinition[] = [
  {
    id: "splunk.rest_search",
    name: "Splunk REST Search",
    description: "Execute a constrained SPL search via REST (simulated metadata-safe).",
    vendor: "Splunk",
    category: "splunk-search",
    mode: "safe_local",
    roles: ["recon", "scanner", "analyst", "ghost"],
    parameters: {
      host: { type: "string", description: "Splunk management host", required: true },
      query: { type: "string", description: "SPL query", required: true },
      earliest: { type: "string", description: "Earliest time", default: "-15m" },
    },
  },
  {
    id: "splunk.app_inventory",
    name: "Splunk App Inventory",
    description: "List installed apps and visibility.",
    vendor: "Splunk",
    category: "splunk-recon",
    mode: "safe_local",
    roles: ["recon", "scanner"],
    parameters: {
      host: { type: "string", description: "Splunk host", required: true },
    },
  },
  {
    id: "splunk.input_audit",
    name: "Inputs.conf Audit",
    description: "Audit data inputs for insecure or overly broad stanzas.",
    vendor: "Splunk",
    category: "splunk-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      stanza: { type: "string", description: "inputs.conf snippet", required: true },
    },
  },
  {
    id: "splunk.spl_hygiene",
    name: "SPL Hygiene Check",
    description: "Detect dangerous SPL patterns (rest, sendemail, outputlookup abuse).",
    vendor: "Splunk",
    category: "splunk-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst", "exploiter"],
    parameters: {
      query: { type: "string", description: "SPL to analyze", required: true },
    },
  },
  {
    id: "splunk.cisco_source_validate",
    name: "Cisco→Splunk Source Validate",
    description: "Validate Cisco sourcetypes/indexes and parsing health.",
    vendor: "Splunk",
    category: "splunk-integration",
    mode: "safe_local",
    roles: ["recon", "scanner", "analyst", "ghost"],
    parameters: {
      host: { type: "string", description: "Splunk host", required: true },
      index: { type: "string", description: "Expected index", default: "cisco" },
    },
  },
  {
    id: "splunk.detection_gap_scan",
    name: "Detection Gap Scan",
    description: "Compare ATT&CK coverage vs enabled correlation searches.",
    vendor: "Splunk",
    category: "splunk-detect",
    mode: "safe_local",
    roles: ["ghost", "analyst", "scanner"],
    parameters: {
      host: { type: "string", description: "Splunk ES host", required: true },
      domain: { type: "string", description: "ATT&CK domain", default: "enterprise" },
    },
  },
];

export async function runSplunkTool(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { simulate: boolean; mission: Mission }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "splunk.rest_search": {
      const query = String(args.query || "");
      return {
        summary: `SPL search on ${args.host} (sim, metadata only)`,
        data: {
          runId: runId(),
          host: args.host,
          query,
          earliest: args.earliest || "-15m",
          results: [
            { index: "cisco", sourcetype: "cisco:asa", count: 1240 },
            { index: "cisco", sourcetype: "cisco:ios", count: 880 },
            { index: "network", sourcetype: "dnac:events", count: 42 },
          ],
          note: "Raw events omitted — metadata aggregation only",
          simulate: ctx.simulate,
        },
      };
    }
    case "splunk.app_inventory":
      return {
        summary: `Apps on ${args.host}: 6 installed (sim)`,
        data: {
          apps: [
            { name: "search", visible: true, version: "8.2.9" },
            { name: "Splunk_TA_cisco-asa", visible: false, version: "5.1.0" },
            { name: "SplunkEnterpriseSecuritySuite", visible: true, version: "7.1.1" },
            { name: "TA-cisco_dnac", visible: false, version: "1.0.3" },
            { name: "puppet_forwarder", visible: false, version: "1.2.0" },
            { name: "100-custom-lookups", visible: false, version: "0.0.1" },
          ],
        },
      };
    case "splunk.input_audit": {
      const stanza = String(args.stanza || "");
      const issues = [];
      if (/disabled\s*=\s*false/i.test(stanza) && /sourcetype\s*=\s*$/im.test(stanza)) {
        issues.push({ severity: "medium", detail: "Input enabled without sourcetype" });
      }
      if (/index\s*=\s*main/i.test(stanza)) {
        issues.push({
          severity: "low",
          detail: "Writing to main index — prefer dedicated cisco/network indexes",
        });
      }
      if (/[Pp]assword\s*=\s*\S+/.test(stanza)) {
        issues.push({
          severity: "high",
          detail: "Password present in inputs stanza — move to credential store",
        });
      }
      if (!issues.length) {
        issues.push({ severity: "info", detail: "No major input issues in provided stanza" });
      }
      return { summary: `Input audit: ${issues.length} notes`, data: { issues } };
    }
    case "splunk.spl_hygiene": {
      const query = String(args.query || "");
      const issues = [];
      if (/\|\s*rest\b/i.test(query)) {
        issues.push({ severity: "high", detail: "Uses | rest — privilege escalation risk in shared apps" });
      }
      if (/\|\s*sendemail\b/i.test(query)) {
        issues.push({ severity: "medium", detail: "sendemail present — verify recipients and triggers" });
      }
      if (/index\s*=\s*\*/i.test(query)) {
        issues.push({ severity: "medium", detail: "Unbounded index=* — costly and noisy" });
      }
      if (/\|\s*map\b/i.test(query)) {
        issues.push({ severity: "medium", detail: "map command can amplify search load" });
      }
      return {
        summary: `SPL hygiene: ${issues.length} issues`,
        data: { query, issues },
      };
    }
    case "splunk.cisco_source_validate": {
      return {
        summary: `Cisco source validation on index=${args.index}`,
        data: {
          host: args.host,
          index: args.index || "cisco",
          sourcetypes: [
            { name: "cisco:asa", lastSeenMinutes: 2, parsing: "ok", eps: 40 },
            { name: "cisco:ios", lastSeenMinutes: 5, parsing: "ok", eps: 22 },
            {
              name: "cisco:ise:radius",
              lastSeenMinutes: 180,
              parsing: "stale",
              eps: 0,
              issue: "No events in 3h — check connector",
            },
            {
              name: "dnac:events",
              lastSeenMinutes: 12,
              parsing: "partial",
              eps: 3,
              issue: "Missing CIM fields: dest, user",
            },
          ],
        },
      };
    }
    case "splunk.detection_gap_scan":
      return {
        summary: `Detection gaps on ${args.host}: 3 ATT&CK techniques uncovered`,
        data: {
          domain: args.domain || "enterprise",
          gaps: [
            { technique: "T1021.004", name: "SSH Lateral Movement", coverage: "none" },
            { technique: "T1078.002", name: "Domain Accounts", coverage: "partial" },
            { technique: "T1048.003", name: "Exfil Over Unencrypted Protocol", coverage: "none" },
          ],
          recommendations: [
            "Enable ES content for Cisco ASA VPN anomalous auth",
            "Add correlation search for IOS config-change without change ticket",
          ],
        },
      };
    default:
      throw new Error(`Unhandled splunk tool ${toolId}`);
  }
}
