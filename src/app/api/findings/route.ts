import { NextRequest, NextResponse } from "next/server";
import { dismissFinding } from "@/evidence/findings";
import { dbRepo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const missionId = req.nextUrl.searchParams.get("missionId") || undefined;
  return NextResponse.json({ findings: dbRepo.listFindings(missionId) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action?: string;
    findingId?: string;
    reason?: string;
  };
  if (body.action === "dismiss" && body.findingId) {
    const finding = dismissFinding(body.findingId, body.reason || "Dismissed");
    return NextResponse.json({ finding });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
