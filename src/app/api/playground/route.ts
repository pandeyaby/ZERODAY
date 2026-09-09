/**
 * POST /api/playground — fixture-only locate / classify / demo for the local UI.
 * No live network. No weight download. No exploits.
 */

import { NextResponse } from "next/server";
import {
  PLAYGROUND_ACTIONS,
  playgroundCatalog,
  runPlaygroundLocate,
  runPlaygroundClassify,
  runPlaygroundDemo,
  type PlaygroundAction,
} from "@/playground/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(playgroundCatalog());
}

export async function POST(req: Request) {
  let body: { action?: string; scenario?: string } = {};
  try {
    body = (await req.json()) as { action?: string; scenario?: string };
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with { action }" },
      { status: 400 },
    );
  }

  const action = body.action as PlaygroundAction | undefined;
  if (!action || !PLAYGROUND_ACTIONS.includes(action)) {
    return NextResponse.json(
      {
        error: `action must be one of: ${PLAYGROUND_ACTIONS.join("|")}`,
      },
      { status: 400 },
    );
  }

  try {
    if (action === "catalog") {
      return NextResponse.json(playgroundCatalog());
    }
    if (action === "locate") {
      const result = await runPlaygroundLocate();
      return NextResponse.json(result);
    }
    if (action === "classify") {
      const scenario = body.scenario || "software_defect";
      const result = await runPlaygroundClassify({ scenario });
      return NextResponse.json(result);
    }
    if (action === "demo") {
      const result = await runPlaygroundDemo();
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
