/**
 * Tree-sitter rules engine: intraprocedural value tracking (constant / dynamic /
 * request-tainted) from sources through assignments, concatenation, templates
 * and format calls to sinks. Localization candidates only.
 */

import type { Node } from "web-tree-sitter";
import { parserFor, type LangId } from "./grammar";
import {
  FORMATTERS,
  JAVA_TAINTED_PARAM_ANNOTATIONS,
  SANITIZERS,
  SECRET_FORMATS,
  SECRET_NAME,
  SECRET_PLACEHOLDER,
  SINKS,
  SOURCES,
  familyOf,
  type Family,
  type SinkSpec,
} from "./specs";

export interface EngineHit {
  cwe: string;
  ruleId: string;
  startLine: number;
  endLine: number;
  title: string;
  note: string;
  score: number;
}

/** What we know about a value. */
interface Val {
  /** Derived from request input. */
  tainted: boolean;
  /** Not a compile-time constant. */
  dynamic: boolean;
  /** Concatenated literal text (for keyword checks like SQL / HTML). */
  literal: string;
  /** Where the request input came from. */
  src?: { line: number; text: string };
}

const CONST = (literal = ""): Val => ({ tainted: false, dynamic: false, literal });
const UNKNOWN: Val = { tainted: false, dynamic: true, literal: "" };
const SAFE: Val = { tainted: false, dynamic: false, literal: "" };

function join(vals: Val[]): Val {
  const src = vals.find((v) => v.tainted)?.src;
  return {
    tainted: vals.some((v) => v.tainted),
    dynamic: vals.some((v) => v.dynamic),
    literal: vals.map((v) => v.literal).join(""),
    ...(src ? { src } : {}),
  };
}

type Env = Map<string, Val>;

interface CallShape {
  callee: string;
  args: Node[];
  /** Keyword args / option-object properties: name → value node. */
  options: Map<string, Node>;
  receiver?: Node;
  isNew: boolean;
}

// ─── Language adapters ─────────────────────────────────────────────────────

const SCOPES: Record<Family, Set<string>> = {
  js: new Set([
    "function_declaration",
    "function_expression",
    "function",
    "arrow_function",
    "method_definition",
    "generator_function_declaration",
    "generator_function",
  ]),
  py: new Set(["function_definition", "lambda"]),
  java: new Set(["method_declaration", "constructor_declaration", "lambda_expression"]),
  go: new Set(["function_declaration", "method_declaration", "func_literal"]),
};

const STRING_TYPES = new Set([
  "string",
  "template_string",
  "string_literal",
  "text_block",
  "interpreted_string_literal",
  "raw_string_literal",
  "concatenated_string",
]);

const MEMBER_TYPES = new Set([
  "member_expression",
  "subscript_expression",
  "attribute",
  "subscript",
  "field_access",
  "selector_expression",
  "index_expression",
]);

const CALL_TYPES = new Set(["call_expression", "call", "method_invocation"]);
const NEW_TYPES = new Set(["new_expression", "object_creation_expression"]);

function stripQuotes(text: string): string {
  return text
    .replace(/^[rbuRBUfF]{0,2}("""|'''|"|'|`)/, "")
    .replace(/("""|'''|"|'|`)$/, "");
}

function identifierName(n: Node): string | null {
  switch (n.type) {
    case "identifier":
    case "shorthand_property_identifier":
    case "shorthand_property_identifier_pattern":
      return n.text;
    default:
      return null;
  }
}

/** All identifiers bound by a declaration target (handles destructuring). */
function patternNames(n: Node): string[] {
  const direct = identifierName(n);
  if (direct) return [direct];
  if (MEMBER_TYPES.has(n.type)) return [n.text];
  const out: string[] = [];
  for (const c of n.namedChildren) {
    if (!c) continue;
    // `{ a: b }` binds b, not a
    if (c.type === "pair_pattern") {
      const v = c.childForFieldName("value");
      if (v) out.push(...patternNames(v));
      continue;
    }
    if (c.type === "type_annotation" || c.type === "property_identifier") continue;
    out.push(...patternNames(c));
  }
  return out;
}

interface Binding {
  targets: Node[];
  values: Array<Node | null>;
  augmented: boolean;
}

function bindingOf(n: Node, fam: Family): Binding | null {
  switch (fam) {
    case "js": {
      if (n.type === "variable_declarator") {
        return { targets: [n.childForFieldName("name")!], values: [n.childForFieldName("value")], augmented: false };
      }
      if (n.type === "assignment_expression" || n.type === "augmented_assignment_expression") {
        return {
          targets: [n.childForFieldName("left")!],
          values: [n.childForFieldName("right")],
          augmented: n.type === "augmented_assignment_expression",
        };
      }
      return null;
    }
    case "py": {
      if (n.type === "assignment" || n.type === "augmented_assignment") {
        const left = n.childForFieldName("left")!;
        const right = n.childForFieldName("right");
        if (left.type === "pattern_list" || left.type === "tuple_pattern") {
          const ts = left.namedChildren.filter((c): c is Node => !!c);
          const vs =
            right && (right.type === "expression_list" || right.type === "tuple")
              ? right.namedChildren
              : null;
          return {
            targets: ts,
            values: ts.map((_, i) => (vs ? (vs[i] ?? null) : right)),
            augmented: false,
          };
        }
        return { targets: [left], values: [right], augmented: n.type === "augmented_assignment" };
      }
      return null;
    }
    case "java": {
      if (n.type === "variable_declarator") {
        return { targets: [n.childForFieldName("name")!], values: [n.childForFieldName("value")], augmented: false };
      }
      if (n.type === "assignment_expression") {
        const op = n.childForFieldName("operator")?.text ?? "=";
        return {
          targets: [n.childForFieldName("left")!],
          values: [n.childForFieldName("right")],
          augmented: op !== "=",
        };
      }
      return null;
    }
    case "go": {
      if (n.type === "short_var_declaration" || n.type === "assignment_statement") {
        const ts = (n.childForFieldName("left")?.namedChildren ?? []).filter((c): c is Node => !!c);
        const vs = (n.childForFieldName("right")?.namedChildren ?? []).filter((c): c is Node => !!c);
        const op = n.childForFieldName("operator")?.text ?? "=";
        return {
          targets: ts,
          values: ts.map((_, i) => (vs.length === ts.length ? vs[i]! : (vs[0] ?? null))),
          augmented: op === "+=",
        };
      }
      if (n.type === "var_spec" || n.type === "const_spec") {
        const names = n.childrenForFieldName("name").filter((c): c is Node => !!c);
        const vs = (n.childForFieldName("value")?.namedChildren ?? []).filter((c): c is Node => !!c);
        return {
          targets: names,
          values: names.map((_, i) => vs[i] ?? vs[0] ?? null),
          augmented: false,
        };
      }
      return null;
    }
  }
}

function optionsFromObject(obj: Node, into: Map<string, Node>): void {
  for (const pair of obj.namedChildren) {
    if (!pair || pair.type !== "pair") continue;
    const key = pair.childForFieldName("key");
    const value = pair.childForFieldName("value");
    if (key && value) into.set(stripQuotes(key.text), value);
  }
}

function callOf(n: Node, fam: Family): CallShape | null {
  const options = new Map<string, Node>();
  if (CALL_TYPES.has(n.type)) {
    let callee: string;
    let receiver: Node | undefined;
    if (fam === "java") {
      const obj = n.childForFieldName("object");
      const name = n.childForFieldName("name")?.text ?? "";
      callee = obj ? `${obj.text}.${name}` : name;
      receiver = obj ?? undefined;
    } else {
      const fn = n.childForFieldName("function");
      if (!fn) return null;
      callee = fn.text;
      receiver =
        fn.childForFieldName("object") ?? fn.childForFieldName("operand") ?? undefined;
    }
    const argsNode = n.childForFieldName("arguments");
    const args: Node[] = [];
    for (const a of argsNode?.namedChildren ?? []) {
      if (!a || a.type === "comment") continue;
      if (a.type === "keyword_argument") {
        const k = a.childForFieldName("name")?.text;
        const v = a.childForFieldName("value");
        if (k && v) options.set(k, v);
        continue;
      }
      if (fam === "js" && a.type === "object") optionsFromObject(a, options);
      args.push(a);
    }
    return { callee: callee.replace(/\s+/g, ""), args, options, receiver, isNew: false };
  }
  if (NEW_TYPES.has(n.type)) {
    const ctor = n.childForFieldName("constructor") ?? n.childForFieldName("type");
    const argsNode = n.childForFieldName("arguments");
    const args: Node[] = [];
    for (const a of argsNode?.namedChildren ?? []) {
      if (!a || a.type === "comment") continue;
      if (fam === "js" && a.type === "object") optionsFromObject(a, options);
      args.push(a);
    }
    return { callee: (ctor?.text ?? "").replace(/\s+/g, ""), args, options, isNew: true };
  }
  return null;
}

// ─── Analyzer ──────────────────────────────────────────────────────────────

class FileAnalyzer {
  readonly hits: EngineHit[] = [];
  private readonly fam: Family;
  private readonly sinks: SinkSpec[];

  constructor(
    lang: LangId,
    private readonly source: string,
    private readonly lines: string[],
    cwes: Set<string>,
  ) {
    this.fam = familyOf(lang);
    this.sinks = SINKS.filter((s) => s.families.includes(this.fam) && cwes.has(s.cwe));
    this.wantSecrets = cwes.has("CWE-798");
    this.wantSqlConstruct = cwes.has("CWE-89");
  }

  private readonly wantSecrets: boolean;
  private readonly wantSqlConstruct: boolean;

  private isSinkCallee(call: CallShape): boolean {
    return SINKS.some(
      (s) =>
        s.families.includes(this.fam) &&
        (s.kind === "call" || s.kind === "new") &&
        (s.kind === "new") === call.isNew &&
        !!s.target?.test(call.callee) &&
        !s.notTarget?.test(call.callee),
    );
  }

  isSource(n: Node): { line: number; text: string } | null {
    let text: string | null = null;
    if (MEMBER_TYPES.has(n.type)) text = n.text;
    else if (CALL_TYPES.has(n.type)) text = callOf(n, this.fam)?.callee ?? null;
    else if (NEW_TYPES.has(n.type) && this.fam === "js") text = `new ${callOf(n, this.fam)?.callee ?? ""}`;
    if (!text || text.length > 300) return null;
    const re = SOURCES[this.fam];
    const probe = this.fam === "js" ? text.replace(/^new\s+/, "") : text;
    if (!re.test(probe)) return null;
    return { line: n.startPosition.row + 1, text: text.slice(0, 80) };
  }

  evaluate(n: Node | null, env: Env): Val {
    if (!n) return UNKNOWN;
    const src = this.isSource(n);
    if (src) return { tainted: true, dynamic: true, literal: "", src };

    const name = identifierName(n);
    if (name) {
      if (/^[A-Z][A-Z0-9_]*$/.test(name) && !env.has(name)) return CONST();
      return env.get(name) ?? UNKNOWN;
    }

    // String literals (with interpolation for templates / f-strings)
    if (STRING_TYPES.has(n.type)) {
      const parts: Val[] = [];
      const interp = n.namedChildren.filter(
        (c): c is Node =>
          !!c && (c.type === "template_substitution" || c.type === "interpolation" || STRING_TYPES.has(c.type)),
      );
      if (interp.length === 0) return CONST(stripQuotes(n.text));
      for (const c of n.namedChildren) {
        if (!c) continue;
        if (c.type === "template_substitution" || c.type === "interpolation") {
          const inner = c.namedChildren.find((x): x is Node => !!x && x.type !== "format_specifier") ?? null;
          parts.push({ ...this.evaluate(inner, env), dynamic: true });
        } else if (STRING_TYPES.has(c.type)) {
          parts.push(this.evaluate(c, env));
        } else {
          parts.push(CONST(c.text));
        }
      }
      return join(parts);
    }
    if (
      n.type === "number" ||
      n.type === "integer" ||
      n.type === "float" ||
      n.type === "int_literal" ||
      n.type === "decimal_integer_literal" ||
      n.type === "true" ||
      n.type === "false" ||
      n.type === "null" ||
      n.type === "none" ||
      n.type === "nil"
    ) {
      return SAFE;
    }

    // Concatenation / % formatting
    if (n.type === "binary_expression" || n.type === "binary_operator") {
      const op = n.childForFieldName("operator")?.text;
      if (op === "+" || op === "%") {
        return join([
          this.evaluate(n.childForFieldName("left"), env),
          this.evaluate(n.childForFieldName("right"), env),
        ]);
      }
      return { ...join(n.namedChildren.map((c) => this.evaluate(c, env))), literal: "" };
    }

    const call = callOf(n, this.fam);
    if (call) {
      if (SANITIZERS[this.fam].test(call.callee)) return SAFE;
      // A sink's result (file contents, response body, query rows) is not the request input.
      if (this.isSinkCallee(call)) return UNKNOWN;
      const argVals = call.args.map((a) => this.evaluate(a, env));
      const recv = call.receiver ? this.evaluate(call.receiver, env) : SAFE;
      if (FORMATTERS[this.fam].test(call.callee) || /\.format$/.test(call.callee)) {
        return { ...join([recv, ...argVals]), dynamic: true };
      }
      const all = join([recv, ...argVals]);
      return { tainted: all.tainted, dynamic: true, literal: "", ...(all.src ? { src: all.src } : {}) };
    }

    // Anything else (parens, await, casts, arrays, member access on tainted objects…)
    const kids = n.namedChildren.filter((c): c is Node => !!c && c.type !== "comment");
    if (kids.length === 0) return UNKNOWN;
    if (kids.length === 1 && (n.type.includes("parenthes") || n.type === "await_expression")) {
      return this.evaluate(kids[0]!, env);
    }
    const v = join(kids.map((c) => this.evaluate(c, env)));
    return { ...v, dynamic: true, literal: MEMBER_TYPES.has(n.type) ? "" : v.literal };
  }

  private report(spec: SinkSpec, at: Node, val: Val | null, extraNote?: string): void {
    const line = at.startPosition.row + 1;
    let score: number;
    let note: string;
    if (val?.tainted) {
      score = 92;
      note = val.src
        ? `Request input from line ${val.src.line} (\`${val.src.text}\`) reaches this call.`
        : "Request input reaches this call.";
    } else if (spec.when === "always" && !val?.dynamic) {
      score = 60;
      note = "Dangerous API in use — review how its input is produced.";
    } else if (val?.dynamic) {
      score = spec.when === "always" ? 70 : 72;
      note = "Value is built at runtime (not a constant) — check whether it can carry untrusted input.";
    } else {
      score = 60;
      note = "Dangerous API in use — review how its input is produced.";
    }
    if (extraNote) note = `${note} ${extraNote}`;
    this.hits.push({
      cwe: spec.cwe,
      ruleId: `${spec.cwe.toLowerCase()}/${spec.id}`,
      startLine: line,
      endLine: at.endPosition.row + 1,
      title: spec.title,
      note,
      score,
    });
  }

  /** Does `val` satisfy the sink's trigger condition? */
  private triggers(spec: SinkSpec, val: Val): boolean {
    if (val.tainted) return true;
    if (spec.when === "tainted") return false;
    if (spec.when === "always") return true;
    return val.dynamic && (!spec.literalRe || spec.literalRe.test(val.literal));
  }

  private optionIs(call: CallShape, opt: { name: string; value: RegExp }): boolean {
    const v = call.options.get(opt.name);
    return !!v && opt.value.test(v.text.trim());
  }

  checkSinks(n: Node, env: Env): void {
    if (this.sinks.length === 0) return;

    // Calls / constructors
    const call = callOf(n, this.fam);
    if (call) {
      for (const spec of this.sinks) {
        if ((spec.kind === "call" && call.isNew) || (spec.kind === "new" && !call.isNew)) continue;
        if (spec.kind !== "call" && spec.kind !== "new") continue;
        if (!spec.target?.test(call.callee)) continue;
        if (spec.notTarget?.test(call.callee)) continue;
        if (spec.requireOption && !this.optionIs(call, spec.requireOption)) continue;
        if (spec.safeOption && this.optionIs(call, spec.safeOption)) continue;
        if (spec.fileLacks?.test(this.source)) continue;

        let picked: Node[];
        if (spec.args === "query") {
          const first = call.args[0];
          const isCtx = first && /^(?:ctx|c|context|r\.Context\(\)|context\.\w+\(\))$/.test(first.text);
          picked = call.args.slice(isCtx ? 1 : 0, isCtx ? 2 : 1);
        } else if (spec.args) {
          picked = spec.args.map((i) => call.args[i]).filter((a): a is Node => !!a);
        } else {
          picked = call.args;
        }

        if (spec.when === "always" && picked.length === 0) {
          this.report(spec, n, null);
          continue;
        }
        const vals = picked.map((a) => this.evaluate(a, env));
        const best = vals.find((v) => v.tainted) ?? vals.find((v) => this.triggers(spec, v));
        if (best && this.triggers(spec, best)) {
          this.report(spec, n, best);
        } else if (spec.when === "always" && spec.literalRe) {
          // e.g. setFeature(feature_external_ges, True): literal/identifier text match
          if (picked.some((a) => spec.literalRe!.test(a.text))) this.report(spec, n, null);
        }
      }
      return;
    }

    // Property assignment sinks (innerHTML, location)
    if (this.fam === "js" && n.type === "assignment_expression") {
      const left = n.childForFieldName("left");
      if (!left) return;
      for (const spec of this.sinks) {
        if (spec.kind !== "assign" || !spec.target?.test(left.text)) continue;
        const val = this.evaluate(n.childForFieldName("right"), env);
        if (this.triggers(spec, val)) this.report(spec, n, val);
      }
      return;
    }

    // JSX attribute sinks (dangerouslySetInnerHTML)
    if (this.fam === "js" && n.type === "jsx_attribute") {
      const nameNode = n.namedChildren[0];
      if (!nameNode) return;
      for (const spec of this.sinks) {
        if (spec.kind !== "jsx-attr" || !spec.target?.test(nameNode.text)) continue;
        const valueNode = n.namedChildren[1] ?? null;
        const opts = new Map<string, Node>();
        const obj = valueNode?.namedChildren.find((c): c is Node => !!c && c.type === "object");
        if (obj) optionsFromObject(obj, opts);
        const val = this.evaluate(opts.get("__html") ?? valueNode, env);
        if (val.dynamic || val.tainted) this.report(spec, n, val);
      }
      return;
    }

    // Returned HTML from a handler (Python)
    if (n.type === "return_statement") {
      for (const spec of this.sinks) {
        if (spec.kind !== "return") continue;
        const val = this.evaluate(n.namedChildren[0] ?? null, env);
        if (val.tainted && (!spec.literalRe || spec.literalRe.test(val.literal))) this.report(spec, n, val);
      }
    }
  }

  /** A SQL statement assembled at runtime, even if the executing call is not recognized. */
  private checkSqlConstruct(at: Node, val: Val): void {
    if (!this.wantSqlConstruct || !val.dynamic) return;
    if (!/^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b[\s\S]*\b(?:FROM|INTO|SET|WHERE|VALUES)\b/i.test(val.literal)) return;
    const line = at.startPosition.row + 1;
    this.hits.push({
      cwe: "CWE-89",
      ruleId: "cwe-89/sql-string-built",
      startLine: line,
      endLine: at.endPosition.row + 1,
      title: "SQL statement assembled from dynamic values",
      note: val.tainted && val.src
        ? `SQL text includes request input from line ${val.src.line} (\`${val.src.text}\`).`
        : "SQL text is concatenated / interpolated at runtime — use bound parameters.",
      score: val.tainted ? 85 : 55,
    });
  }

  checkSecret(nameNode: Node | null, valueNode: Node | null): void {
    if (!this.wantSecrets || !nameNode || !valueNode || !STRING_TYPES.has(valueNode.type)) return;
    const hasInterp = valueNode.namedChildren.some(
      (c) => c && (c.type === "template_substitution" || c.type === "interpolation"),
    );
    if (hasInterp) return;
    const name = stripQuotes(nameNode.text).split(".").pop() ?? "";
    const value = stripQuotes(valueNode.text);
    if (!SECRET_NAME.test(name) || value.length < 6 || SECRET_PLACEHOLDER.test(value) || /\s/.test(value)) return;
    if (/^(?:https?:|\/|\.\/|[a-z_]+\.[a-z_]+$)/i.test(value)) return; // URLs, paths, config keys
    const line = valueNode.startPosition.row + 1;
    this.hits.push({
      cwe: "CWE-798",
      ruleId: "cwe-798/hardcoded-credential",
      startLine: line,
      endLine: line,
      title: "Hard-coded credential",
      note: `\`${name}\` is assigned a string literal — move secrets to configuration or a secret store.`,
      score: 75,
    });
  }

  scanSecretFormats(): void {
    if (!this.wantSecrets) return;
    this.lines.forEach((text, i) => {
      for (const f of SECRET_FORMATS) {
        if (!f.re.test(text)) continue;
        this.hits.push({
          cwe: "CWE-798",
          ruleId: `cwe-798/${f.id}`,
          startLine: i + 1,
          endLine: i + 1,
          title: f.title,
          note: "Credential-shaped literal — rotate it and move it to a secret store.",
          score: 85,
        });
        break;
      }
    });
  }

  private bindParams(scope: Node, env: Env): void {
    const params =
      scope.childForFieldName("parameters") ?? scope.childForFieldName("parameter") ?? null;
    if (!params) return;
    for (const p of params.namedChildren) {
      if (!p) continue;
      const tainted = this.fam === "java" && JAVA_TAINTED_PARAM_ANNOTATIONS.test(p.text);
      const nameNode = p.childForFieldName("name") ?? p.childForFieldName("pattern") ?? p;
      for (const name of patternNames(nameNode)) {
        env.set(
          name,
          tainted
            ? { tainted: true, dynamic: true, literal: "", src: { line: p.startPosition.row + 1, text: p.text.slice(0, 80) } }
            : UNKNOWN,
        );
      }
    }
  }

  visit(n: Node, env: Env): void {
    if (SCOPES[this.fam].has(n.type)) {
      const inner: Env = new Map(env);
      this.bindParams(n, inner);
      for (const c of n.namedChildren) if (c) this.visit(c, inner);
      return;
    }

    this.checkSinks(n, env);
    for (const c of n.namedChildren) if (c) this.visit(c, env);

    const b = bindingOf(n, this.fam);
    if (b) {
      b.targets.forEach((t, i) => {
        const valueNode = b.values[i] ?? null;
        this.checkSecret(t, valueNode);
        const val = this.evaluate(valueNode, env);
        if (valueNode) this.checkSqlConstruct(valueNode, val);
        for (const name of patternNames(t)) {
          env.set(name, b.augmented ? join([env.get(name) ?? UNKNOWN, val]) : val);
        }
      });
    }

    // Credential-looking keys in object literals / keyword args / struct literals
    if (n.type === "pair" || n.type === "keyword_argument" || n.type === "keyed_element") {
      const k = n.childForFieldName("key") ?? n.childForFieldName("name") ?? n.namedChildren[0] ?? null;
      const v = n.childForFieldName("value") ?? n.namedChildren[1] ?? null;
      this.checkSecret(k, v);
    }
  }
}

/**
 * Analyze one source file for the requested CWEs. Returns [] for files that do
 * not parse into anything useful.
 */
export async function analyzeSource(
  lang: LangId,
  source: string,
  cwes: Set<string>,
): Promise<EngineHit[]> {
  const parser = await parserFor(lang);
  const tree = parser.parse(source);
  if (!tree) return [];
  try {
    const a = new FileAnalyzer(lang, source, source.split(/\r?\n/), cwes);
    a.visit(tree.rootNode, new Map());
    a.scanSecretFormats();
    // One hit per (line, rule): nested sinks can match the same call twice.
    const seen = new Set<string>();
    return a.hits.filter((h) => {
      const key = `${h.ruleId}:${h.startLine}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } finally {
    tree.delete();
    parser.delete();
  }
}
