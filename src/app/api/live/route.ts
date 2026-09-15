/**
 * GET/POST /api/live — Desk Console Live brain wizard (UI-3).
 * Save/load sandboxed .zeroday/desk-endpoint.json, doctor ping, opt-in live locate.
 * Never returns or persists secret token values. Spend requires spendAcknowledged.
 */

import { NextResponse } from "next/server";
import {
  LIVE_ACTIONS,
  liveCatalog,
  runLiveAction,
  type LiveAction,
  type LiveRunRequest,
  LiveEndpointError,
  PathPolicyError,
} from "@/desk/live-endpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(liveCatalog());
}

export async function POST(req: Request) {
  let body: LiveRunRequest = { action: "catalog" };
  try {
    body = (await req.json()) as LiveRunRequest;
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with { action }" },
      { status: 400 },
    );
  }

  const action = body.action as LiveAction | undefined;
  if (!action || !LIVE_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${LIVE_ACTIONS.join("|")}` },
      { status: 400 },
    );
  }

  // Hard lock: locate without spend ACK
  if (action === "locate" && body.spendAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "Live locate requires spendAcknowledged: true (Desk spend banner confirm).",
        code: "SPEND_ACK_REQUIRED",
      },
      { status: 403 },
    );
  }

  // Never accept raw token/secret fields from the client
  const banned = ["token", "apiKey", "api_key", "secret", "password", "authorization", "hfToken"];
  for (const key of Object.keys(body as object)) {
    if (banned.includes(key)) {
      return NextResponse.json(
        {
          error: `Refusing secret field "${key}" — use tokenEnvVar (env name only)`,
          code: "SECRET_FIELD_REFUSED",
        },
        { status: 403 },
      );
    }
  }

  try {
    const result = await runLiveAction({ ...body, action });
    // Strip any accidental secret values from JSON response
    const json = JSON.stringify(result);
    const envName =
      "config" in result && result.config && "tokenEnvVar" in result.config
        ? result.config.tokenEnvVar
        : undefined;
    if (envName && process.env[envName]) {
      const secret = process.env[envName]!;
      if (secret.length >= 8 && json.includes(secret)) {
        return NextResponse.json(
          {
            error: "Refused to return response containing env secret value",
            code: "TOKEN_LEAK_REFUSED",
          },
          { status: 500 },
        );
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isPolicy = err instanceof PathPolicyError;
    const isLive = err instanceof LiveEndpointError;
    const status = isPolicy || isLive ? 403 : 500;
    return NextResponse.json(
      {
        error: err.message,
        code: isPolicy
          ? "PATH_POLICY"
          : isLive
            ? (err as LiveEndpointError).code
            : undefined,
      },
      { status },
    );
  }
}
