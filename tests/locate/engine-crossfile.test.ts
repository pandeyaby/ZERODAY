/**
 * Cross-file tracking: request input passed to a function imported from another
 * file is followed into that file, and the finding names where the input came from.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runRulesLocalization } from "../../src/locate/rules/index.ts";

function repo(files: Record<string, string>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-xf-"));
  for (const [r, b] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, r)), { recursive: true });
    fs.writeFileSync(path.join(d, r), b);
  }
  return d;
}

const CASES: Array<[label: string, cwe: string, files: Record<string, string>, expected: string[]]> = [
 ["js named import", "CWE-89", { "routes/users.js": `import { findUser } from "../db/queries";\nexport const h = (req, res) => findUser(req.query.name);\n`, "db/queries.js": `export function findUser(name) {\n  return db.query("SELECT * FROM users WHERE name = '" + name + "'");\n}\n` }, ["db/queries.js"]],
 ["js require namespace", "CWE-78", { "app.js": `const tools = require("./lib/tools");\napp.post("/p", (req, res) => { tools.ping(req.body.host); });\n`, "lib/tools.js": `const { exec } = require("child_process");\nfunction ping(host) { exec("ping -c1 " + host); }\nmodule.exports = { ping };\n` }, ["lib/tools.js"]],
 ["js import safe helper", "CWE-89", { "routes/users.js": `import { findUser } from "../db/queries";\nexport const h = (req, res) => findUser(req.query.name);\n`, "db/queries.js": `export function findUser(name) {\n  return db.query("SELECT * FROM users WHERE name = $1", [name]);\n}\n` }, []],
 ["py from import", "CWE-22", { "app/views.py": `from flask import request\nfrom app.storage import read_doc\n\n@app.route("/d")\ndef d():\n    return read_doc(request.args["name"])\n`, "app/storage.py": `def read_doc(name):\n    return open("/srv/docs/" + name).read()\n` }, ["app/storage.py"]],
 ["py module import", "CWE-78", { "app/views.py": `from flask import request\nfrom . import shell\n\ndef p():\n    shell.run(request.form["h"])\n`, "app/shell.py": `import os\n\ndef run(h):\n    os.system("ping " + h)\n` }, ["app/shell.py"]],
 ["go same package", "CWE-89", { "go.mod": "module example.com/app\n", "api/handler.go": `package api\nfunc H(w http.ResponseWriter, r *http.Request) { lookup(r.URL.Query().Get("id")) }\n`, "api/store.go": `package api\nfunc lookup(id string) { db.Query("SELECT * FROM t WHERE id = '" + id + "'") }\n` }, ["api/store.go"]],
 ["go internal package", "CWE-78", { "go.mod": "module example.com/app\n", "api/handler.go": `package api\nimport "example.com/app/internal/sh"\nfunc H(w http.ResponseWriter, r *http.Request) { sh.Run(r.FormValue("c")) }\n`, "internal/sh/sh.go": `package sh\nfunc Run(c string) { exec.Command("sh", "-c", c).Run() }\n` }, ["internal/sh/sh.go"]],
 ["java helper class", "CWE-89", { "src/Web.java": `class Web { void f(HttpServletRequest r) throws Exception { Dao.find(r.getParameter("id")); } }\n`, "src/Dao.java": `class Dao { static void find(String id) throws Exception { st.executeQuery("SELECT * FROM t WHERE id = '" + id + "'"); } }\n` }, ["src/Dao.java"]],
];

describe("rules engine — cross-file", () => {
  for (const [label, cwe, files, expected] of CASES) {
    it(`${label} → ${expected.length ? expected.join(", ") : "no findings"}`, async () => {
      const r = await runRulesLocalization({ kind: "cwe", id: cwe, cweId: cwe }, repo(files));
      const high = r.rankedFiles.filter((f) => /Request input/.test(f.evidence[0]?.note ?? ""));
      assert.deepEqual(high.map((f) => f.filePath), expected);
      for (const f of high) assert.match(f.evidence[0]!.note, /Request input from \S+ line \d+/);
    });
  }

  it("libxml2 entity flags are an XXE candidate", async () => {
    const r = await runRulesLocalization(
      { kind: "cwe", id: "CWE-611", cweId: "CWE-611" },
      repo({ "lib/xml.ts": "const option = libxml2.ParseOption.XML_PARSE_NOENT | libxml2.ParseOption.XML_PARSE_DTDLOAD;\n" }),
    );
    assert.deepEqual(r.rankedFiles.map((f) => f.filePath), ["lib/xml.ts"]);
  });
});
