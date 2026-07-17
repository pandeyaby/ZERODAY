/**
 * Tokenade-style dense token payloads for tokenizer / UI stress testing.
 * WARNING: Can degrade model/UI performance — lab use only.
 */

export type TokenadeWeight = "feather" | "light" | "middle" | "heavy" | "super";

const WEIGHT: Record<TokenadeWeight, { depth: number; breadth: number; repeats: number }> = {
  feather: { depth: 1, breadth: 2, repeats: 2 },
  light: { depth: 2, breadth: 3, repeats: 3 },
  middle: { depth: 3, breadth: 4, repeats: 4 },
  heavy: { depth: 4, breadth: 6, repeats: 6 },
  super: { depth: 5, breadth: 8, repeats: 8 },
};

const SAFE_THRESHOLD = 50_000;

export function estimateTokenadeLength(weight: TokenadeWeight): number {
  const { depth, breadth, repeats } = WEIGHT[weight];
  // Rough geometric growth
  return Math.min(Math.pow(breadth, depth) * repeats * 4, 2_000_000);
}

export function generateTokenade(opts: {
  weight?: TokenadeWeight;
  carrier?: string;
  useVariationSelectors?: boolean;
  separator?: "zwj" | "zwnj" | "zwsp" | "none";
}): { output: string; length: number; dangerous: boolean } {
  const weight = opts.weight || "feather";
  const { depth, breadth, repeats } = WEIGHT[weight];
  const carrier = opts.carrier || "🐍";
  const sep =
    opts.separator === "zwj"
      ? "\u200D"
      : opts.separator === "zwnj"
        ? "\u200C"
        : opts.separator === "zwsp"
          ? "\u200B"
          : "";

  const parts: string[] = [];
  for (let r = 0; r < repeats; r++) {
    parts.push(buildNest(carrier, depth, breadth, opts.useVariationSelectors !== false, sep));
  }
  let output = parts.join(sep || "");
  // Hard cap for browser safety in War Room
  if (output.length > 200_000) output = output.slice(0, 200_000);
  return {
    output,
    length: output.length,
    dangerous: output.length > SAFE_THRESHOLD,
  };
}

function buildNest(
  carrier: string,
  depth: number,
  breadth: number,
  vs: boolean,
  sep: string
): string {
  if (depth <= 0) {
    return carrier + (vs ? "\uFE0F" : "");
  }
  const kids = Array.from({ length: breadth }, () =>
    buildNest(carrier, depth - 1, Math.max(1, breadth - 1), vs, sep)
  );
  return kids.join(sep || "");
}

export function generateTextPayload(base: string, repeats: number, combining = false): string {
  const marks = combining ? "\u0301\u0308" : "";
  return Array.from({ length: Math.min(repeats, 500) }, () => base + marks).join("\u200B");
}
