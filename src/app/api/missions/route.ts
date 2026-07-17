import { NextRequest, NextResponse } from "next/server";
import { defaultPhases } from "@/agents/operators";
import { abortMission, approveReceipt, startMissionRun } from "@/agents/orchestrator";
import { dbRepo } from "@/lib/db/repo";
import { seedExamples } from "@/lib/seed";
import { detectLoadoutsFromBrief } from "@/loadouts/registry";
import type { Mission, ScopeTarget } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/missions — list missions */
export async function GET() {
  seedExamples();
  return NextResponse.json({ missions: dbRepo.listMissions() });
}

/** POST /api/missions — create mission from natural language or structured body */
export async function POST(req: NextRequest) {
  seedExamples();
  const body = (await req.json()) as {
    name?: string;
    objective?: string;
    brief?: string;
    loadouts?: string[];
    targets?: ScopeTarget[];
    action?: string;
    missionId?: string;
    toolId?: string;
    authorizedBy?: string;
  };

  // Actions on existing missions
  if (body.action === "authorize" && body.missionId) {
    const m = dbRepo.getMission(body.missionId);
    if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
    m.authorization = {
      id: m.authorization?.id || uid("auth"),
      authorizedBy: body.authorizedBy || m.authorization?.authorizedBy || "Operator",
      authorizedAt: nowIso(),
      scopeSummary: m.authorization?.scopeSummary || m.targets.map((t) => t.hostname || t.cidr || t.url).join(", "),
      rulesOfEngagement:
        m.authorization?.rulesOfEngagement ||
        "Authorized lab/staging only. safe_local default. No secret persistence.",
      writtenApprovalRef: m.authorization?.writtenApprovalRef,
      acknowledged: true,
    };
    m.status = "queued";
    m.updatedAt = nowIso();
    dbRepo.saveMission(m);
    dbRepo.appendEvent({
      missionId: m.id,
      operatorRole: "coordinator",
      type: "info",
      message: `Authorization acknowledged by ${m.authorization.authorizedBy}`,
    });
    return NextResponse.json({ mission: m });
  }

  if (body.action === "start" && body.missionId) {
    const result = startMissionRun(body.missionId);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, mission: dbRepo.getMission(body.missionId) });
  }

  if (body.action === "abort" && body.missionId) {
    abortMission(body.missionId);
    return NextResponse.json({ ok: true, mission: dbRepo.getMission(body.missionId) });
  }

  if (body.action === "approve_receipt" && body.missionId && body.toolId) {
    approveReceipt(body.missionId, body.toolId);
    return NextResponse.json({ ok: true });
  }

  const brief = body.brief || body.objective || body.name || "";
  const loadouts = body.loadouts?.length ? body.loadouts : detectLoadoutsFromBrief(brief);

  const targets = body.targets?.length ? body.targets : inferTargets(brief, loadouts);

  const mission: Mission = {
    id: uid("mis"),
    name: body.name || truncate(brief, 72) || "Untitled Mission",
    objective: body.objective || brief,
    naturalLanguageBrief: brief,
    status: "awaiting_authorization",
    loadouts,
    targets: Array.isArray(targets) ? targets : [],
    authorization: {
      id: uid("auth"),
      authorizedBy: "",
      authorizedAt: nowIso(),
      scopeSummary: (Array.isArray(targets) ? targets : [])
        .map((t) => t.hostname || t.cidr || t.url || "")
        .filter(Boolean)
        .join(", "),
      rulesOfEngagement:
        "Plinian Doctrine: Scope + Authorization + Evidence + Retest. safe_local default. No production without written RoE.",
      acknowledged: false,
    },
    phases: defaultPhases(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    tags: loadouts,
  };

  dbRepo.saveMission(mission);
  return NextResponse.json({ mission }, { status: 201 });
}

function inferTargets(brief: string, loadouts: string[]): ScopeTarget[] {
  const targets: ScopeTarget[] = [];
  if (loadouts.includes("cisco") || /dna/i.test(brief)) {
    targets.push({
      id: uid("tgt"),
      hostname: "dnac.staging.lab",
      product: "Cisco DNA Center",
      vendor: "Cisco",
      environment: "staging",
    });
  }
  if (/ise/i.test(brief)) {
    targets.push({
      id: uid("tgt"),
      hostname: "ise.staging.lab",
      product: "Cisco ISE",
      vendor: "Cisco",
      environment: "staging",
    });
  }
  if (loadouts.includes("splunk") || /splunk/i.test(brief)) {
    targets.push({
      id: uid("tgt"),
      hostname: "splunk.staging.lab",
      product: "Splunk",
      vendor: "Splunk",
      environment: "staging",
    });
  }
  if (loadouts.includes("paloalto")) {
    targets.push({
      id: uid("tgt"),
      hostname: "panorama.staging.lab",
      product: "Panorama",
      vendor: "Palo Alto",
      environment: "staging",
    });
  }
  if (loadouts.includes("fortinet")) {
    targets.push({
      id: uid("tgt"),
      hostname: "fortimanager.staging.lab",
      product: "FortiManager",
      vendor: "Fortinet",
      environment: "staging",
    });
  }
  if (loadouts.includes("crowdstrike")) {
    targets.push({
      id: uid("tgt"),
      hostname: "api.crowdstrike.com",
      product: "Falcon",
      vendor: "CrowdStrike",
      environment: "staging",
      notes: "Cloud API — metadata only; tenant scoped via RoE",
    });
  }
  if (loadouts.includes("aws")) {
    targets.push({
      id: uid("tgt"),
      hostname: "123456789012",
      product: "AWS Account",
      vendor: "AWS",
      environment: "staging",
      notes: "Lab account — Security Hub / GuardDuty / IAM scope",
    });
  }
  if (!targets.length) {
    targets.push({
      id: uid("tgt"),
      hostname: "target.lab",
      environment: "lab",
      notes: "Inferred placeholder — edit scope before authorize",
    });
  }
  return targets;
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
