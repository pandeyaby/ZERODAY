import { NextRequest, NextResponse } from "next/server";
import { completeRetest, queueRetest } from "@/evidence/findings";
import { dbRepo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const missionId = req.nextUrl.searchParams.get("missionId") || undefined;
  return NextResponse.json({ retests: dbRepo.listRetests(missionId) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action?: "queue" | "complete";
    findingId?: string;
    missionId?: string;
    reason?: string;
    retestId?: string;
    outcome?: "passed" | "failed";
    notes?: string;
  };

  if (body.action === "queue" && body.findingId && body.missionId) {
    const item = queueRetest(body.findingId, body.missionId, body.reason || "Manual retest");
    return NextResponse.json({ retest: item });
  }

  if (body.action === "complete" && body.retestId && body.outcome) {
    const result = completeRetest(body.retestId, body.outcome, body.notes || "");
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
