/**
 * Naive tokenizer visualization (UTF-8 bytes / words / approx BPE-ish chunks).
 */

export interface TokenVis {
  index: number;
  text: string;
  id: number;
  bytes: number;
}

export type TokenizerEngine = "utf8" | "words" | "cl100k_approx" | "char";

const APPROX_BPE = new RegExp("\\w+|[^\\sA-Za-z0-9_]+|\\s+", "g");

export function tokenize(input: string, engine: TokenizerEngine = "words"): TokenVis[] {
  switch (engine) {
    case "utf8":
      return [...Buffer.from(input, "utf8")].map((b, i) => ({
        index: i,
        text: `0x${b.toString(16).padStart(2, "0")}`,
        id: b,
        bytes: 1,
      }));
    case "char":
      return [...input].map((ch, i) => ({
        index: i,
        text: ch,
        id: ch.codePointAt(0) || 0,
        bytes: Buffer.from(ch, "utf8").length,
      }));
    case "cl100k_approx": {
      const parts = input.match(APPROX_BPE) || [];
      return parts.map((text, i) => ({
        index: i,
        text,
        id: hashId(text),
        bytes: Buffer.from(text, "utf8").length,
      }));
    }
    case "words":
    default: {
      const parts = input.split(/(\s+)/).filter((p) => p.length);
      return parts.map((text, i) => ({
        index: i,
        text,
        id: hashId(text),
        bytes: Buffer.from(text, "utf8").length,
      }));
    }
  }
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100000;
}

export function tokenizerStats(tokens: TokenVis[]) {
  return {
    tokenCount: tokens.length,
    charCount: tokens.reduce((n, t) => n + t.text.length, 0),
    byteCount: tokens.reduce((n, t) => n + t.bytes, 0),
  };
}
