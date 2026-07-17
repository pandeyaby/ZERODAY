import { NextRequest, NextResponse } from "next/server";
import { listLoadouts } from "@/loadouts/registry";
import { smartDecode } from "@/stego/decoder";
import { emojiDecode, emojiEncode, EMOJI_CARRIERS } from "@/stego/emoji";
import { detectInvisible, invisibleDecode, invisibleEncode } from "@/stego/invisible";
import { mutate } from "@/stego/mutation";
import { promptCraftLocal } from "@/stego/tools";
import { generateTokenade, generateTextPayload } from "@/stego/tokenade";
import { tokenize, tokenizerStats } from "@/stego/tokenizer";
import {
  applyTransform,
  listTransforms,
  transformCategories,
} from "@/stego/transforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    transforms: listTransforms().map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      reversible: Boolean(t.decode),
    })),
    categories: transformCategories(),
    carriers: EMOJI_CARRIERS,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");

  try {
    switch (action) {
      case "transform":
        return NextResponse.json({
          output: applyTransform(
            String(body.transformId),
            String(body.text || ""),
            (body.direction as "encode" | "decode") || "encode"
          ),
        });
      case "emoji":
        return NextResponse.json({
          output:
            body.direction === "decode"
              ? emojiDecode(String(body.text || ""))
              : emojiEncode(String(body.text || ""), String(body.carrier || "🐍")),
        });
      case "invisible":
        return NextResponse.json({
          output:
            body.direction === "decode"
              ? invisibleDecode(String(body.text || ""))
              : invisibleEncode(
                  String(body.text || ""),
                  String(body.carrier || "Authorized note")
                ),
          detection: detectInvisible(String(body.text || "")),
        });
      case "mutate":
        return NextResponse.json({
          cases: mutate(String(body.text || ""), Number(body.count) || 8),
        });
      case "decode":
        return NextResponse.json(smartDecode(String(body.text || "")));
      case "tokenade":
        return NextResponse.json(
          generateTokenade({
            weight: (body.weight as "feather" | "light" | "middle") || "feather",
            carrier: String(body.carrier || "🐍"),
          })
        );
      case "text_payload":
        return NextResponse.json({
          output: generateTextPayload(String(body.text || "x"), Number(body.repeats) || 10, true),
        });
      case "tokenize":
        {
          const tokens = tokenize(
            String(body.text || ""),
            (body.engine as "utf8" | "words" | "cl100k_approx" | "char") || "words"
          );
          return NextResponse.json({ tokens, stats: tokenizerStats(tokens) });
        }
      case "promptcraft":
        return NextResponse.json({
          variants: promptCraftLocal(
            String(body.prompt || body.text || ""),
            String(body.strategy || "paraphrase")
          ),
        });
      case "loadouts":
        return NextResponse.json({ loadouts: listLoadouts() });
      default:
        return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
