/**
 * Mission orchestrator — runs the operator kill chain with tool calls + evidence.
 */

import { dbRepo } from "@/lib/db/repo";
import { executeTool, listTools } from "@/arsenal/registry";
import { createFinding } from "@/evidence/findings";
import { captureEvidence } from "@/evidence/vault";
import { complete } from "@/lib/llm/provider";
import { LOADOUT_ROLE_TOOLS } from "@/loadouts/registry";
import type { Mission, OperatorRole, OperatorState } from "@/lib/types";
import { nowIso, sleep, uid } from "@/lib/utils";
import { ALL_ROLES, defaultPhases, operatorSystemPrompt } from "@/agents/operators";

const running = new Set<string>();
const receipts = new Map<string, Set<string>>();

export function approveReceipt(missionId: string, toolId: string) {
  if (!receipts.has(missionId)) receipts.set(missionId, new Set());
  receipts.get(missionId)!.add(toolId);
}

export function isMissionRunning(missionId: string): boolean {
  return running.has(missionId);
}

/**
 * Start an async mission run. Safe to call from API routes.
 */
export function startMissionRun(missionId: string): { ok: boolean; error?: string } {
  const mission = dbRepo.getMission(missionId);
  if (!mission) return { ok: false, error: "Mission not found" };
  if (!mission.authorization?.acknowledged) {
    return { ok: false, error: "AUTHORIZATION REQUIRED — acknowledge RoE first" };
  }
  if (running.has(missionId)) return { ok: false, error: "Mission already running" };

  running.add(missionId);
  void runMission(missionId).finally(() => running.delete(missionId));
  return { ok: true };
}

async function runMission(missionId: string) {
  let mission = dbRepo.getMission(missionId);
  if (!mission) return;

  mission.status = "running";
  mission.startedAt = mission.startedAt || nowIso();
  mission.updatedAt = nowIso();
  if (!mission.phases.length) mission.phases = defaultPhases();
  dbRepo.saveMission(mission);

  // Ensure operator rows
  for (const role of ALL_ROLES) {
    const existing = dbRepo.listOperators(missionId).find((o) => o.role === role);
    if (!existing) {
      const op: OperatorState = {
        id: uid("op"),
        missionId,
        role,
        status: "idle",
        toolCalls: 0,
        updatedAt: nowIso(),
      };
      dbRepo.saveOperator(op);
    }
  }

  emit(missionId, "coordinator", "phase", "Mission run started under Plinian Doctrine.");

  for (let i = 0; i < mission.phases.length; i++) {
    mission = dbRepo.getMission(missionId)!;
    if (mission.status === "aborted" || mission.status === "paused") break;

    const phase = mission.phases[i];
    phase.status = "running";
    phase.startedAt = nowIso();
    mission.updatedAt = nowIso();
    dbRepo.saveMission(mission);

    setOperator(missionId, phase.operatorRole, "thinking", `Entering phase: ${phase.name}`);
    emit(missionId, phase.operatorRole, "phase", `Phase started: ${phase.name}`);

    try {
      await runPhase(mission, phase.operatorRole, phase.name);
      mission = dbRepo.getMission(missionId)!;
      mission.phases[i].status = "completed";
      mission.phases[i].completedAt = nowIso();
      mission.phases[i].summary = `${phase.operatorRole} completed ${phase.name}`;
      mission.updatedAt = nowIso();
      dbRepo.saveMission(mission);
      setOperator(missionId, phase.operatorRole, "done", phase.name);
    } catch (err) {
      mission = dbRepo.getMission(missionId)!;
      mission.phases[i].status = "failed";
      mission.phases[i].summary = err instanceof Error ? err.message : String(err);
      dbRepo.saveMission(mission);
      setOperator(missionId, phase.operatorRole, "error", mission.phases[i].summary);
      emit(missionId, phase.operatorRole, "error", mission.phases[i].summary || "phase failed");
    }

    await sleep(400);
  }

  mission = dbRepo.getMission(missionId)!;
  if (mission.status === "running") {
    // Analyst promotion check
    await synthesizeFindings(mission);
    mission = dbRepo.getMission(missionId)!;
    const needsRetest = dbRepo.listFindings(missionId).some((f) => f.status === "needs_retest");
    mission.status = needsRetest ? "awaiting_retest" : "completed";
    mission.completedAt = nowIso();
    mission.updatedAt = nowIso();
    dbRepo.saveMission(mission);
    emit(missionId, "analyst", "info", `Mission ${mission.status}`);
  }
}

async function runPhase(mission: Mission, role: OperatorRole, phaseName: string) {
  const system = operatorSystemPrompt(role, mission.loadouts);
  const plan = await complete([
    { role: "system", content: system },
    {
      role: "user",
      content: `Mission: ${mission.name}\nObjective: ${mission.objective}\nPhase: ${phaseName}\nTargets: ${JSON.stringify(mission.targets)}\nPlan tool calls for this phase.`,
    },
  ]);

  emit(mission.id, role, "thought", plan.content.slice(0, 500));
  setOperator(mission.id, role, "thinking", plan.content.slice(0, 160));

  const tools = pickToolsForRole(role, mission.loadouts);
  const targetHost =
    mission.targets[0]?.hostname ||
    mission.targets[0]?.url ||
    "10.10.20.10";

  for (const toolId of tools) {
    setOperator(mission.id, role, "tool_call", toolId);
    emit(mission.id, role, "tool_call", `Calling ${toolId}`);

    const args = buildArgs(toolId, targetHost, mission);
    const result = await executeTool(
      {
        toolId,
        args,
        missionId: mission.id,
        operatorRole: role,
      },
      {
        mission,
        approvedReceipts: receipts.get(mission.id),
        simulate: true,
      }
    );

    bumpToolCount(mission.id, role);
    emit(mission.id, role, "tool_result", result.summary, {
      ok: result.ok,
      evidenceId: result.evidenceId,
      scopeDenied: result.scopeDenied,
      receiptRequired: result.receiptRequired,
    });

    if (result.receiptRequired) {
      emit(mission.id, role, "info", `Skipped gated tool ${toolId} (receipt required)`);
    }

    await sleep(250);
  }

  captureEvidence({
    missionId: mission.id,
    operatorRole: role,
    kind: "operator_note",
    title: `${role} phase note`,
    summary: `${phaseName} complete`,
    payload: { phaseName, plan: plan.content, tools },
    tags: [role, "phase"],
  });
}

function pickToolsForRole(role: OperatorRole, loadouts: string[]): string[] {
  const available = listTools({ role }).filter((t) => t.mode === "safe_local");
  const preferVendor = available.filter((t) => {
    const prefix = t.id.split(".")[0];
    if (loadouts.includes(prefix)) return true;
    if (t.vendor && loadouts.includes(t.vendor.toLowerCase().replace(/\s+/g, ""))) return true;
    return !t.vendor;
  });
  const pool = (preferVendor.length ? preferVendor : available).slice(0, 3);

  const wants: string[] = ["general.nmap_syn"];
  for (const loadout of loadouts) {
    const roleTools = LOADOUT_ROLE_TOOLS[loadout]?.[role];
    if (roleTools) wants.push(...roleTools);
  }

  // Shared fallbacks when loadouts don't cover a role
  if (role === "exfiltrator") wants.push("stego.mutate", "stego.emoji", "stego.invisible");
  if (role === "analyst") wants.push("stego.decode");
  if (role === "exploiter") wants.push("general.nuclei_template");
  if (role === "coordinator") wants.push("general.nmap_syn");

  const selected = [...new Set(wants)].filter((id) => listTools().some((t) => t.id === id));
  // Prefer loadout-matched tools first
  const loadoutSelected = selected.filter((id) => {
    const prefix = id.split(".")[0];
    return loadouts.includes(prefix) || prefix === "general" || prefix === "stego";
  });
  const merged = [...new Set([...loadoutSelected, ...pool.map((t) => t.id)])].slice(0, 4);
  return merged.length ? merged : pool.map((t) => t.id);
}

function hostFor(
  mission: Mission,
  pattern: RegExp,
  fallback: string
): string {
  return (
    mission.targets.find((t) =>
      pattern.test(`${t.hostname || ""} ${t.product || ""} ${t.vendor || ""} ${t.url || ""}`)
    )?.hostname ||
    mission.targets.find((t) => pattern.test(t.hostname || t.url || ""))?.hostname ||
    fallback
  );
}

function buildArgs(toolId: string, host: string, mission: Mission): Record<string, unknown> {
  const ciscoHost = hostFor(mission, /dna|cisco|ise|meraki/i, host);
  const splunkHost = hostFor(mission, /splunk/i, host);
  const paloHost = hostFor(mission, /palo|panorama|prisma|globalprotect/i, host);
  const fortiHost = hostFor(mission, /forti/i, host);
  const csHost = hostFor(mission, /crowdstrike|falcon/i, "api.crowdstrike.com");
  const awsAccount =
    mission.targets.find((t) => /aws|account/i.test(`${t.hostname || ""} ${t.notes || ""} ${t.product || ""}`))
      ?.hostname ||
    mission.targets.find((t) => /^\d{12}$/.test(t.hostname || ""))?.hostname ||
    "123456789012";

  if (toolId.startsWith("cisco.")) {
    if (toolId === "cisco.ios_config_lint") {
      return {
        hostname: ciscoHost,
        config: `hostname ${ciscoHost}\n!\nservice password-encryption\n!\nusername admin privilege 15 password 0 changeme\n!\nline vty 0 4\n transport input all\n!\n`,
      };
    }
    if (toolId === "cisco.meraki_org_recon") return { host: "api.meraki.com", orgId: "org_lab_001" };
    if (toolId === "cisco.advisory_correlate") return { platform: "cat9k", version: "17.6.5" };
    return { host: ciscoHost };
  }
  if (toolId.startsWith("splunk.")) {
    if (toolId === "splunk.rest_search")
      return { host: splunkHost, query: "| tstats count where index=cisco by sourcetype" };
    if (toolId === "splunk.spl_hygiene")
      return { query: "index=* | rest /services/authentication/users | sendemail" };
    if (toolId === "splunk.input_audit")
      return { stanza: "[udp://514]\nindex = main\ndisabled = false\n" };
    return { host: splunkHost };
  }
  if (toolId.startsWith("paloalto.")) {
    if (toolId === "paloalto.prisma_access_inventory") return { tenant: "prisma_lab_001" };
    return { host: paloHost };
  }
  if (toolId.startsWith("fortinet.")) {
    return { host: fortiHost, vdom: "root", adom: "root" };
  }
  if (toolId.startsWith("crowdstrike.")) {
    if (toolId === "crowdstrike.rtr_session")
      return { deviceId: "dev_lab_001", command: "ps" };
    return { host: csHost, domain: "corp.lab", window: "24h", severity: "HIGH" };
  }
  if (toolId.startsWith("aws.")) {
    if (toolId === "aws.waf_webacl_audit") {
      return {
        region: "us-east-1",
        accountId: awsAccount,
        webAclArn: `arn:aws:wafv2:us-east-1:${awsAccount}:regional/webacl/lab-edge/abc`,
      };
    }
    return { region: "us-east-1", accountId: awsAccount };
  }
  if (toolId.startsWith("stego.")) {
    return {
      text: `exfil-canary:${mission.id.slice(0, 8)}`,
      transformId: "base64",
      prompt: mission.objective,
      carrier: "🐍",
      count: 6,
    };
  }
  if (toolId === "general.semgrep_rules") {
    return { snippet: "permit ip any any\npassword = 'secret123'" };
  }
  return { host };
}

async function synthesizeFindings(mission: Mission) {
  const evidence = dbRepo.listEvidence(mission.id);
  setOperator(mission.id, "analyst", "thinking", "Synthesizing findings");

  // Deterministic findings from evidence patterns
  const ios = evidence.find((e) => e.toolId === "cisco.ios_config_lint");
  if (ios) {
    const findings = (
      ios.payload as { result?: { findings?: Array<{ id: string; severity: string; detail: string }> } }
    )?.result?.findings;
    for (const f of findings || []) {
      if (f.severity === "info") continue;
      createFinding({
        missionId: mission.id,
        title: `IOS: ${f.id}`,
        description: f.detail,
        severity: (f.severity as "low" | "medium" | "high" | "critical") || "medium",
        vendorImpact: ["Cisco IOS-XE"],
        evidenceIds: [ios.id],
        recommendedFix: "Remediate per Cisco secure config baseline; enforce AAA and SSH-only VTY.",
        mitreTactics: ["TA0006"],
      });
    }
  }

  const ise = evidence.find((e) => e.toolId === "cisco.ise_policy_audit");
  if (ise) {
    createFinding({
      missionId: mission.id,
      title: "ISE overly permissive guest authorization",
      description: "Guest identity group mapped to corporate DACL in lab audit.",
      severity: "high",
      vendorImpact: ["Cisco ISE"],
      evidenceIds: [ise.id],
      recommendedFix: "Restrict guest DACL; require profiling confidence; segment guest VLAN.",
      mitreTactics: ["TA0008"],
    });
  }

  const gaps = evidence.find((e) => e.toolId === "splunk.detection_gap_scan");
  if (gaps) {
    createFinding({
      missionId: mission.id,
      title: "Splunk ES detection gaps for SSH lateral movement",
      description: "ATT&CK T1021.004 not covered by enabled correlation searches.",
      severity: "medium",
      vendorImpact: ["Splunk Enterprise Security", "Cisco IOS"],
      evidenceIds: [gaps.id],
      recommendedFix: "Enable/tune ES content for anomalous SSH and IOS config-change without ticket.",
      mitreTactics: ["TA0008", "T1021.004"],
    });
  }

  const ciscoSrc = evidence.find((e) => e.toolId === "splunk.cisco_source_validate");
  if (ciscoSrc) {
    createFinding({
      missionId: mission.id,
      title: "Stale Cisco ISE RADIUS sourcetype in Splunk",
      description: "cisco:ise:radius last seen >3h — integration break or connector failure.",
      severity: "medium",
      vendorImpact: ["Splunk", "Cisco ISE"],
      evidenceIds: [ciscoSrc.id],
      recommendedFix: "Verify forwarder/HEC connector; alert on sourcetype silence SLA.",
      mitreTactics: ["TA0040"],
    });
  }

  const paloRules = evidence.find((e) => e.toolId === "paloalto.security_rule_audit");
  if (paloRules) {
    createFinding({
      missionId: mission.id,
      title: "PAN-OS any/any security rule still enabled",
      description: "temp-any-any-lab allow any/any/any remains after change window.",
      severity: "critical",
      vendorImpact: ["Palo Alto PAN-OS", "Panorama"],
      evidenceIds: [paloRules.id],
      recommendedFix: "Disable/remove temporary any/any; require App-ID + User-ID + threat profiles.",
      mitreTactics: ["TA0011"],
    });
  }

  const gp = evidence.find((e) => e.toolId === "paloalto.globalprotect_posture");
  if (gp) {
    createFinding({
      missionId: mission.id,
      title: "GlobalProtect portal lacks MFA",
      description: "Portal auth uses LDAP only — MFA not enforced.",
      severity: "high",
      vendorImpact: ["Palo Alto GlobalProtect"],
      evidenceIds: [gp.id],
      recommendedFix: "Enforce MFA (SAML/RADIUS) on all GP portals; tighten split-tunnel with HIP.",
      mitreTactics: ["TA0006", "T1133"],
    });
  }

  const fortiPol = evidence.find((e) => e.toolId === "fortinet.firewall_policy_audit");
  if (fortiPol) {
    createFinding({
      missionId: mission.id,
      title: "FortiGate any-any policy with logging disabled",
      description: "Policy allow-all-temp permits all traffic without logs.",
      severity: "critical",
      vendorImpact: ["Fortinet FortiGate"],
      evidenceIds: [fortiPol.id],
      recommendedFix: "Remove temp any-any; enable logging + IPS on WAN-facing policies.",
      mitreTactics: ["TA0011"],
    });
  }

  const sslvpn = evidence.find((e) => e.toolId === "fortinet.ssl_vpn_posture");
  if (sslvpn) {
    createFinding({
      missionId: mission.id,
      title: "FortiGate SSL-VPN realm without MFA",
      description: "full-access realm uses local password without MFA.",
      severity: "high",
      vendorImpact: ["Fortinet FortiGate"],
      evidenceIds: [sslvpn.id],
      recommendedFix: "Require MFA; restrict tunnel destinations; prefer IPsec/ZTNA where possible.",
      mitreTactics: ["T1133"],
    });
  }

  const spotlight = evidence.find((e) => e.toolId === "crowdstrike.spotlight_vuln_scan");
  if (spotlight) {
    createFinding({
      missionId: mission.id,
      title: "Spotlight critical CVE actively exploited",
      description: "CVE-2024-21338 CRITICAL on 2 hosts with active exploitation status.",
      severity: "critical",
      vendorImpact: ["CrowdStrike Spotlight"],
      evidenceIds: [spotlight.id],
      recommendedFix: "Patch urgently; use Falcon grouping to track remediation SLA.",
      mitreTactics: ["TA0001"],
      cveIds: ["CVE-2024-21338"],
    });
  }

  const csId = evidence.find((e) => e.toolId === "crowdstrike.identity_protection_audit");
  if (csId) {
    createFinding({
      missionId: mission.id,
      title: "Kerberoastable service account detected",
      description: "svc-backup has SPN with weak encryption types.",
      severity: "high",
      vendorImpact: ["CrowdStrike Identity Protection", "Active Directory"],
      evidenceIds: [csId.id],
      recommendedFix: "Rotate to AES-only; gMSA where possible; monitor T1558.003 detections.",
      mitreTactics: ["TA0006", "T1558.003"],
    });
  }

  const hub = evidence.find((e) => e.toolId === "aws.security_hub_findings");
  if (hub) {
    createFinding({
      missionId: mission.id,
      title: "AWS root access key present (Security Hub)",
      description: "IAM.1 finding: root access key exists in scoped account.",
      severity: "critical",
      vendorImpact: ["AWS IAM", "Security Hub"],
      evidenceIds: [hub.id],
      recommendedFix: "Delete root access keys; enable MFA on root; use break-glass runbooks.",
      mitreTactics: ["TA0006"],
    });
  }

  const s3 = evidence.find((e) => e.toolId === "aws.s3_public_exposure");
  if (s3) {
    createFinding({
      missionId: mission.id,
      title: "Public S3 bucket without Block Public Access",
      description: "lab-public-assets is publicly readable with BPA disabled.",
      severity: "high",
      vendorImpact: ["AWS S3"],
      evidenceIds: [s3.id],
      recommendedFix: "Enable S3 Block Public Access; tighten bucket policy; scan for sensitive objects.",
      mitreTactics: ["TA0010"],
    });
  }

  const trail = evidence.find((e) => e.toolId === "aws.cloudtrail_hygiene");
  if (trail) {
    createFinding({
      missionId: mission.id,
      title: "Weak CloudTrail configuration on app-legacy",
      description: "Single-region trail without log validation or KMS encryption.",
      severity: "medium",
      vendorImpact: ["AWS CloudTrail"],
      evidenceIds: [trail.id],
      recommendedFix: "Consolidate to org multi-region trail with validation + CMK.",
      mitreTactics: ["TA0005"],
    });
  }

  emit(mission.id, "analyst", "finding", "Findings ledger updated from evidence vault");
  setOperator(mission.id, "analyst", "done", "Synthesis complete");
}

function setOperator(
  missionId: string,
  role: OperatorRole,
  status: OperatorState["status"],
  detail?: string
) {
  const op = dbRepo.listOperators(missionId).find((o) => o.role === role);
  if (!op) return;
  op.status = status;
  op.currentThought = detail;
  op.lastAction = detail;
  op.updatedAt = nowIso();
  if (status === "thinking" || status === "tool_call") op.startedAt = op.startedAt || nowIso();
  dbRepo.saveOperator(op);
}

function bumpToolCount(missionId: string, role: OperatorRole) {
  const op = dbRepo.listOperators(missionId).find((o) => o.role === role);
  if (!op) return;
  op.toolCalls += 1;
  op.updatedAt = nowIso();
  dbRepo.saveOperator(op);
}

function emit(
  missionId: string,
  operatorRole: OperatorRole,
  type: "thought" | "tool_call" | "tool_result" | "finding" | "phase" | "error" | "info",
  message: string,
  meta?: Record<string, unknown>
) {
  dbRepo.appendEvent({ missionId, operatorRole, type, message, meta });
}

export function abortMission(missionId: string) {
  const mission = dbRepo.getMission(missionId);
  if (!mission) return;
  mission.status = "aborted";
  mission.updatedAt = nowIso();
  dbRepo.saveMission(mission);
  running.delete(missionId);
}
