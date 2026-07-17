import { NextRequest, NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const missionId = req.nextUrl.searchParams.get("missionId") || undefined;
  return NextResponse.json({ evidence: dbRepo.listEvidence(missionId) });
}
