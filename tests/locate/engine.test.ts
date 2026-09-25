/**
 * Tree-sitter rules engine: request input → sink tracking across JS/TS, Python,
 * Java and Go. Each case lists the CWEs that must fire ([] = must stay silent).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeSource } from "../../src/locate/engine/analyze.ts";
import type { LangId } from "../../src/locate/engine/grammar.ts";
import { RULES_SUPPORTED_CWES } from "../../src/locate/rules/index.ts";

const ALL = new Set<string>(RULES_SUPPORTED_CWES);

const CASES: Array<[label: string, lang: LangId, code: string, expected: string[]]> = [
  ["js sqli taint", "javascript", `app.get('/u', (req, res) => { const {name} = req.query; const q = "SELECT * FROM u WHERE n='" + name + "'"; db.query(q); });`, ["CWE-89"]],
  ["js sqli param-safe", "javascript", `app.get('/u', (req, res) => { db.query("SELECT * FROM u WHERE n=$1", [req.query.name]); });`, []],
  ["js sqli helper dynamic", "javascript", `function find(name){ return db.query(\`SELECT * FROM users WHERE name = '\${name}'\`); }`, ["CWE-89"]],
  ["js sqli parseInt safe", "javascript", `app.get('/u', (req,res)=>{ const id = parseInt(req.params.id); db.query("SELECT * FROM u WHERE id=" + id); });`, []],
  ["js xss innerHTML", "javascript", `el.innerHTML = "<b>" + location.hash + "</b>";`, ["CWE-79"]],
  ["js xss literal safe", "javascript", `el.innerHTML = "";`, []],
  ["js cmd", "javascript", `const { exec } = require('child_process'); app.post('/p', (req,res)=>{ exec("ping -c 1 " + req.body.host); });`, ["CWE-78"]],
  ["js regex exec safe", "javascript", `const m = /a(b)/.exec(req.query.s);`, []],
  ["js ssrf", "javascript", `app.get('/f', async (req,res)=>{ const r = await fetch(req.query.url); });`, ["CWE-918"]],
  ["js redirect", "javascript", `app.get('/r', (req,res)=> res.redirect(req.query.next));`, ["CWE-601"]],
  ["js eval", "javascript", `app.get('/e', (req,res)=>{ eval(req.query.code); });`, ["CWE-94"]],
  ["js path", "javascript", `app.get('/d', (req,res)=>{ res.sendFile(path.join(__dirname, 'files', req.query.f)); });`, ["CWE-22"]],
  ["js path basename safe", "javascript", `app.get('/d', (req,res)=>{ res.sendFile(path.join(dir, path.basename(req.query.f))); });`, []],
  ["js secret", "javascript", `const config = { password: "S3cr3tPass!" }; const apiKey = "AKIAIOSFODNN7EXAMPLE";`, ["CWE-798"]],
  ["js secret env safe", "javascript", `const password = process.env.DB_PASSWORD;`, []],
  ["tsx react", "tsx", `export const A = ({html}: {html: string}) => <div dangerouslySetInnerHTML={{__html: html}} />;`, ["CWE-79"]],
  ["py sqli fstring", "python", `@app.route("/u")\ndef u():\n    name = request.args.get("name")\n    cur.execute(f"SELECT * FROM u WHERE n = '{name}'")\n`, ["CWE-89"]],
  ["py sqli param safe", "python", `def u():\n    cur.execute("SELECT * FROM u WHERE n = %s", (request.args["n"],))\n`, []],
  ["py sqli percent", "python", `def u(n):\n    q = "SELECT * FROM u WHERE n = '%s'" % n\n    cur.execute(q)\n`, ["CWE-89"]],
  ["py cmd shell", "python", `def p():\n    subprocess.run("ping " + request.form["h"], shell=True)\n`, ["CWE-78"]],
  ["py cmd list safe", "python", `def p():\n    subprocess.run(["ping", request.form["h"]])\n`, []],
  ["py pickle", "python", `def l():\n    return pickle.loads(request.data)\n`, ["CWE-502"]],
  ["py yaml safe", "python", `x = yaml.load(data, Loader=yaml.SafeLoader)\n`, []],
  ["py xss return", "python", `@app.route("/h")\ndef h():\n    n = request.args.get("n")\n    return "<h1>Hello " + n + "</h1>"\n`, ["CWE-79"]],
  ["py ssrf", "python", `def f():\n    return requests.get(request.args["url"]).text\n`, ["CWE-918"]],
  ["py path", "python", `def f():\n    return open(os.path.join("/data", request.args["f"])).read()\n`, ["CWE-22"]],
  ["py redirect", "python", `def f():\n    return redirect(request.args.get("next"))\n`, ["CWE-601"]],
  ["py xxe", "python", `p = etree.XMLParser(resolve_entities=True)\n`, ["CWE-611"]],
  ["java sqli", "java", `class C { void f(HttpServletRequest request) throws Exception { String id = request.getParameter("id"); Statement st = conn.createStatement(); st.executeQuery("SELECT * FROM u WHERE id = '" + id + "'"); } }`, ["CWE-89"]],
  ["java sqli prepared safe", "java", `class C { void f(HttpServletRequest request) throws Exception { PreparedStatement ps = conn.prepareStatement("SELECT * FROM u WHERE id = ?"); ps.setString(1, request.getParameter("id")); ps.executeQuery(); } }`, []],
  ["java spring sqli", "java", `class C { @GetMapping("/u") List<U> f(@RequestParam String name) { return jdbc.query("SELECT * FROM u WHERE n='" + name + "'", mapper); } }`, ["CWE-89"]],
  ["java cmd", "java", `class C { void f(HttpServletRequest r) throws Exception { Runtime.getRuntime().exec("ping " + r.getParameter("h")); } }`, ["CWE-78"]],
  ["java deser", "java", `class C { Object f(InputStream in) throws Exception { return new ObjectInputStream(in).readObject(); } }`, ["CWE-502"]],
  ["java xxe", "java", `class C { void f() throws Exception { DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance(); dbf.newDocumentBuilder(); } }`, ["CWE-611"]],
  ["java xxe safe", "java", `class C { void f() throws Exception { DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance(); dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); } }`, []],
  ["java path", "java", `class C { void f(HttpServletRequest r) { File f = new File("/data/" + r.getParameter("f")); } }`, ["CWE-22"]],
  ["java redirect", "java", `class C { void f(HttpServletRequest r, HttpServletResponse resp) throws Exception { resp.sendRedirect(r.getParameter("next")); } }`, ["CWE-601"]],
  ["java xss", "java", `class C { void f(HttpServletRequest r, HttpServletResponse resp) throws Exception { resp.getWriter().println("<p>" + r.getParameter("q")); } }`, ["CWE-79"]],
  ["go sqli", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { id := r.URL.Query().Get("id"); rows, _ := db.Query("SELECT * FROM u WHERE id = '" + id + "'"); _ = rows }`, ["CWE-89"]],
  ["go sqli sprintf", "go", `package m\nfunc h(name string) { q := fmt.Sprintf("SELECT * FROM u WHERE n = '%s'", name); db.Query(q) }`, ["CWE-89"]],
  ["go sqli param safe", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { db.QueryContext(ctx, "SELECT * FROM u WHERE id = $1", r.URL.Query().Get("id")) }`, []],
  ["go cmd", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { exec.Command("sh", "-c", r.FormValue("cmd")).Run() }`, ["CWE-78"]],
  ["go ssrf", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { resp, _ := http.Get(r.URL.Query().Get("url")); _ = resp }`, ["CWE-918"]],
  ["go header get safe", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { v := r.Header.Get("X"); _ = v }`, []],
  ["go path", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { data, _ := os.ReadFile("/srv/" + r.URL.Query().Get("f")); w.Write(data) }`, ["CWE-22"]],
  ["go redirect", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, r.FormValue("next"), 302) }`, ["CWE-601"]],
  ["go xss", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "<h1>%s</h1>", r.URL.Query().Get("n")) }`, ["CWE-79"]],
  // ── value tracking added for the OWASP Benchmark / real-world pass ──
  ["java constant-true branch keeps constant", "java", `class A { void f(HttpServletRequest r) throws Exception { String p = r.getParameter("x"); String bar; int num = 86; if ((7 * 42) - num > 200) bar = "safe"; else bar = p; st.executeQuery("SELECT * FROM t WHERE a='" + bar + "'"); } }`, []],
  ["java unknown branch merges taint", "java", `class A { void f(HttpServletRequest r) throws Exception { String p = r.getParameter("x"); String bar = "safe"; if (p.length() > 3) bar = p; st.executeQuery("SELECT * FROM t WHERE a='" + bar + "'"); } }`, ["CWE-89"]],
  ["java ternary constant folds", "java", `class A { void f(HttpServletRequest r) throws Exception { String p = r.getParameter("x"); int num = 106; String bar = (7 * 18) + num > 200 ? "safe" : p; st.executeQuery("SELECT * FROM t WHERE a='" + bar + "'"); } }`, []],
  ["java switch on constant char", "java", `class A { void f(HttpServletRequest r) throws Exception { String p = r.getParameter("x"); String guess = "ABC"; char t = guess.charAt(1); String bar; switch (t) { case 'A': bar = p; break; case 'B': bar = "bob"; break; default: bar = p; } st.executeQuery("SELECT * FROM t WHERE a='" + bar + "'"); } }`, []],
  ["java list container taint", "java", `class A { void f(HttpServletRequest r) throws Exception { java.util.List<String> xs = new java.util.ArrayList<String>(); xs.add(r.getHeader("h")); String bar = xs.get(0); new java.io.File("/tmp/" + bar); } }`, ["CWE-22"]],
  ["java cookie loop", "java", `class A { void f(HttpServletRequest r) throws Exception { String p = ""; for (javax.servlet.http.Cookie c : r.getCookies()) { p = c.getValue(); } Runtime rt = Runtime.getRuntime(); rt.exec("echo " + p); } }`, ["CWE-78"]],
  ["java typed ProcessBuilder.command", "java", `class A { void f(HttpServletRequest r) throws Exception { java.util.List<String> a = new java.util.ArrayList<String>(); a.add("sh"); a.add(r.getParameter("c")); ProcessBuilder pb = new ProcessBuilder(); pb.command(a); } }`, ["CWE-78"]],
  ["java same-file helper returns constant", "java", `class A { void f(HttpServletRequest r) throws Exception { String bar = new Test().doSomething(r.getParameter("x")); st.executeQuery("SELECT * FROM t WHERE a='" + bar + "'"); } class Test { String doSomething(String p) { return "safe"; } } }`, []],
  ["java same-file helper passes through", "java", `class A { void f(HttpServletRequest r) throws Exception { String bar = new Test().doSomething(r.getParameter("x")); st.executeQuery("SELECT * FROM t WHERE a='" + bar + "'"); } class Test { String doSomething(String p) { return p + "!"; } } }`, ["CWE-89"]],
  ["java html-escape does not stop SQLi", "java", `class A { void f(HttpServletRequest r) throws Exception { String bar = org.springframework.web.util.HtmlUtils.htmlEscape(r.getParameter("x")); st.executeQuery("SELECT * FROM t WHERE a='" + bar + "'"); } }`, ["CWE-89"]],
  ["java html-escape stops XSS", "java", `class A { void f(HttpServletRequest r, HttpServletResponse resp) throws Exception { String bar = org.owasp.esapi.ESAPI.encoder().encodeForHTML(r.getParameter("x")); resp.getWriter().println(bar); } }`, []],
  ["py match on constant", "python", `def v():\n    p = request.form.get("x")\n    guess = "ABC"[1]\n    match guess:\n        case 'A':\n            bar = p\n        case 'B':\n            bar = 'bob'\n        case _:\n            bar = p\n    os.system("echo " + bar)\n`, []],
  ["py route returns input", "python", `@app.route("/x")\ndef v():\n    return f"hello {request.args.get('n')}"\n`, ["CWE-79"]],
  ["py route returns dict", "python", `@app.post("/add")\ndef v():\n    return {"n": request.form.get("n")}\n`, []],
  ["py type=int coercion", "python", `@app.route("/x")\ndef v():\n    n = request.args.get("n", type=int)\n    return f"<b>{n}</b>"\n`, []],
  ["py path guard with early exit", "python", `def v():\n    bar = request.args["f"]\n    if '../' in bar:\n        return "no"\n    return open("/data/" + bar).read()\n`, []],
  ["py redirect host guard", "python", `def v():\n    bar = request.args["next"]\n    url = urllib.parse.urlparse(bar)\n    if url.netloc not in ["example.com"]:\n        return "bad"\n    return redirect(bar)\n`, []],
  ["py empty check is not a guard", "python", `def v():\n    bar = request.args["f"]\n    if not bar:\n        return "no"\n    return open("/data/" + bar).read()\n`, ["CWE-22"]],
  ["js destructured handler params", "javascript", `router.get("/f", ({ params }, res) => { const file = params.file; res.sendFile(path.resolve("ftp/", file)); });`, ["CWE-22"]],
  ["js sink inside same-file helper", "javascript", `function send(file, res) { res.sendFile(path.resolve("ftp/", file)); }\napp.get("/f", (req, res) => { send(req.query.f, res); });`, ["CWE-22"]],
  ["js slice indices are not content", "javascript", `app.get("/u", (req, res) => { res.send("users " + names.slice(req.params.from, req.params.to).join(", ")); });`, []],
  ["js pinned host is not SSRF", "javascript", `app.get("/w", async (req, res) => { const r = await fetch("https://api.example.com/v1?q=" + req.query.q); });`, []],
  ["js relative redirect is not open", "javascript", `app.get("/p", (req, res) => res.redirect("/profile/" + req.query.id));`, []],
  ["go numeric formatting is safe", "go", `package m\nfunc h(w http.ResponseWriter, r *http.Request) { id, _ := strconv.Atoi(r.URL.Query().Get("id")); db.Query("SELECT * FROM t WHERE id = " + strconv.Itoa(id)) }`, []],
];

describe("rules engine — sources, sanitizers and sinks", () => {
  for (const [label, lang, code, expected] of CASES) {
    it(`${label} → ${expected.length ? expected.join(", ") : "no findings"}`, async () => {
      const hits = await analyzeSource(lang, code, ALL);
      assert.deepEqual([...new Set(hits.map((h) => h.cwe))].sort(), [...expected].sort());
    });
  }

  it("request input scores above merely dynamic values", async () => {
    const tainted = await analyzeSource(
      "javascript",
      `app.get("/", (req) => db.query("SELECT * FROM t WHERE a='" + req.query.a + "'"));`,
      new Set(["CWE-89"]),
    );
    const dynamic = await analyzeSource(
      "javascript",
      `function f(a) { return db.query("SELECT * FROM t WHERE a='" + a + "'"); }`,
      new Set(["CWE-89"]),
    );
    const best = (hs: typeof tainted) => Math.max(...hs.map((h) => h.score));
    assert.ok(best(tainted) > best(dynamic));
  });

  it("names the request-input line in the evidence note", async () => {
    const [hit] = await analyzeSource(
      "python",
      `def v():\n    q = request.args["q"]\n    os.system("grep " + q)\n`,
      new Set(["CWE-78"]),
    );
    assert.match(hit!.note, /line 2/);
  });

  it("only reports requested CWEs", async () => {
    const hits = await analyzeSource(
      "javascript",
      `app.get("/", (req, res) => { eval(req.query.c); res.redirect(req.query.n); });`,
      new Set(["CWE-601"]),
    );
    assert.deepEqual(hits.map((h) => h.cwe), ["CWE-601"]);
  });
});
