/**
 * Mutation Lab — batch variants for purple-team / prompt testing.
 */

import { TRANSFORMS, applyTransform } from "@/stego/transforms";
import { invisibleEncode } from "@/stego/invisible";
import { emojiEncode } from "@/stego/emoji";

export type MutationStrategy =
  | "random_mix"
  | "zero_width_pepper"
  | "unicode_noise"
  | "zalgo"
  | "whitespace_chaos"
  | "casing_chaos"
  | "homoglyph";

export interface MutationCase {
  id: number;
  strategy: string;
  transformId?: string;
  output: string;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function mutate(
  seed: string,
  count = 8,
  strategies: MutationStrategy[] = ["random_mix"]
): MutationCase[] {
  const cases: MutationCase[] = [];
  for (let i = 0; i < count; i++) {
    const strategy = strategies[i % strategies.length];
    let output = seed;
    let transformId: string | undefined;

    switch (strategy) {
      case "random_mix": {
        const t = randomItem(TRANSFORMS.filter((x) => x.category !== "promptcraft"));
        transformId = t.id;
        try {
          output = t.encode(seed);
        } catch {
          output = seed;
        }
        break;
      }
      case "zero_width_pepper":
        output = invisibleEncode(seed, seed.slice(0, Math.min(24, seed.length)) || "note");
        break;
      case "unicode_noise":
        output = applyTransform("fullwidth", seed);
        break;
      case "zalgo":
        output = applyTransform("zalgo_light", seed);
        break;
      case "whitespace_chaos":
        output = seed.split("").join(Math.random() > 0.5 ? " " : "  ");
        break;
      case "casing_chaos":
        output = applyTransform("alternating_case", seed);
        break;
      case "homoglyph":
        output = applyTransform("homoglyph", seed);
        break;
    }

    // Occasionally wrap with emoji stego for exfil-path demos
    if (strategy === "random_mix" && i % 5 === 4) {
      output = emojiEncode(seed, "🔐");
      transformId = "emoji_stego";
    }

    cases.push({ id: i + 1, strategy, transformId, output });
  }
  return cases;
}
