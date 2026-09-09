import { NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health */
export async function GET() {
  const backend = dbRepo.ready();
  return NextResponse.json({
    ok: true,
    name: "ZERODAY",
    version: "0.5.0",
    product: "agent-operator",
    defaultPath: "keyless-operate",
    persistence: backend,
    stripped: ["offensive-missions", "research-jailbreak-packs", "mutation-lab"],
    time: new Date().toISOString(),
  });
}
