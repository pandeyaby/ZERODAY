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
  /** CWEs every non-constant part has been sanitized for (e.g. HTML-escaped → CWE-79). */
  clean?: string[];
  /** Known numeric constant (for folding `if ((7 * 42) - num > 200)`). */
  num?: number;
}

const CONST = (literal = ""): Val => ({ tainted: false, dynamic: false, literal });
const UNKNOWN: Val = { tainted: false, dynamic: true, literal: "" };
const SAFE: Val = { tainted: false, dynamic: false, literal: "" };

/**
 * CWEs the value is clean for: every request-derived part is sanitized (or, when
 * nothing is request-derived, every dynamic part is).
 */
function cleanOf(vals: Val[]): string[] | undefined {
  const tainted = vals.filter((v) => v.tainted);
  const dyn = tainted.length ? tainted : vals.filter((v) => v.dynamic);
  if (dyn.length === 0 || dyn.some((v) => !v.clean?.length)) return undefined;
  const common = dyn.reduce<string[]>((acc, v) => acc.filter((c) => v.clean!.includes(c)), dyn[0]!.clean!);
  return common.length ? common : undefined;
}

/** Concatenation-style join: literal text is concatenated. */
function join(vals: Val[]): Val {
  const src = vals.find((v) => v.tainted)?.src;
  const clean = cleanOf(vals);
  return {
    tainted: vals.some((v) => v.tainted),
    dynamic: vals.some((v) => v.dynamic),
    literal: vals.map((v) => v.literal).join(""),
    ...(src ? { src } : {}),
    ...(clean ? { clean } : {}),
  };
}

/** Control-flow merge (either branch may have run). */
function merge(a: Val, b: Val): Val {
  const j = join([a, b]);
  const num = a.num !== undefined && a.num === b.num ? a.num : undefined;
  return {
    ...j,
    literal: a.literal.length >= b.literal.length ? a.literal : b.literal,
    ...(num !== undefined ? { num } : {}),
  };
}

/** `java.io.File` → `File`, `org.x.DatabaseHelper.run` → `DatabaseHelper.run`. */
function stripJavaPackage(name: string): string {
  return name.replace(/^(?:[a-z_][\w]*\.)+(?=[A-Z])/, "");
}

/** Simple Java type name: `java.util.List<String>[]` → `List`. */
function simpleJavaType(t: string): string {
  return stripJavaPackage(t.replace(/<[\s\S]*>/g, "").replace(/\[\]/g, "").trim());
}

type Env = Map<string, Val>;

interface CallShape {
  callee: string;
  args: Node[];
  /** Keyword args / option-object properties: name → value node. */
  options: Map<string, Node>;
  receiver?: Node;
  isNew: boolean;
  /** Java: callee rewritten with the receiver's declared type (`r.exec` → `Runtime.exec`). */
  typed?: string;
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

function callOf(n: Node, fam: Family, javaTypes?: Map<string, string>): CallShape | null {
  const options = new Map<string, Node>();
  if (CALL_TYPES.has(n.type)) {
    let callee: string;
    let receiver: Node | undefined;
    let typed: string | undefined;
    if (fam === "java") {
      const obj = n.childForFieldName("object");
      const name = n.childForFieldName("name")?.text ?? "";
      callee = stripJavaPackage(obj ? `${obj.text.replace(/\s+/g, "")}.${name}` : name);
      receiver = obj ?? undefined;
      const t = obj?.type === "identifier" ? javaTypes?.get(obj.text) : undefined;
      if (t) typed = `${t}.${name}`;
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
    return { callee: callee.replace(/\s+/g, ""), args, options, receiver, isNew: false, ...(typed ? { typed } : {}) };
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
    const ctorName = (ctor?.text ?? "").replace(/\s+/g, "");
    return {
      callee: fam === "java" ? simpleJavaType(ctorName) : ctorName,
      args,
      options,
      isNew: true,
    };
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
  /** Java: declared types of locals / parameters / fields (simple names). */
  private readonly javaTypes = new Map<string, string>();
  /** Functions / methods defined in this file, by name (for same-file call summaries). */
  private readonly fns = new Map<string, Node[]>();
  /** >0 while evaluating a callee body for a summary: no hits are reported. */
  private suppress = 0;
  /** Return values collected for the function currently being summarized. */
  private readonly returns: Val[][] = [];
  private readonly inlining: number[] = [];
  private readonly summaries = new Map<string, Val>();

  private addHit(h: EngineHit): void {
    if (this.suppress === 0) this.hits.push(h);
  }

  /** Index named functions / methods (and `const f = () => …`). */
  indexFunctions(root: Node): void {
    const add = (name: string | undefined, def: Node) => {
      if (!name) return;
      const list = this.fns.get(name) ?? [];
      list.push(def);
      this.fns.set(name, list);
    };
    const walk = (n: Node) => {
      if (SCOPES[this.fam].has(n.type)) {
        const name = n.childForFieldName("name")?.text;
        if (name) add(name, n);
        else if (n.parent?.type === "variable_declarator") add(n.parent.childForFieldName("name")?.text, n);
      }
      for (const c of n.namedChildren) if (c) walk(c);
    };
    walk(root);
  }

  private paramNodes(def: Node): Node[] {
    const params = def.childForFieldName("parameters") ?? def.childForFieldName("parameter");
    if (!params) return [];
    if (params.type === "identifier") return [params];
    return params.namedChildren.filter(
      (p): p is Node => !!p && p.type !== "comment" && !(this.fam === "py" && /^(?:self|cls)$/.test(p.text)),
    );
  }

  /** Summarize a same-file callee with concrete argument values (depth ≤ 2). */
  private inline(call: CallShape, argVals: Val[]): Val | undefined {
    const name = call.callee.split(".").pop() ?? "";
    const defs = this.fns.get(name);
    if (!defs?.length || this.inlining.length >= 2) return undefined;
    const def = defs.find((d) => this.paramNodes(d).length === argVals.length) ?? defs[0]!;
    if (this.inlining.includes(def.id)) return undefined;
    const sig = `${def.id}|${argVals.map((v) => `${+v.tainted}${+v.dynamic}${(v.clean ?? []).join("+")}${v.num ?? ""}`).join(",")}`;
    const cached = this.summaries.get(sig);
    if (cached) return cached;

    const env: Env = new Map();
    this.paramNodes(def).forEach((p, i) => {
      const nameNode = p.childForFieldName("name") ?? p.childForFieldName("pattern") ?? p;
      for (const n of patternNames(nameNode)) env.set(n, argVals[i] ?? UNKNOWN);
    });
    const body = def.childForFieldName("body");
    let result: Val;
    this.suppress++;
    this.inlining.push(def.id);
    this.returns.push([]);
    try {
      if (body && body.type !== "statement_block" && body.type !== "block" && body.type !== "constructor_body") {
        result = this.evaluate(body, env); // arrow function with an expression body
      } else {
        if (body) for (const c of body.namedChildren) if (c) this.visit(c, env);
        const rs = this.returns[this.returns.length - 1]!;
        result = rs.length ? rs.reduce((a, b) => merge(a, b)) : UNKNOWN;
      }
    } finally {
      this.returns.pop();
      this.inlining.pop();
      this.suppress--;
    }
    // Keep the caller's evidence pointer to where the input came from.
    const src = argVals.find((v) => v.tainted)?.src;
    if (result.tainted && src) result = { ...result, src };
    this.summaries.set(sig, result);
    return result;
  }

  private callOf(n: Node): CallShape | null {
    return callOf(n, this.fam, this.javaTypes);
  }

  private matches(re: RegExp | undefined, call: CallShape): boolean {
    return !!re && (re.test(call.callee) || (!!call.typed && re.test(call.typed)));
  }

  private isSinkCallee(call: CallShape): boolean {
    return SINKS.some(
      (s) =>
        s.families.includes(this.fam) &&
        (s.kind === "call" || s.kind === "new") &&
        (s.kind === "new") === call.isNew &&
        this.matches(s.target, call) &&
        !s.notTarget?.test(call.callee),
    );
  }

  private ternaryParts(n: Node): { cond: Node | null; cons: Node | null; alt: Node | null } | null {
    if (n.type === "ternary_expression") {
      return {
        cond: n.childForFieldName("condition"),
        cons: n.childForFieldName("consequence"),
        alt: n.childForFieldName("alternative"),
      };
    }
    if (n.type === "conditional_expression") {
      // Python: <body> if <cond> else <orelse>
      const [cons, cond, alt] = n.namedChildren;
      return { cond: cond ?? null, cons: cons ?? null, alt: alt ?? null };
    }
    return null;
  }

  /** Fold simple integer arithmetic over literals and known-constant locals. */
  private constNum(n: Node | null, env: Env): number | undefined {
    if (!n) return undefined;
    switch (n.type) {
      case "number":
      case "integer":
      case "int_literal":
      case "decimal_integer_literal":
      case "float":
      case "float_literal":
      case "decimal_floating_point_literal": {
        const v = Number(n.text.replace(/[_lLfFdD]/g, ""));
        return Number.isFinite(v) ? v : undefined;
      }
      case "identifier":
        return env.get(n.text)?.num;
      case "parenthesized_expression":
        return this.constNum(n.namedChildren[0] ?? null, env);
      case "unary_expression":
      case "unary_operator": {
        const op = n.childForFieldName("operator")?.text ?? n.child(0)?.text;
        const v = this.constNum(n.childForFieldName("operand") ?? n.childForFieldName("argument") ?? n.namedChildren[0] ?? null, env);
        return v === undefined ? undefined : op === "-" ? -v : op === "+" ? v : undefined;
      }
      case "binary_expression":
      case "binary_operator": {
        const op = n.childForFieldName("operator")?.text;
        const a = this.constNum(n.childForFieldName("left"), env);
        const b = this.constNum(n.childForFieldName("right"), env);
        if (a === undefined || b === undefined) return undefined;
        switch (op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": return b === 0 ? undefined : this.fam === "js" || this.fam === "py" ? a / b : Math.trunc(a / b);
          case "//": return b === 0 ? undefined : Math.floor(a / b);
          case "%": return b === 0 ? undefined : a % b;
          default: return undefined;
        }
      }
      default:
        return undefined;
    }
  }

  /** `"ABC"[1]`, `possible[0]`, `guess.charAt(2)` on constant strings. */
  private constChar(n: Node, env: Env): string | undefined {
    let base: Node | null = null;
    let index: Node | null = null;
    if (n.type === "subscript" || n.type === "subscript_expression" || n.type === "index_expression") {
      base = n.childForFieldName("value") ?? n.childForFieldName("object") ?? n.childForFieldName("operand");
      index = n.childForFieldName("subscript") ?? n.childForFieldName("index");
    } else if (n.type === "method_invocation" && n.childForFieldName("name")?.text === "charAt") {
      base = n.childForFieldName("object");
      index = n.childForFieldName("arguments")?.namedChildren[0] ?? null;
    } else if (n.type === "call_expression" && /\.charAt$/.test(n.childForFieldName("function")?.text ?? "")) {
      base = n.childForFieldName("function")?.childForFieldName("object") ?? null;
      index = n.childForFieldName("arguments")?.namedChildren[0] ?? null;
    }
    if (!base || !index) return undefined;
    const b = this.evaluate(base, env);
    const i = this.constNum(index, env);
    if (b.dynamic || b.tainted || i === undefined || !b.literal) return undefined;
    const idx = i < 0 ? b.literal.length + i : i;
    return b.literal[idx];
  }

  /** Label literals of a switch / match case ([] = default / wildcard). */
  private caseLabels(c: Node): string[] {
    const labelNodes =
      c.type === "case_clause"
        ? c.namedChildren.filter((x): x is Node => !!x && x.type === "case_pattern")
        : c.type === "switch_block_statement_group" || c.type === "switch_rule"
          ? c.namedChildren.filter((x): x is Node => !!x && x.type === "switch_label")
          : c.type === "switch_case" || c.type === "expression_case"
            ? [c.childForFieldName("value")].filter((x): x is Node => !!x)
            : [];
    const out: string[] = [];
    const collect = (x: Node) => {
      if (STRING_TYPES.has(x.type) || x.type === "character_literal" || x.type === "number" || x.type === "integer" || x.type === "decimal_integer_literal" || x.type === "int_literal") {
        out.push(stripQuotes(x.text));
        return;
      }
      for (const k of x.namedChildren) if (k) collect(k);
    };
    for (const l of labelNodes) collect(l);
    return out;
  }

  private switchParts(n: Node): { subject: Node | null; cases: Node[] } | null {
    switch (n.type) {
      case "match_statement":
        return {
          subject: n.childForFieldName("subject"),
          cases: (n.childForFieldName("body")?.namedChildren ?? []).filter((c): c is Node => !!c && c.type === "case_clause"),
        };
      case "switch_expression":
      case "switch_statement": {
        const subject = n.childForFieldName("condition") ?? n.childForFieldName("value");
        const body = n.childForFieldName("body");
        return {
          subject: subject?.type === "parenthesized_expression" ? (subject.namedChildren[0] ?? null) : subject,
          cases: (body?.namedChildren ?? []).filter(
            (c): c is Node => !!c && /^(?:switch_block_statement_group|switch_rule|switch_case|switch_default)$/.test(c.type),
          ),
        };
      }
      case "expression_switch_statement":
        return {
          subject: n.childForFieldName("value"),
          cases: n.namedChildren.filter((c): c is Node => !!c && (c.type === "expression_case" || c.type === "default_case")),
        };
      default:
        return null;
    }
  }

  private visitSwitch(n: Node, parts: { subject: Node | null; cases: Node[] }, env: Env): void {
    if (parts.subject) this.visit(parts.subject, env);
    const subj = this.evaluate(parts.subject, env);
    const isDefault = (c: Node) => this.caseLabels(c).length === 0 || c.type === "switch_default" || c.type === "default_case";
    const body = (c: Node) =>
      c.namedChildren.filter(
        (x): x is Node =>
          !!x && !/^(?:case_pattern|switch_label)$/.test(x.type) && x.id !== c.childForFieldName("value")?.id,
      );
    if (!subj.dynamic && !subj.tainted && subj.literal) {
      const hit = parts.cases.find((c) => this.caseLabels(c).includes(subj.literal)) ?? parts.cases.find(isDefault);
      if (hit) for (const x of body(hit)) this.visit(x, env);
      return;
    }
    const envs: Env[] = parts.cases.map((c) => {
      const e: Env = new Map(env);
      for (const x of body(c)) this.visit(x, e);
      return e;
    });
    if (!parts.cases.some(isDefault)) envs.push(new Map(env));
    for (const key of new Set(envs.flatMap((e) => [...e.keys()]))) {
      const vals = envs.map((e) => e.get(key) ?? env.get(key)).filter((v): v is Val => !!v);
      if (vals.length) env.set(key, vals.reduce((a, b) => merge(a, b)));
    }
  }

  /** Fold a condition to true / false when it only involves constants. */
  private constBool(n: Node | null, env: Env): boolean | undefined {
    if (!n) return undefined;
    if (n.type === "true") return true;
    if (n.type === "false") return false;
    if (n.type === "parenthesized_expression" || n.type === "condition_clause") {
      return this.constBool(n.namedChildren[n.namedChildren.length - 1] ?? null, env);
    }
    let op: string | undefined;
    let left: Node | null = null;
    let right: Node | null = null;
    if (n.type === "binary_expression") {
      op = n.childForFieldName("operator")?.text;
      left = n.childForFieldName("left");
      right = n.childForFieldName("right");
    } else if (n.type === "comparison_operator" && n.namedChildren.length === 2) {
      op = n.child(1)?.text;
      left = n.namedChildren[0] ?? null;
      right = n.namedChildren[1] ?? null;
    } else if (n.type === "boolean_operator") {
      op = n.childForFieldName("operator")?.text === "and" ? "&&" : "||";
      left = n.childForFieldName("left");
      right = n.childForFieldName("right");
    } else {
      return undefined;
    }
    if (op === "&&" || op === "||") {
      const a = this.constBool(left, env);
      const b = this.constBool(right, env);
      if (op === "&&") return a === false || b === false ? false : a && b ? true : undefined;
      return a === true || b === true ? true : a === false && b === false ? false : undefined;
    }
    const a = this.constNum(left, env);
    const b = this.constNum(right, env);
    if (a === undefined || b === undefined) return undefined;
    switch (op) {
      case ">": return a > b;
      case "<": return a < b;
      case ">=": return a >= b;
      case "<=": return a <= b;
      case "==":
      case "===": return a === b;
      case "!=":
      case "!==": return a !== b;
      default: return undefined;
    }
  }

  isSource(n: Node): { line: number; text: string } | null {
    let text: string | null = null;
    if (MEMBER_TYPES.has(n.type)) text = n.text;
    else if (CALL_TYPES.has(n.type)) text = this.callOf(n)?.callee ?? null;
    else if (NEW_TYPES.has(n.type) && this.fam === "js") text = `new ${this.callOf(n)?.callee ?? ""}`;
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

    // Ternaries: fold constant conditions, otherwise either branch
    const tern = this.ternaryParts(n);
    if (tern) {
      const k = this.constBool(tern.cond, env);
      if (k === true) return this.evaluate(tern.cons, env);
      if (k === false) return this.evaluate(tern.alt, env);
      return merge(this.evaluate(tern.cons, env), this.evaluate(tern.alt, env));
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
    const num = this.constNum(n, env);
    if (num !== undefined) return { ...SAFE, num };
    const ch = this.constChar(n, env);
    if (ch !== undefined) return CONST(ch);
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

    const call = this.callOf(n);
    if (call) {
      const san = SANITIZERS[this.fam].find((z) => this.matches(z.re, call));
      if (san) {
        if (san.cwes === "all") return SAFE;
        const inner = call.args[0] ? this.evaluate(call.args[0], env) : call.receiver ? this.evaluate(call.receiver, env) : UNKNOWN;
        return { ...inner, dynamic: true, literal: "", clean: [...new Set([...(inner.clean ?? []), ...san.cwes])] };
      }
      // A sink's result (file contents, response body, query rows) is not the request input.
      if (this.isSinkCallee(call)) return UNKNOWN;
      const argVals = call.args.map((a) => this.evaluate(a, env));
      const summary = this.inline(call, argVals);
      if (summary) return summary;
      const recv = call.receiver ? this.evaluate(call.receiver, env) : SAFE;
      if (FORMATTERS[this.fam].test(call.callee) || /\.format$/.test(call.callee)) {
        return { ...join([recv, ...argVals]), dynamic: true };
      }
      const all = join([recv, ...argVals]);
      return {
        tainted: all.tainted,
        dynamic: true,
        literal: "",
        ...(all.src ? { src: all.src } : {}),
        ...(all.clean ? { clean: all.clean } : {}),
      };
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
    this.addHit({
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
    if (val.clean?.includes(spec.cwe)) return false;
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
    const call = this.callOf(n);
    if (call) {
      for (const spec of this.sinks) {
        if ((spec.kind === "call" && call.isNew) || (spec.kind === "new" && !call.isNew)) continue;
        if (spec.kind !== "call" && spec.kind !== "new") continue;
        if (!this.matches(spec.target, call)) continue;
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
        const best =
          vals.find((v) => v.tainted && this.triggers(spec, v)) ?? vals.find((v) => this.triggers(spec, v));
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
        if (!val.tainted || val.clean?.includes(spec.cwe)) continue;
        if (!spec.literalRe || spec.literalRe.test(val.literal) || this.inRouteHandler(n)) this.report(spec, n, val);
      }
    }
  }

  /** Inside a web route handler (`@app.route`, `@bp.get`, `@router.post`, …)? */
  private inRouteHandler(n: Node): boolean {
    for (let p = n.parent; p; p = p.parent) {
      if (p.type === "function_definition") {
        const deco = p.parent?.type === "decorated_definition" ? p.parent : null;
        return !!deco && /@\s*[\w.]+\.(?:route|get|post|put|patch|delete|api_route)\s*\(/.test(deco.text.slice(0, 400));
      }
    }
    return false;
  }

  /** A SQL statement assembled at runtime, even if the executing call is not recognized. */
  private checkSqlConstruct(at: Node, val: Val): void {
    if (!this.wantSqlConstruct || !val.dynamic) return;
    if (!/^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b[\s\S]*\b(?:FROM|INTO|SET|WHERE|VALUES)\b/i.test(val.literal)) return;
    const line = at.startPosition.row + 1;
    this.addHit({
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
    this.addHit({
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
        this.addHit({
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

  /** Java: remember declared types so `r.exec(…)` with `Runtime r` matches `Runtime.exec`. */
  private recordJavaTypes(n: Node): void {
    if (this.fam !== "java") return;
    const type = n.childForFieldName("type");
    if (!type) return;
    const t = simpleJavaType(type.text);
    if (n.type === "local_variable_declaration" || n.type === "field_declaration") {
      for (const d of n.childrenForFieldName("declarator")) {
        const name = d?.childForFieldName("name")?.text;
        if (name) this.javaTypes.set(name, t);
      }
    } else if (n.type === "formal_parameter" || n.type === "enhanced_for_statement") {
      const name = n.childForFieldName("name")?.text;
      if (name) this.javaTypes.set(name, t);
    }
  }

  /** `for (x of xs)` / `for x in xs` / `for (T x : xs)` / `for _, x := range xs`. */
  private loopBinding(n: Node): { targets: Node[]; iterable: Node | null } | null {
    switch (n.type) {
      case "for_in_statement":
        return { targets: [n.childForFieldName("left")!].filter(Boolean), iterable: n.childForFieldName("right") };
      case "for_statement": {
        if (this.fam === "py") {
          return { targets: [n.childForFieldName("left")!].filter(Boolean), iterable: n.childForFieldName("right") };
        }
        const range = this.fam === "go" ? n.namedChildren.find((c) => c?.type === "range_clause") : null;
        if (!range) return null;
        return {
          targets: (range.childForFieldName("left")?.namedChildren ?? []).filter((c): c is Node => !!c),
          iterable: range.childForFieldName("right"),
        };
      }
      case "enhanced_for_statement":
        return { targets: [n.childForFieldName("name")!].filter(Boolean), iterable: n.childForFieldName("value") };
      default:
        return null;
    }
  }

  /** `list.add(x)` / `sb.append(x)` / `map.put(k, x)` / `arr.push(x)` taint the container. */
  private containerWrite(n: Node, env: Env): void {
    const call = this.callOf(n);
    if (!call || call.isNew || !call.receiver) return;
    const method = call.callee.split(".").pop() ?? "";
    if (!/^(?:add|addAll|addElement|put|putAll|putIfAbsent|append|push|unshift|insert|extend|update|setdefault|offer|set|setProperty|write|print)$/.test(method)) return;
    const recv = call.receiver;
    const key = identifierName(recv) ?? (MEMBER_TYPES.has(recv.type) ? recv.text : null);
    if (!key) return;
    const written = join(call.args.map((a) => this.evaluate(a, env)));
    if (!written.dynamic && !written.tainted) return;
    const cur = env.get(key) ?? SAFE;
    env.set(key, { ...join([cur, written]), literal: cur.literal + written.literal });
  }

  private visitIf(n: Node, env: Env): void {
    const init = n.childForFieldName("initializer");
    if (init) this.visit(init, env);
    const cond = n.childForFieldName("condition");
    if (cond) this.visit(cond, env);
    const cons = n.childForFieldName("consequence");
    const alts = n.childrenForFieldName("alternative").filter((c): c is Node => !!c);
    const k = this.constBool(cond, env);
    if (k === true) {
      if (cons) this.visit(cons, env);
      return;
    }
    if (k === false) {
      for (const a of alts) this.visit(a, env);
      return;
    }
    const e1: Env = new Map(env);
    const e2: Env = new Map(env);
    if (cons) this.visit(cons, e1);
    for (const a of alts) this.visit(a, e2);
    for (const key of new Set([...e1.keys(), ...e2.keys()])) {
      const base = env.get(key);
      const a = e1.get(key) ?? base;
      const b = e2.get(key) ?? base;
      env.set(key, a && b ? merge(a, b) : (a ?? b)!);
    }
  }

  visit(n: Node, env: Env): void {
    if (SCOPES[this.fam].has(n.type)) {
      const inner: Env = new Map(env);
      this.bindParams(n, inner);
      for (const c of n.namedChildren) if (c) this.visit(c, inner);
      return;
    }

    this.recordJavaTypes(n);

    if (n.type === "if_statement") {
      this.visitIf(n, env);
      return;
    }
    const sw = this.switchParts(n);
    if (sw) {
      this.visitSwitch(n, sw, env);
      return;
    }

    const loop = this.loopBinding(n);
    if (loop) {
      const val = this.evaluate(loop.iterable, env);
      for (const t of loop.targets) for (const name of patternNames(t)) env.set(name, val);
    }

    this.checkSinks(n, env);
    if (n.type === "return_statement" && this.returns.length) {
      this.returns[this.returns.length - 1]!.push(this.evaluate(n.namedChildren[0] ?? null, env));
    }
    for (const c of n.namedChildren) if (c) this.visit(c, env);
    this.containerWrite(n, env);

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
        // `obj.field = x` / `d["k"] = x` also taints the object
        if (MEMBER_TYPES.has(t.type)) {
          const base = t.childForFieldName("object") ?? t.childForFieldName("value") ?? t.childForFieldName("operand") ?? t.namedChildren[0];
          const baseName = base ? identifierName(base) : null;
          if (baseName && (val.tainted || val.dynamic)) {
            env.set(baseName, join([env.get(baseName) ?? SAFE, { ...val, literal: "" }]));
          }
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
    a.indexFunctions(tree.rootNode);
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
