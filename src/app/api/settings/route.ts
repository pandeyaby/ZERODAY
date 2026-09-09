import { NextRequest, NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    settings: dbRepo.getSettings(),
    envHints: {
      ANTARES_ENDPOINT: process.env.ANTARES_ENDPOINT || null,
      ANTARES_MODEL: process.env.ANTARES_MODEL || null,
    },
    honesty: [
      "Keyless by default — coding agent operator path needs no HF token",
      "Optional local Antares via completions-only endpoint",
      "No vendor API credentials bundled",
      "Fixture playground never downloads weights",
    ],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const settings = dbRepo.updateSettings(body);
  return NextResponse.json({ settings });
}
