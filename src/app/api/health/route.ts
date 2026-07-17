import { NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";
import { seedExamples } from "@/lib/seed";
import { listPliniusStatus } from "@/plinius/registry";
import { researchGateSummary } from "@/plinius/gates";
import { tempestHealth } from "@/plinius/t3mp3st/adapter";
import { st3ggStatus } from "@/plinius/st3gg/adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health */
export async function GET() {
  seedExamples();
  const backend = dbRepo.ready();
  const settings = dbRepo.getSettings();
  const libraries = listPliniusStatus();
  return NextResponse.json({
    ok: true,
    name: "ZERODAY",
    version: "0.1.0",
    doctrine: "plinian-1.0.0",
    persistence: backend,
    plinius: {
      installed: libraries.filter((l) => l.present).length,
      total: libraries.length,
      research: researchGateSummary(settings),
      t3mp3stReady: tempestHealth().ready,
      st3gg: await st3ggStatus(),
    },
    time: new Date().toISOString(),
  });
}
