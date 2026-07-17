import { NextResponse } from "next/server";
import { mcpServerInfo, mcpToolCatalog } from "@/lib/mcp/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/mcp — MCP-compatible tool catalog for agent hosts */
export async function GET() {
  return NextResponse.json({
    server: mcpServerInfo(),
    tools: mcpToolCatalog(),
  });
}
