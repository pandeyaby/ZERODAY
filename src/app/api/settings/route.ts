import { NextRequest, NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";
import type { AppSettings } from "@/lib/types";

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

/** Only these user-editable fields are stored; anything else in the body is ignored. */
function settingsPatch(body: unknown): Partial<AppSettings> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const patch: Partial<AppSettings> = {};
  if (b.llmProvider === "keyless" || b.llmProvider === "local-antares") patch.llmProvider = b.llmProvider;
  if (typeof b.llmBaseUrl === "string" && b.llmBaseUrl.length <= 512) patch.llmBaseUrl = b.llmBaseUrl;
  if (typeof b.llmModel === "string" && b.llmModel.length <= 200) patch.llmModel = b.llmModel;
  if (typeof b.redactSecrets === "boolean") patch.redactSecrets = b.redactSecrets;
  if (typeof b.pollingIntervalMs === "number" && Number.isFinite(b.pollingIntervalMs)) {
    patch.pollingIntervalMs = Math.min(60_000, Math.max(500, Math.round(b.pollingIntervalMs)));
  }
  return patch;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  const settings = dbRepo.updateSettings(settingsPatch(body));
  return NextResponse.json({ settings });
}
