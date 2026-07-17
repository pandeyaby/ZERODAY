/**
 * General security tool adapters (safe simulation by default).
 */

import type { Mission, ToolDefinition } from "@/lib/types";
import { uid } from "@/lib/utils";

const runId = () => uid("run");

export const generalTools: ToolDefinition[] = [
  {
    id: "general.nmap_syn",
    name: "Nmap SYN Survey",
    description: "Port/service survey (safe_local simulates common Cisco/Splunk ports).",
    category: "recon",
    mode: "safe_local",
    roles: ["recon", "scanner", "coordinator"],
    parameters: {
      host: { type: "string", description: "Target host", required: true },
      ports: { type: "string", description: "Port list", default: "22,443,8089,8000,8443" },
    },
  },
  {
    id: "general.nuclei_template",
    name: "Nuclei Template Scan",
    description: "Template-based vuln checks — simulated catalog for Cisco/Splunk fingerprints.",
    category: "scan",
    mode: "safe_local",
    roles: ["scanner", "exploiter"],
    parameters: {
      host: { type: "string", description: "Target host", required: true },
      tags: { type: "string", description: "Template tags", default: "cisco,splunk,misconfig" },
    },
  },
  {
    id: "general.semgrep_rules",
    name: "Semgrep Ruleset",
    description: "Static analysis against provided config snippets.",
    category: "scan",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      language: { type: "string", description: "Language", default: "yaml" },
      snippet: { type: "string", description: "Code/config snippet", required: true },
    },
  },
  {
    id: "general.trivy_fs",
    name: "Trivy Filesystem Scan",
    description: "Container/FS CVE scan simulation for app packages.",
    category: "scan",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      path: { type: "string", description: "Path", default: "." },
    },
  },
  {
    id: "general.ffuf_dir",
    name: "FFUF Content Discovery",
    description: "Directory discovery — catalog/sim only unless receipt granted.",
    category: "recon",
    mode: "receipt_required",
    roles: ["recon", "infiltrator"],
    spicy: true,
    parameters: {
      url: { type: "string", description: "Base URL", required: true },
      wordlist: { type: "string", description: "Wordlist name", default: "common.txt" },
    },
  },
];

export async function runGeneralTool(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { simulate: boolean; mission: Mission }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const host = String(args.host || args.url || "target");
  switch (toolId) {
    case "general.nmap_syn": {
      const ports = String(args.ports || "22,443,8089").split(",").map((p) => p.trim());
      const open = ports.map((p) => {
        const port = Number(p);
        let service = "unknown";
        if (port === 22) service = "ssh";
        if (port === 443 || port === 8443) service = "https";
        if (port === 8089) service = "splunkd";
        if (port === 8000) service = "splunk-web";
        if (port === 443 && host.includes("dnac")) service = "dnac-ui";
        return { port, state: "open", service, product: guessProduct(host, port) };
      });
      return {
        summary: `SYN survey ${host}: ${open.length} ports profiled (simulate=${ctx.simulate})`,
        data: { runId: runId(), host, open, simulate: ctx.simulate },
      };
    }
    case "general.nuclei_template": {
      const findings = [
        {
          template: "cisco-default-creds-check",
          severity: "info",
          matched: false,
          note: "No default credential banner matched (simulated).",
        },
        {
          template: "splunk-exposed-management",
          severity: "medium",
          matched: host.includes("splunk") || String(args.tags || "").includes("splunk"),
          note: "Management interface fingerprint present — verify auth controls.",
        },
      ];
      return {
        summary: `Nuclei sim on ${host}: ${findings.filter((f) => f.matched).length} soft matches`,
        data: { runId: runId(), host, findings, simulate: true },
      };
    }
    case "general.semgrep_rules": {
      const snippet = String(args.snippet || "");
      const hits = [];
      if (/password\s*=\s*['"][^'"]+['"]/i.test(snippet)) {
        hits.push({ rule: "hardcoded-password", severity: "high", line: 1 });
      }
      if (/permit\s+ip\s+any\s+any/i.test(snippet)) {
        hits.push({ rule: "cisco-overly-permissive-acl", severity: "high", line: 1 });
      }
      if (/disabled|enable\s*=\s*false/i.test(snippet) && /ssl|tls/i.test(snippet)) {
        hits.push({ rule: "tls-disabled", severity: "medium", line: 1 });
      }
      return {
        summary: `Semgrep sim: ${hits.length} rule hits`,
        data: { hits, language: args.language || "yaml" },
      };
    }
    case "general.trivy_fs":
      return {
        summary: "Trivy FS sim: no critical CVEs in scoped package set",
        data: {
          path: args.path || ".",
          vulns: [
            { pkg: "openssl", cve: "CVE-2024-DEMO", severity: "low", fixed: true },
          ],
        },
      };
    case "general.ffuf_dir":
      return {
        summary: `FFUF sim against ${host}: 3 paths of interest`,
        data: {
          url: args.url,
          hits: [
            { path: "/api/v1", status: 401 },
            { path: "/en-US/account/login", status: 200 },
            { path: "/__raw", status: 403 },
          ],
        },
      };
    default:
      throw new Error(`Unhandled general tool ${toolId}`);
  }
}

function guessProduct(host: string, port: number): string {
  const h = host.toLowerCase();
  if (h.includes("dnac") || h.includes("dna")) return "Cisco DNA Center";
  if (h.includes("ise")) return "Cisco ISE";
  if (h.includes("meraki")) return "Meraki Dashboard";
  if (h.includes("splunk") || port === 8089 || port === 8000) return "Splunk";
  if (port === 22) return "SSH/IOS";
  return "generic";
}
