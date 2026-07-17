/**
 * Emoji steganography via variation selectors (P4RS3LT0NGV3-style).
 * VS1–VS16 encode nibbles into a carrier emoji sequence.
 */

const VS_BASE = 0xfe00; // Variation Selector-1

function byteToSelectors(byte: number): string {
  const hi = (byte >> 4) & 0x0f;
  const lo = byte & 0x0f;
  return String.fromCodePoint(VS_BASE + hi) + String.fromCodePoint(VS_BASE + lo);
}

function selectorsToByte(sel: string): number | null {
  const cps = [...sel].map((c) => c.codePointAt(0) || 0);
  if (cps.length < 2) return null;
  const hi = cps[0] - VS_BASE;
  const lo = cps[1] - VS_BASE;
  if (hi < 0 || hi > 15 || lo < 0 || lo > 15) return null;
  return (hi << 4) | lo;
}

/**
 * Hide a UTF-8 payload inside a carrier emoji using variation selectors.
 */
export function emojiEncode(payload: string, carrier = "🐍"): string {
  const bytes = Buffer.from(payload, "utf8");
  let out = carrier;
  for (const b of bytes) out += byteToSelectors(b);
  return out;
}

/**
 * Extract payload from an emoji+VS stego string.
 */
export function emojiDecode(stego: string): string {
  const chars = [...stego];
  // Skip carrier (first non-VS char cluster) — take everything from first VS
  const vsStart = chars.findIndex((c) => {
    const cp = c.codePointAt(0) || 0;
    return cp >= VS_BASE && cp <= VS_BASE + 15;
  });
  if (vsStart < 0) return "";
  const vs = chars.slice(vsStart);
  const bytes: number[] = [];
  for (let i = 0; i + 1 < vs.length; i += 2) {
    const b = selectorsToByte(vs[i] + vs[i + 1]);
    if (b === null) break;
    bytes.push(b);
  }
  return Buffer.from(bytes).toString("utf8");
}

export const EMOJI_CARRIERS = ["🐍", "🔥", "🚀", "😎", "🎯", "🛡️", "📡", "🔐", "⚡", "🌑"];
