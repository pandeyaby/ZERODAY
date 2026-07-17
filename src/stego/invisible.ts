/**
 * Invisible / zero-width / whitespace steganography.
 */

const ZW = {
  space: "\u200B", // zero-width space = 0
  joiner: "\u200D", // zero-width joiner = 1
  nonJoiner: "\u200C",
  wordJoiner: "\u2060",
  bom: "\uFEFF",
};

/**
 * Encode payload as zero-width bits appended after a visible carrier.
 */
export function invisibleEncode(payload: string, carrier = "Authorized note"): string {
  const bits = [...Buffer.from(payload, "utf8")]
    .map((b) => b.toString(2).padStart(8, "0"))
    .join("");
  const hidden = [...bits].map((bit) => (bit === "0" ? ZW.space : ZW.joiner)).join("");
  return carrier + ZW.wordJoiner + hidden;
}

export function invisibleDecode(stego: string): string {
  const idx = stego.indexOf(ZW.wordJoiner);
  const region = idx >= 0 ? stego.slice(idx + 1) : stego;
  const bits = [...region]
    .map((c) => {
      if (c === ZW.space) return "0";
      if (c === ZW.joiner) return "1";
      return "";
    })
    .join("");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes).toString("utf8");
}

/** Trailing whitespace stego using space vs tab (less stealthy, easy to demo). */
export function whitespaceEncode(payload: string, carrierLines: string[]): string {
  const bits = [...Buffer.from(payload, "utf8")]
    .map((b) => b.toString(2).padStart(8, "0"))
    .join("");
  const lines = [...carrierLines];
  for (let i = 0; i < bits.length; i++) {
    const lineIdx = i % Math.max(lines.length, 1);
    lines[lineIdx] = (lines[lineIdx] || "") + (bits[i] === "0" ? " " : "\t");
  }
  return lines.join("\n");
}

export function detectInvisible(text: string): {
  hasZeroWidth: boolean;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {
    zwsp: 0,
    zwj: 0,
    zwnj: 0,
    wordJoiner: 0,
    bom: 0,
    vs: 0,
  };
  for (const ch of text) {
    const cp = ch.codePointAt(0) || 0;
    if (ch === ZW.space) counts.zwsp++;
    if (ch === ZW.joiner) counts.zwj++;
    if (ch === ZW.nonJoiner) counts.zwnj++;
    if (ch === ZW.wordJoiner) counts.wordJoiner++;
    if (ch === ZW.bom) counts.bom++;
    if (cp >= 0xfe00 && cp <= 0xfe0f) counts.vs++;
  }
  const hasZeroWidth = Object.values(counts).some((n) => n > 0);
  return { hasZeroWidth, counts };
}
