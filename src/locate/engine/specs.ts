/**
 * Rule data for the tree-sitter engine: request-input sources, sanitizers and
 * sinks per CWE × language family. Localization candidates only — a hit means
 * "a human should look here", never proof of exploitability.
 */

import type { LangId } from "./grammar";

export type Family = "js" | "py" | "java" | "go";

export function familyOf(lang: LangId): Family {
  switch (lang) {
    case "javascript":
    case "typescript":
    case "tsx":
      return "js";
    case "python":
      return "py";
    case "java":
      return "java";
    case "go":
      return "go";
  }
}

/**
 * Request-input sources. Tested (anchored) against the text of member / attribute /
 * selector nodes and against call callees.
 */
export const SOURCES: Record<Family, RegExp> = {
  js: /^(?:req|request|ctx|ctx\.request)\.(?:query|params|body|headers|cookies|files|file|hostname|path|url|originalUrl)\b|^(?:req|request)\.(?:get|header|param)$|^(?:window\.|document\.)?location\.(?:search|hash|href)\b|^document\.(?:URL|documentURI|referrer|cookie)\b|^(?:new\s+)?URLSearchParams\b/,
  py: /^request\.(?:args|form|values|json|data|files|cookies|headers|GET|POST|body|query_params|path_params|FILES|COOKIES|META|get_json|get_data)\b/,
  java: /\.(?:getParameter|getParameterValues|getParameterMap|getHeader|getHeaders|getQueryString|getCookies|getInputStream|getReader|getPathInfo|getRequestURI|getRequestURL|getPart)$/,
  go: /^(?:r|req|request)\.(?:URL|Form|PostForm|MultipartForm|Header|Body|FormValue|PostFormValue|Cookie|Cookies|RequestURI)\b|^mux\.Vars$|^(?:c|ctx)\.(?:Query|Param|PostForm|DefaultQuery|DefaultPostForm|GetHeader|FormValue|QueryParam|Params)$/,
};

/** Java handler parameters bound from the request (Spring / JAX-RS annotations). */
export const JAVA_TAINTED_PARAM_ANNOTATIONS =
  /@(?:RequestParam|PathVariable|RequestBody|RequestHeader|CookieValue|ModelAttribute|QueryParam|PathParam|FormParam|HeaderParam)\b/;

/** Calls whose result is safe to use (numeric parse, escaping, basename, …). */
export const SANITIZERS: Record<Family, RegExp> = {
  js: /(?:^|\.)(?:parseInt|parseFloat|Number|Boolean|encodeURIComponent|encodeURI|escape|escapeHtml|escapeHTML|encode|sanitize|sanitizeHtml|basename|escapeId|quote|isValidObjectId)$|^(?:xss|he\.encode|validator\.\w+|DOMPurify\.sanitize|path\.basename)$/,
  py: /^(?:int|float|bool|uuid\.UUID|UUID|secure_filename|os\.path\.basename|html\.escape|escape|markupsafe\.escape|bleach\.clean|shlex\.quote|pipes\.quote|quote|urllib\.parse\.quote|parse\.quote|quote_plus)$/,
  java: /(?:^|\.)(?:parseInt|parseLong|parseDouble|valueOf|fromString|escapeHtml4|escapeHtml|forHtml|forJavaScript|encodeForHTML|encodeForSQL|htmlEscape|getName|getFileName|quote)$/,
  go: /^(?:strconv\.(?:Atoi|ParseInt|ParseUint|ParseFloat|ParseBool)|html\.EscapeString|template\.HTMLEscapeString|template\.JSEscapeString|url\.QueryEscape|url\.PathEscape|filepath\.Base|path\.Base|uuid\.Parse)$/,
};

/** Calls that format a string from their receiver / arguments. */
export const FORMATTERS: Record<Family, RegExp> = {
  js: /^(?:util\.format|format|sprintf|vsprintf)$|\.(?:concat|replace|join)$/,
  py: /\.format$|^(?:str\.format|format)$|\.join$/,
  java: /^(?:String\.format|MessageFormat\.format|String\.join)$|\.(?:concat|formatted)$/,
  go: /^fmt\.Sprintf$|^fmt\.Sprint$|^strings\.Join$/,
};

export type SinkWhen =
  /** Request input reaches the sink (strongest). */
  | "tainted"
  /** Request input, or a dynamically built value (literal parts must match `literalRe`). */
  | "tainted-or-dynamic"
  /** Any use of the API is worth a look; request input raises the score. */
  | "always";

export interface SinkSpec {
  id: string;
  cwe: string;
  families: Family[];
  kind: "call" | "new" | "assign" | "jsx-attr" | "return";
  /** Callee text (call / new) or assignment target text (assign). */
  target?: RegExp;
  /** Receivers to exclude (e.g. `regex.exec`). */
  notTarget?: RegExp;
  /** Argument indexes to check; default: all. "query" = first argument that is not a Go context. */
  args?: number[] | "query";
  when: SinkWhen;
  /** Dynamic-only matches must have literal text matching this (e.g. SQL keywords). */
  literalRe?: RegExp;
  /** Keyword argument / option that must be present: `shell=True`, `{shell: true}`. */
  requireOption?: { name: string; value: RegExp };
  /** Keyword argument / option whose presence makes the call safe: `Loader=SafeLoader`. */
  safeOption?: { name: string; value: RegExp };
  /** Only flag when the whole file lacks this (e.g. XXE hardening calls). */
  fileLacks?: RegExp;
  title: string;
}

const SQL_TEXT =
  /\b(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|INTO|VALUES|ORDER\s+BY|GROUP\s+BY|JOIN|LIKE|UNION)\b|=\s*['"]?\s*$/i;
const HTML_TEXT = /<\s*\/?\s*[a-z!]/i;
const ANY = /.*/;

export const SINKS: SinkSpec[] = [
  // ─── CWE-89 SQL injection ────────────────────────────────────────────────
  {
    id: "sql-call",
    cwe: "CWE-89",
    families: ["js"],
    kind: "call",
    target: /(?:^|\.)(?:query|execute|raw|whereRaw|orderByRaw|havingRaw|joinRaw|\$queryRawUnsafe|\$executeRawUnsafe|queryRawUnsafe|executeRawUnsafe)$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: SQL_TEXT,
    title: "SQL query built from dynamic input",
  },
  {
    id: "sql-call",
    cwe: "CWE-89",
    families: ["py"],
    kind: "call",
    target: /(?:^|\.)(?:execute|executemany|executescript|raw|extra|mogrify|read_sql|read_sql_query|text)$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: SQL_TEXT,
    title: "SQL query built from dynamic input",
  },
  {
    id: "sql-call",
    cwe: "CWE-89",
    families: ["java"],
    kind: "call",
    target: /(?:^|\.)(?:executeQuery|executeUpdate|executeLargeUpdate|execute|addBatch|prepareStatement|prepareCall|createQuery|createNativeQuery|createSQLQuery|queryForObject|queryForList|queryForMap|queryForRowSet|query|update|batchUpdate)$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: SQL_TEXT,
    title: "SQL query built from dynamic input",
  },
  {
    id: "sql-call",
    cwe: "CWE-89",
    families: ["go"],
    kind: "call",
    target: /\.(?:Query|QueryRow|QueryContext|QueryRowContext|Exec|ExecContext|Prepare|PrepareContext|Raw|Where|Order|Having|Joins|MustExec|Queryx|QueryRowx|NamedExec)$/,
    args: "query",
    when: "tainted-or-dynamic",
    literalRe: SQL_TEXT,
    title: "SQL query built from dynamic input",
  },

  // ─── CWE-79 Cross-site scripting ─────────────────────────────────────────
  {
    id: "xss-dom-assign",
    cwe: "CWE-79",
    families: ["js"],
    kind: "assign",
    target: /\.(?:innerHTML|outerHTML)$/,
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "HTML built from dynamic input assigned to innerHTML",
  },
  {
    id: "xss-dom-call",
    cwe: "CWE-79",
    families: ["js"],
    kind: "call",
    target: /^document\.(?:write|writeln)$|\.insertAdjacentHTML$|^\$\(.*\)\.(?:html|append|prepend|after|before)$|^jQuery\(.*\)\.html$/,
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "HTML built from dynamic input written to the DOM",
  },
  {
    id: "xss-react",
    cwe: "CWE-79",
    families: ["js"],
    kind: "jsx-attr",
    target: /^dangerouslySetInnerHTML$/,
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "dangerouslySetInnerHTML with a dynamic value",
  },
  {
    id: "xss-response",
    cwe: "CWE-79",
    families: ["js"],
    kind: "call",
    target: /^(?:res|response|reply|ctx)\.(?:send|write|end)$/,
    args: [0],
    when: "tainted",
    title: "Request input reflected into an HTTP response",
  },
  {
    id: "xss-template",
    cwe: "CWE-79",
    families: ["py"],
    kind: "call",
    target: /^(?:render_template_string|Markup|mark_safe|SafeString|markupsafe\.Markup|jinja2\.Template|Template)$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Unescaped HTML / template built from dynamic input",
  },
  {
    id: "xss-response",
    cwe: "CWE-79",
    families: ["py"],
    kind: "call",
    target: /^(?:make_response|HttpResponse|Response)$/,
    args: [0],
    when: "tainted",
    title: "Request input reflected into an HTTP response",
  },
  {
    id: "xss-return-html",
    cwe: "CWE-79",
    families: ["py"],
    kind: "return",
    when: "tainted",
    literalRe: HTML_TEXT,
    title: "Handler returns HTML containing request input",
  },
  {
    id: "xss-response",
    cwe: "CWE-79",
    families: ["java"],
    kind: "call",
    target: /(?:getWriter\(\)|getOutputStream\(\)|\bout|\bwriter|\bpw)\.(?:print|println|write|printf|format|append)$/,
    when: "tainted",
    title: "Request input written to the HTTP response",
  },
  {
    id: "xss-response",
    cwe: "CWE-79",
    families: ["go"],
    kind: "call",
    target: /^(?:fmt\.Fprintf|fmt\.Fprint|fmt\.Fprintln|io\.WriteString|w\.Write|w\.WriteString)$/,
    when: "tainted",
    title: "Request input written to the HTTP response",
  },
  {
    id: "xss-template-html",
    cwe: "CWE-79",
    families: ["go"],
    kind: "call",
    target: /^template\.(?:HTML|JS|HTMLAttr|URL)$/,
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Dynamic value marked as trusted HTML (template.HTML)",
  },

  // ─── CWE-22 Path traversal ───────────────────────────────────────────────
  {
    id: "path-fs",
    cwe: "CWE-22",
    families: ["js"],
    kind: "call",
    target: /(?:^|\.)(?:readFile|readFileSync|createReadStream|createWriteStream|writeFile|writeFileSync|appendFile|appendFileSync|unlink|unlinkSync|rm|rmSync|readdir|readdirSync|open|openSync|sendFile|download|copyFile|rename)$/,
    notTarget: /^(?:window|document)\./,
    args: [0],
    when: "tainted",
    title: "Request input used as a filesystem path",
  },
  {
    id: "path-fs",
    cwe: "CWE-22",
    families: ["py"],
    kind: "call",
    target: /^(?:open|io\.open|codecs\.open|send_file|FileResponse|os\.remove|os\.unlink|os\.rmdir|os\.listdir|shutil\.\w+|Path|pathlib\.Path|os\.open)$/,
    args: [0],
    when: "tainted",
    title: "Request input used as a filesystem path",
  },
  {
    id: "path-fs",
    cwe: "CWE-22",
    families: ["java"],
    kind: "new",
    target: /^(?:File|FileInputStream|FileOutputStream|FileReader|FileWriter|RandomAccessFile)$/,
    when: "tainted",
    title: "Request input used as a filesystem path",
  },
  {
    id: "path-fs",
    cwe: "CWE-22",
    families: ["java"],
    kind: "call",
    target: /^(?:Paths\.get|Path\.of|Files\.\w+)$/,
    when: "tainted",
    title: "Request input used as a filesystem path",
  },
  {
    id: "path-fs",
    cwe: "CWE-22",
    families: ["go"],
    kind: "call",
    target: /^(?:os\.(?:Open|OpenFile|ReadFile|WriteFile|Create|Remove|RemoveAll|ReadDir)|ioutil\.(?:ReadFile|WriteFile|ReadDir)|http\.ServeFile|c\.File|c\.Attachment)$/,
    when: "tainted",
    title: "Request input used as a filesystem path",
  },

  // ─── CWE-78 OS command injection ─────────────────────────────────────────
  {
    id: "cmd-shell",
    cwe: "CWE-78",
    families: ["js"],
    kind: "call",
    target: /^(?:exec|execSync|(?:child_process|childProcess|cp|proc|shell)\.(?:exec|execSync))$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Shell command built from dynamic input",
  },
  {
    id: "cmd-shell-option",
    cwe: "CWE-78",
    families: ["js"],
    kind: "call",
    target: /(?:^|\.)(?:spawn|spawnSync|execFile|execFileSync)$/,
    requireOption: { name: "shell", value: /^true$/ },
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Command run through a shell with dynamic input",
  },
  {
    id: "cmd-spawn",
    cwe: "CWE-78",
    families: ["js"],
    kind: "call",
    target: /(?:^|\.)(?:spawn|spawnSync|execFile|execFileSync)$/,
    args: [0],
    when: "tainted",
    title: "Request input chooses the executable",
  },
  {
    id: "cmd-shell",
    cwe: "CWE-78",
    families: ["py"],
    kind: "call",
    target: /^(?:os\.system|os\.popen|subprocess\.getoutput|subprocess\.getstatusoutput|commands\.getoutput)$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Shell command built from dynamic input",
  },
  {
    id: "cmd-shell-option",
    cwe: "CWE-78",
    families: ["py"],
    kind: "call",
    target: /^subprocess\.(?:call|run|Popen|check_output|check_call)$/,
    args: [0],
    requireOption: { name: "shell", value: /^True$/ },
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Command run with shell=True and dynamic input",
  },
  {
    id: "cmd-exec",
    cwe: "CWE-78",
    families: ["java"],
    kind: "call",
    target: /(?:getRuntime\(\)|runtime|rt)\.exec$/,
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "OS command built from dynamic input",
  },
  {
    id: "cmd-exec",
    cwe: "CWE-78",
    families: ["java"],
    kind: "new",
    target: /^ProcessBuilder$/,
    when: "tainted",
    title: "Request input passed to ProcessBuilder",
  },
  {
    id: "cmd-exec",
    cwe: "CWE-78",
    families: ["go"],
    kind: "call",
    target: /^exec\.(?:Command|CommandContext)$/,
    when: "tainted",
    title: "Request input passed to exec.Command",
  },

  // ─── CWE-94 Code injection ───────────────────────────────────────────────
  {
    id: "code-eval",
    cwe: "CWE-94",
    families: ["js"],
    kind: "call",
    target: /^(?:eval|window\.eval|globalThis\.eval|vm\.runInNewContext|vm\.runInThisContext|vm\.runInContext|vm\.compileFunction)$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Dynamic code evaluated with eval / vm",
  },
  {
    id: "code-eval",
    cwe: "CWE-94",
    families: ["js"],
    kind: "new",
    target: /^(?:Function|vm\.Script|Script)$/,
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Code compiled from a dynamic string (new Function / vm.Script)",
  },
  {
    id: "code-timer-string",
    cwe: "CWE-94",
    families: ["js"],
    kind: "call",
    target: /^(?:setTimeout|setInterval|window\.setTimeout|window\.setInterval)$/,
    args: [0],
    when: "tainted",
    title: "Request input evaluated as a timer string",
  },
  {
    id: "code-eval",
    cwe: "CWE-94",
    families: ["py"],
    kind: "call",
    target: /^(?:eval|exec|compile|builtins\.eval|builtins\.exec)$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Dynamic code evaluated with eval / exec",
  },
  {
    id: "code-eval",
    cwe: "CWE-94",
    families: ["java"],
    kind: "call",
    target: /(?:engine|scriptEngine|ScriptEngine|getEngineByName\([^)]*\))\.eval$|\.parseExpression$/,
    args: [0],
    when: "tainted-or-dynamic",
    literalRe: ANY,
    title: "Dynamic script / expression evaluated",
  },

  // ─── CWE-502 Unsafe deserialization ──────────────────────────────────────
  {
    id: "deser",
    cwe: "CWE-502",
    families: ["py"],
    kind: "call",
    target: /^(?:pickle|cPickle|_pickle|dill|shelve|marshal|jsonpickle)\.(?:loads|load|open|decode|Unpickler)$|^yaml\.(?:unsafe_load|unsafe_load_all|full_load)$/,
    args: [0],
    when: "always",
    title: "Unsafe deserialization API",
  },
  {
    id: "deser-yaml",
    cwe: "CWE-502",
    families: ["py"],
    kind: "call",
    target: /^yaml\.(?:load|load_all)$/,
    args: [0],
    safeOption: { name: "Loader", value: /Safe|BaseLoader/ },
    when: "always",
    title: "yaml.load without a safe Loader",
  },
  {
    id: "deser",
    cwe: "CWE-502",
    families: ["java"],
    kind: "new",
    target: /^(?:ObjectInputStream|XMLDecoder)$/,
    when: "always",
    title: "Java native / XMLDecoder deserialization",
  },
  {
    id: "deser",
    cwe: "CWE-502",
    families: ["java"],
    kind: "call",
    target: /(?:xstream|xStream|XStream\(\))\.fromXML$|(?:yaml|new Yaml\(\))\.load$|\.enableDefaultTyping$|\.activateDefaultTyping$/,
    when: "always",
    title: "Unsafe deserialization API",
  },
  {
    id: "deser",
    cwe: "CWE-502",
    families: ["js"],
    kind: "call",
    target: /(?:^|\.)unserialize$|^(?:funcster|serialize)\.\w+$/,
    args: [0],
    when: "always",
    title: "Unsafe deserialization API (node-serialize style)",
  },

  // ─── CWE-918 Server-side request forgery ─────────────────────────────────
  {
    id: "ssrf",
    cwe: "CWE-918",
    families: ["js"],
    kind: "call",
    target: /^(?:fetch|axios|got|request|needle|superagent|undici\.request|axios\.(?:get|post|put|patch|delete|head|request)|got\.(?:get|post|put|patch|delete|stream)|https?\.(?:get|request)|superagent\.(?:get|post|put|delete)|request\.(?:get|post|put|delete))$/,
    args: [0],
    when: "tainted",
    title: "Request input chooses an outbound request URL",
  },
  {
    id: "ssrf",
    cwe: "CWE-918",
    families: ["py"],
    kind: "call",
    target: /^(?:requests|httpx|session|s|client)\.(?:get|post|put|patch|delete|head|options|request|stream)$|^(?:urlopen|urllib\.request\.urlopen|urllib2\.urlopen|request\.urlopen|http\.client\.HTTPConnection|aiohttp\.request)$/,
    when: "tainted",
    title: "Request input chooses an outbound request URL",
  },
  {
    id: "ssrf",
    cwe: "CWE-918",
    families: ["java"],
    kind: "new",
    target: /^(?:URL|java\.net\.URL|HttpGet|HttpPost|HttpPut|HttpDelete)$/,
    when: "tainted",
    title: "Request input chooses an outbound request URL",
  },
  {
    id: "ssrf",
    cwe: "CWE-918",
    families: ["java"],
    kind: "call",
    target: /^URI\.create$|\.(?:getForObject|getForEntity|postForObject|postForEntity|exchange)$|\.uri$/,
    args: [0],
    when: "tainted",
    title: "Request input chooses an outbound request URL",
  },
  {
    id: "ssrf",
    cwe: "CWE-918",
    families: ["go"],
    kind: "call",
    target: /^http\.(?:Get|Post|Head|PostForm|NewRequest|NewRequestWithContext)$|\.(?:Get|Post|Head)$/,
    notTarget: /^(?:r|req|request|c|ctx|q|query|values|params|m|cache|v|os|db|tx|rows)\.|\.(?:Header|URL|Query\(\)|Form|PostForm)\.Get$/,
    when: "tainted",
    title: "Request input chooses an outbound request URL",
  },

  // ─── CWE-611 XML external entities ───────────────────────────────────────
  {
    id: "xxe-factory",
    cwe: "CWE-611",
    families: ["java"],
    kind: "call",
    target: /^(?:DocumentBuilderFactory|SAXParserFactory|XMLInputFactory|TransformerFactory|SAXTransformerFactory|SchemaFactory|XMLReaderFactory)\.(?:newInstance|newFactory|newDefaultInstance|createXMLReader)$|^SAXReader$/,
    fileLacks: /disallow-doctype-decl|external-general-entities|FEATURE_SECURE_PROCESSING|SUPPORT_DTD|IS_SUPPORTING_EXTERNAL_ENTITIES|ACCESS_EXTERNAL_DTD|setExpandEntityReferences\s*\(\s*false/,
    when: "always",
    title: "XML parser created without disabling external entities",
  },
  {
    id: "xxe-parser",
    cwe: "CWE-611",
    families: ["py"],
    kind: "call",
    target: /^(?:etree\.XMLParser|lxml\.etree\.XMLParser|XMLParser)$/,
    requireOption: { name: "resolve_entities", value: /^True$/ },
    when: "always",
    title: "XML parser with entity resolution enabled",
  },
  {
    id: "xxe-sax",
    cwe: "CWE-611",
    families: ["py"],
    kind: "call",
    target: /\.setFeature$/,
    args: [0],
    literalRe: /external_ges|feature_external/,
    when: "always",
    title: "SAX parser with external entities enabled",
  },
  {
    id: "xxe-libxml",
    cwe: "CWE-611",
    families: ["js"],
    kind: "call",
    target: /(?:^|\.)(?:parseXml|parseXmlString|parseXmlAsync)$/,
    requireOption: { name: "noent", value: /^true$/ },
    when: "always",
    title: "libxmljs parse with entity substitution (noent: true)",
  },

  // ─── CWE-601 Open redirect ───────────────────────────────────────────────
  {
    id: "redirect",
    cwe: "CWE-601",
    families: ["js"],
    kind: "call",
    target: /^(?:res|response|reply|ctx)\.redirect$/,
    when: "tainted",
    title: "Request input used as a redirect target",
  },
  {
    id: "redirect-dom",
    cwe: "CWE-601",
    families: ["js"],
    kind: "assign",
    target: /^(?:window\.|document\.)?location(?:\.href)?$/,
    when: "tainted",
    title: "Request input used as a redirect target",
  },
  {
    id: "redirect",
    cwe: "CWE-601",
    families: ["py"],
    kind: "call",
    target: /^(?:redirect|HttpResponseRedirect|HttpResponsePermanentRedirect|RedirectResponse|flask\.redirect)$/,
    args: [0],
    when: "tainted",
    title: "Request input used as a redirect target",
  },
  {
    id: "redirect",
    cwe: "CWE-601",
    families: ["java"],
    kind: "call",
    target: /\.sendRedirect$/,
    when: "tainted",
    title: "Request input used as a redirect target",
  },
  {
    id: "redirect",
    cwe: "CWE-601",
    families: ["go"],
    kind: "call",
    target: /^(?:http\.Redirect|c\.Redirect)$/,
    when: "tainted",
    title: "Request input used as a redirect target",
  },
];

/** CWE-798: variable / key names that suggest a credential. */
export const SECRET_NAME =
  /(?:^|_|\b)(?:pass(?:word|wd)?|pwd|secret|api_?key|apikey|access_?key|secret_?key|private_?key|auth_?token|access_?token|client_?secret|token|credentials?)$/i;

/** Well-known credential formats — flagged wherever they appear in a literal. */
export const SECRET_FORMATS: Array<{ id: string; re: RegExp; title: string }> = [
  { id: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, title: "AWS access key ID in source" },
  { id: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, title: "GitHub token in source" },
  { id: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, title: "Slack token in source" },
  { id: "stripe-key", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/, title: "Stripe live secret key in source" },
  { id: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, title: "Private key in source" },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/, title: "Google API key in source" },
];

/** Literal values that are obviously not real secrets. */
export const SECRET_PLACEHOLDER =
  /^(?:|changeme|change_me|password|secret|xxx+|\*+|todo|example|test|dummy|none|null|placeholder|your[_-].*|<.*>|\$\{.*\}|%\(.*\)s|\{\{.*\}\})$/i;
