/**
 * Tree-sitter grammar loading (web-tree-sitter + vendored WASM in grammars/).
 * Pure WASM — no native build, no network.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser } from "web-tree-sitter";

export type LangId = "javascript" | "typescript" | "tsx" | "python" | "java" | "go";

const EXT_TO_LANG: Record<string, LangId> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".py": "python",
  ".java": "java",
  ".go": "go",
};

export function langForPath(filePath: string): LangId | null {
  return EXT_TO_LANG[path.extname(filePath).toLowerCase()] ?? null;
}

function grammarsDir(): string {
  const candidates = [
    process.env.ZERODAY_GRAMMARS_DIR,
    (() => {
      try {
        // src/locate/engine → repo / package root
        return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../grammars");
      } catch {
        return undefined;
      }
    })(),
    path.resolve(process.cwd(), "grammars"),
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, "tree-sitter-javascript.wasm"))) return dir;
  }
  throw new Error(
    "Tree-sitter grammars not found (expected grammars/tree-sitter-*.wasm; set ZERODAY_GRAMMARS_DIR).",
  );
}

let initPromise: Promise<void> | null = null;
const languages = new Map<LangId, Promise<Language>>();

async function loadLanguage(lang: LangId): Promise<Language> {
  initPromise ??= Parser.init();
  await initPromise;
  let p = languages.get(lang);
  if (!p) {
    p = Language.load(path.join(grammarsDir(), `tree-sitter-${lang}.wasm`));
    languages.set(lang, p);
  }
  return p;
}

/** A parser configured for `lang`. Parsers are cheap; languages are cached. */
export async function parserFor(lang: LangId): Promise<Parser> {
  const language = await loadLanguage(lang);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}
