import { NextRequest, NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";
import { listLoadouts } from "@/loadouts/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    settings: dbRepo.getSettings(),
    loadouts: listLoadouts(),
    envHints: {
      OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      OLLAMA_HOST: process.env.OLLAMA_HOST || null,
      ZERODAY_LLM_BASE_URL: process.env.ZERODAY_LLM_BASE_URL || null,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const settings = dbRepo.updateSettings(body);
  return NextResponse.json({ settings });
}
