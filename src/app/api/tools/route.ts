import { NextRequest, NextResponse } from "next/server";
import { executeTool, getTool, listTools } from "@/arsenal/registry";
import { dbRepo } from "@/lib/db/repo";
import type { OperatorRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const vendor = req.nextUrl.searchParams.get("vendor") || undefined;
  const role = (req.nextUrl.searchParams.get("role") as OperatorRole) || undefined;
  return NextResponse.json({ tools: listTools({ vendor, role }) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    toolId: string;
    missionId: string;
    operatorRole?: OperatorRole;
    args?: Record<string, unknown>;
    approveReceipt?: boolean;
  };

  const mission = dbRepo.getMission(body.missionId);
  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

  const tool = getTool(body.toolId);
  if (!tool) return NextResponse.json({ error: "Unknown tool" }, { status: 404 });

  const approved = new Set<string>();
  if (body.approveReceipt) approved.add(body.toolId);

  const result = await executeTool(
    {
      toolId: body.toolId,
      args: body.args || {},
      missionId: body.missionId,
      operatorRole: body.operatorRole || "scanner",
    },
    { mission, approvedReceipts: approved, simulate: true }
  );

  return NextResponse.json({ result });
}
