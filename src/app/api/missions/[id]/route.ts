import { NextRequest, NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/missions/[id] */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const mission = dbRepo.getMission(id);
  if (!mission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    mission,
    operators: dbRepo.listOperators(id),
    events: dbRepo.listEvents(id, 100),
    evidence: dbRepo.listEvidence(id),
    findings: dbRepo.listFindings(id),
    retests: dbRepo.listRetests(id),
  });
}

/** DELETE /api/missions/[id] */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = dbRepo.deleteMission(id);
  return NextResponse.json({ ok });
}
