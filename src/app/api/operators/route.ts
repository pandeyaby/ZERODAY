import { NextRequest, NextResponse } from "next/server";
import { ALL_ROLES, OPERATOR_META } from "@/agents/operators";
import { dbRepo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const missionId = req.nextUrl.searchParams.get("missionId") || undefined;
  return NextResponse.json({
    meta: OPERATOR_META,
    roles: ALL_ROLES,
    operators: dbRepo.listOperators(missionId),
    events: dbRepo.listEvents(missionId, 150),
  });
}
