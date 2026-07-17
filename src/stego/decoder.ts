/**
 * Universal decoder with smart detection heuristics.
 */

import { TRANSFORMS } from "@/stego/transforms";
import { emojiDecode } from "@/stego/emoji";
import { detectInvisible, invisibleDecode } from "@/stego/invisible";

export interface DecodeAttempt {
  method: string;
  text: string;
  confidence: number;
}

export function smartDecode(input: string): { primary: DecodeAttempt; alternatives: DecodeAttempt[] } {
  const attempts: DecodeAttempt[] = [];

  // Invisible
  const inv = detectInvisible(input);
  if (inv.hasZeroWidth) {
    try {
      const text = invisibleDecode(input);
      if (text) attempts.push({ method: "invisible/zw", text, confidence: 0.85 });
    } catch {
      /* ignore */
    }
  }

  // Emoji VS
  if (inv.counts.vs > 0) {
    try {
      const text = emojiDecode(input);
      if (text) attempts.push({ method: "emoji_variation_selectors", text, confidence: 0.9 });
    } catch {
      /* ignore */
    }
  }

  // Base64
  if (/^[A-Za-z0-9+/=\s]+$/.test(input.trim()) && input.trim().length % 4 === 0 && input.length > 4) {
    try {
      const text = Buffer.from(input.trim(), "base64").toString("utf8");
      if (isMostlyPrintable(text)) attempts.push({ method: "base64", text, confidence: 0.75 });
    } catch {
      /* ignore */
    }
  }

  // Hex
  if (/^[0-9a-fA-F\s]+$/.test(input.trim()) && input.replace(/\s/g, "").length % 2 === 0) {
    try {
      const text = Buffer.from(input.replace(/\s/g, ""), "hex").toString("utf8");
      if (isMostlyPrintable(text)) attempts.push({ method: "hex", text, confidence: 0.7 });
    } catch {
      /* ignore */
    }
  }

  // URL
  if (/%[0-9a-fA-F]{2}/.test(input)) {
    try {
      const text = decodeURIComponent(input);
      if (text !== input) attempts.push({ method: "url", text, confidence: 0.8 });
    } catch {
      /* ignore */
    }
  }

  // ROT13 always try as low confidence
  try {
    const rot = TRANSFORMS.find((t) => t.id === "rot13")!.encode(input);
    attempts.push({ method: "rot13", text: rot, confidence: 0.3 });
  } catch {
    /* ignore */
  }

  // Reverse
  attempts.push({
    method: "reverse",
    text: [...input].reverse().join(""),
    confidence: 0.2,
  });

  attempts.sort((a, b) => b.confidence - a.confidence);
  const primary = attempts[0] || { method: "identity", text: input, confidence: 1 };
  return { primary, alternatives: attempts.slice(1, 6) };
}

function isMostlyPrintable(s: string): boolean {
  if (!s.length) return false;
  let ok = 0;
  for (const c of s) {
    const code = c.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127) || code > 127) ok++;
  }
  return ok / s.length > 0.85;
}
