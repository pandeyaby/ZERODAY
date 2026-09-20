/**
 * GET/POST /api/stranger-verify — Desk Prove doors in-process runner.
 *
 * POST body optional `{ "liveUrl": "https://…/v1" }`.
 * Returns prove-doors JSON (schemaVersion + doorA/doorB/nonClaims).
 * With liveUrl: GET /v1/models only · provisioned:false · never RunPod create.
 * Without: Door B citation-only.
 */

import { NextResponse } from "next/server";
import {
  runStrangerVerify,
  strangerVerifyCatalog,
  StrangerVerifyError,
} from "@/desk/stranger-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(strangerVerifyCatalog());
}

export async function POST(req: Request) {
  let body: { liveUrl?: unknown } = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as { liveUrl?: unknown };
    } catch {
      return NextResponse.json(
        { error: 'Expected JSON body (optional { "liveUrl": "https://…/v1" })' },
        { status: 400 },
      );
    }
  }

  // Refuse secret / provision side-channels from the client
  const banned = [
    "token",
    "apiKey",
    "api_key",
    "secret",
    "password",
    "authorization",
    "hfToken",
    "runpodApiKey",
    "RUNPOD_API_KEY",
    "HF_TOKEN",
  ];
  for (const key of Object.keys(body as object)) {
    if (banned.includes(key)) {
      return NextResponse.json(
        {
          error: `Refusing secret/provision field "${key}" — liveUrl probe is GET /v1/models only`,
          code: "SECRET_FIELD_REFUSED",
        },
        { status: 403 },
      );
    }
  }

  let liveUrl: string | undefined;
  if (body.liveUrl !== undefined && body.liveUrl !== null) {
    if (typeof body.liveUrl !== "string") {
      return NextResponse.json(
        { error: "liveUrl must be a string URL", code: "LIVE_URL_TYPE" },
        { status: 400 },
      );
    }
    liveUrl = body.liveUrl.trim() || undefined;
  }

  try {
    const result = await runStrangerVerify({ liveUrl });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isSv = err instanceof StrangerVerifyError;
    return NextResponse.json(
      {
        error: err.message,
        code: isSv ? (err as StrangerVerifyError).code : undefined,
      },
      { status: isSv ? 400 : 500 },
    );
  }
}
