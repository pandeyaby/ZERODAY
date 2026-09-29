// ZERODAY demo video (silent capture). Needs the Desk on :3333 (npm run play). Terminal scenes replay real transcripts from the
// 2026-09-28 RunPod A40 recording session; scene offsets → timeline.json for muxing.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.env.OUT ?? path.join(DIR, "..", "..", "zeroday-reports", "demo-video");
const N = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(OUT, "narration.json"), "utf8")).map((n) => [n.id, n]));
const T = (f) => fs.readFileSync(path.join(DIR, f), "utf8").trimEnd().split("\n");
const DESK = "http://127.0.0.1:3333/play";
const W = 1280, H = 720;

const pretty = (s) =>
  s.replace(/C V E 2021 23337/g, "CVE-2021-23337").replace(/C W E 287/g, "CWE-287").replace(/C W E/g, "CWE").replace(/C V E/g, "CVE")
    .replace(/G P U/g, "GPU").replace(/O S V/g, "OSV").replace(/Foundation A I/g, "Foundation AI")
    .replace(/email dot j s/g, "email.js").replace(/cart dot j s/g, "cart.js").replace(/basic auth dot go/g, "basic_auth.go")
    .replace(/Antares one B/g, "Antares-1B").replace(/antares up/g, "antares up").replace(/one billion parameter/g, "1-billion-parameter")
    .replace(/fifty cents/g, "$0.50").replace(/53 cents/g, "$0.53").replace(/(\d+) percent/g, "$1%")
    .replace(/pandeyaby slash ZERODAY/g, "github.com/pandeyaby/ZERODAY").replace(/Apache 2/g, "Apache-2.0");

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
const page = await context.newPage();
const t0 = Date.now();
const timeline = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const CSS = `
  *{box-sizing:border-box} body{margin:0;background:#0b0f14;color:#e6edf3;font-family:Inter,ui-sans-serif,system-ui,sans-serif;height:100vh;overflow:hidden}
  .card{height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 110px 90px}
  .kicker{color:#3ddc97;letter-spacing:.25em;font-size:15px;text-transform:uppercase;margin-bottom:18px}
  h1{font-size:64px;margin:0 0 20px;letter-spacing:.02em} h2{font-size:40px;margin:0 0 26px;line-height:1.2}
  p,li{font-size:25px;line-height:1.5;color:#b7c4d8} ul{margin:0;padding-left:28px} li{margin:6px 0}
  .accent{color:#3ddc97} .warn{color:#f2c14e} .muted{color:#7d8a9c} code{font-family:ui-monospace,Menlo,monospace;color:#9ecbff}
  .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap} .box{border:1px solid #2b3a4d;background:#111925;border-radius:12px;padding:14px 16px;font-size:18px}
  .arrow{color:#3ddc97;font-size:24px}
  .tag{position:absolute;top:16px;right:70px;font:13px ui-monospace,Menlo,monospace;color:#7d8a9c}
  .term{position:relative;background:#05080c;border:1px solid #243244;border-radius:12px;margin:34px 50px 0;height:572px;padding:20px 26px;font:16px/1.45 ui-monospace,Menlo,monospace;white-space:pre;overflow:hidden}
  .term.big{font-size:17px}
  .term .l{opacity:0;transition:opacity .25s} .term .l.on{opacity:1} .hl{background:rgba(61,220,151,.16);outline:1px solid rgba(61,220,151,.5)} .hlw{background:rgba(242,193,78,.14);outline:1px solid rgba(242,193,78,.5)}
  .split{display:flex;gap:18px;margin:34px 40px 0}.split .term{margin:0;flex:1;height:572px;font-size:14px}
  .ptitle{font:600 14px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}
  table{border-collapse:collapse;font-size:21px;width:100%} th,td{padding:10px 14px;text-align:right;border-bottom:1px solid #1f2b3a} th:first-child,td:first-child{text-align:left}
  th{color:#7d8a9c;font-weight:500;font-size:16px;text-transform:uppercase;letter-spacing:.08em}
  .bar{display:inline-block;height:12px;border-radius:6px;background:#3ddc97;vertical-align:middle;margin-left:10px}
  tr.dim td{color:#8a97a8} tr.win td{color:#e6edf3;font-weight:600}
`;

async function captions(id) {
  await page.evaluate(
    ({ sents }) => {
      let el = document.getElementById("zd-cap");
      if (!el) {
        el = document.createElement("div");
        el.id = "zd-cap";
        el.setAttribute("style", "position:fixed;left:50%;transform:translateX(-50%);bottom:14px;max-width:1160px;width:calc(100% - 80px);z-index:2147483647;background:rgba(5,8,12,.9);color:#f0f4f8;border:1px solid rgba(61,220,151,.35);border-radius:10px;padding:9px 18px;font:500 19px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;text-align:center;pointer-events:none");
        document.body.appendChild(el);
      }
      if (window.__zdCapTimer) clearTimeout(window.__zdCapTimer);
      let i = 0;
      const next = () => {
        if (i >= sents.length) return;
        el.textContent = sents[i].text;
        window.__zdCapTimer = setTimeout(next, sents[i].dur * 1000);
        i++;
      };
      next();
    },
    { sents: N[id].sents.map((s) => ({ text: pretty(s.text), dur: s.dur })) },
  );
}

async function scene(id) {
  timeline.push({ id, start: (Date.now() - t0) / 1000 });
  await captions(id);
  const end = Date.now() + N[id].dur * 1000 + 600;
  return async () => {
    const left = end - Date.now();
    if (left > 0) await sleep(left);
  };
}

async function card(html) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`);
}

/** Terminal pane markup: a typed command line plus hidden output lines (ids p-l<i>). */
const pane = (p, lines, cls = "", tag = "") =>
  `<div class="term ${cls}" id="${p}">${tag ? `<span class="tag">${esc(tag)}</span>` : ""}<span id="${p}-cmd" class="accent"></span>\n${lines.map((l, i) => `<span class="l" id="${p}-l${i}">${esc(l) || " "}</span>`).join("\n")}</div>`;

async function type(p, cmd, ms = 24) {
  for (let i = 1; i <= cmd.length; i++) {
    await page.evaluate(([p, s]) => (document.getElementById(p + "-cmd").textContent = s), [p, cmd.slice(0, i)]);
    await sleep(ms);
  }
}
async function reveal(p, lines, from = 0, to = lines.length, ms = 70) {
  for (let i = from; i < to; i++) {
    await page.evaluate((id) => document.getElementById(id).classList.add("on"), `${p}-l${i}`);
    await sleep(ms);
  }
}
const mark = (p, lines, re, cls = "hl") =>
  page.evaluate(([id, c]) => document.getElementById(id)?.classList.add(c), [`${p}-l${lines.findIndex((l) => re.test(l))}`, cls]);

// 1 · Title
await card(`<div class="card"><div class="kicker">Open source · Apache-2.0</div><h1>ZERODAY</h1><h2>An advisory just landed.<br><span class="accent">Which files in your code should a human read first?</span></h2><p class="muted">Static rules you can audit · plus Antares-1B for everything rules can't model</p></div>`);
await sleep(300);
let done = await scene("title"); await done();

// 2 · Problem
await card(`<div class="card"><div class="kicker">The problem</div><h2>A CVE drops in a library you depend on.</h2>
<ul><li><b>Are we exposed?</b> <span class="muted">— scanners answer with a wall of alerts</span></li><li><b>Where in our code do we look?</b> <span class="muted">— usually nobody answers</span></li></ul>
<p style="margin-top:30px">ZERODAY answers both — <span class="accent">on your own machine.</span></p></div>`);
done = await scene("problem"); await done();

// 3 · CLI — lodash (captured with ZERODAY 0.10.0)
const L = T("t_lodash.txt");
await card(pane("a", L, "big", "rules · no model · real run"));
done = await scene("cli1");
await type("a", "$ zeroday locate --cve CVE-2021-23337 --repo fixtures/advisory/npm-lodash --rules");
await sleep(400);
await reveal("a", L, 0, L.length, 90);
await sleep(2500);
await mark("a", L, /^Exposure/, "hlw");
await mark("a", L, /lodash@4\.17\.15\s+package-lock/, "hlw");
await done();
done = await scene("cli2");
await mark("a", L, /1\. src\/email\.js/);
await sleep(3500);
await mark("a", L, /3\. src\/cart\.js/);
await done();

// 4 · Desk
await page.goto(DESK, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="desk-console"]');
await page.evaluate(() => window.scrollTo(0, 330));
done = await scene("desk");
const cwe = page.getByPlaceholder("CWE-89");
const repo = page.getByPlaceholder("fixtures/locate/rules-sample").first();
await cwe.fill(""); await cwe.type("CVE-2021-23337", { delay: 30 });
await repo.fill(""); await repo.type("fixtures/advisory/npm-lodash", { delay: 20 });
await page.getByRole("button", { name: /Run locate --rules/i }).click();
await page.locator('[data-testid="desk-ranked-files"]').waitFor({ timeout: 90_000 });
const y = await page.locator('[data-testid="desk-exposure"]').first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 150);
await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
await sleep(900);
await page.locator('[data-testid="desk-ranked-files"] li').first().evaluate((el) => (el.style.outline = "2px solid rgba(61,220,151,.7)"));
await done();

// 5 · The gap → Antares
await card(`<div class="card"><div class="kicker">Where rules stop</div><h2>Rules know 10 weakness types.<br><span class="muted" style="font-size:30px">Missing authorization · broken authentication · ReDoS · prototype pollution… nothing to pattern-match.</span></h2>
<div class="row" style="margin-top:14px"><div class="box"><b class="accent">Antares-1B</b><br><span class="muted">Foundation AI's open security model</span></div><span class="arrow">+</span>
<div class="box">explores the repo with tools<br><span class="muted">list · grep · read, like an analyst</span></div><span class="arrow">→</span>
<div class="box">names the files that matter<br><span class="muted">compared with the rules, agreement marked</span></div></div></div>`);
done = await scene("gap"); await done();

// 6 · antares up (real output, pod 8kdejcznx45ypw)
const U = T("t_up.txt");
await card(pane("u", U, "", "real run · 2026-09-28 · RunPod A40"));
done = await scene("up");
await type("u", "$ zeroday antares up --max-minutes 120 --yes");
await sleep(300);
await reveal("u", U, 0, 8, 110);
await sleep(1200);
await reveal("u", U, 8, 10, 700);
await sleep(900);
await reveal("u", U, 10, U.length, 120);
await mark("u", U, /^Antares is up/);
await sleep(2500);
await mark("u", U, /Typical rate/, "hlw");
await done();

// 7 · Traefik CWE-287 — rules vs Antares, side by side (real runs)
const R = T("t_trrules.txt"), A = T("t_trlive.txt");
await card(`<div class="split"><div style="flex:1;display:flex;flex-direction:column"><div class="ptitle muted">Rules only</div>${pane("r", R)}</div>
<div style="flex:1.25;display:flex;flex-direction:column"><div class="ptitle accent">Antares-1B · --samples 2</div>${pane("v", A)}</div></div>`);
done = await scene("traefik");
await type("r", "$ zeroday locate --cwe CWE-287 --rules", 18);
await reveal("r", R, 0, R.length, 90);
await mark("r", R, /^NOT SCANNED/, "hlw");
await sleep(4500);
await type("v", "$ zeroday locate --cwe CWE-287 --live", 18);
await reveal("v", A, 0, A.length, 110);
await mark("v", A, /^Explored/);
await sleep(2200);
await mark("v", A, /1\. pkg\/middlewares\/auth\/basic_auth\.go/);
await page.evaluate(() => {
  const d = document.createElement("div");
  d.setAttribute("style", "position:absolute;right:60px;top:430px;font:600 16px Inter,sans-serif;color:#0b0f14;background:#3ddc97;border-radius:8px;padding:6px 12px");
  d.textContent = "✓ the file the real fix changed";
  document.body.appendChild(d);
});
await done();

// 8 · Scan Juice Shop (real run)
const S = T("t_scan.txt");
await card(pane("s", S, "", "real run · OWASP Juice Shop · 1:00"));
done = await scene("scan");
await type("s", "$ zeroday scan --repo juice-shop");
await reveal("s", S, 0, S.length, 80);
await mark("s", S, /^Antares/);
await sleep(2500);
for (const re of [/1\. lib\/insecurity/, /2\. routes\/redirect/, /3\. routes\/userProfile/]) await mark("s", S, re);
await done();

// 9 · Benchmark (bench/antares/results/results.json, docs/antares-benchmark.md)
const bar = (v) => `<span class="bar" style="width:${v * 5}px"></span>`;
await card(`<div class="card" style="padding:0 90px 90px"><div class="kicker">Measured on real advisories</div>
<h2 style="font-size:30px;margin-bottom:8px">36 GitHub-reviewed advisories · 12 weakness types · published Jun–Sep 2026</h2>
<p class="muted" style="font-size:18px;margin:0 0 18px">Vulnerable snapshot (fix commit's parent) · every arm gets only the CWE · hit = a file the real fix changed</p>
<table><tr><th>Arm</th><th>Fixed file ranked #1</th><th>In top 3</th></tr>
<tr class="dim" id="b1"><td>ZERODAY rules alone</td><td>14% ${bar(14)}</td><td>19%</td></tr>
<tr class="dim" id="b2"><td>Antares-1B, one run</td><td>25% ${bar(25)}</td><td>32%</td></tr>
<tr class="win" id="b3"><td>Antares-1B, 2 runs merged (default)</td><td>36% ${bar(36)}</td><td>42%</td></tr>
<tr id="b4"><td>…on the 4 CWEs rules can't model</td><td>25% ${bar(25)}</td><td>25% <span class="muted" style="font-size:15px">rules: 0%</span></td></tr></table>
<p class="muted" style="font-size:17px;margin-top:16px">Reproduce: <code>npm run bench:antares</code> · full table in docs/antares-benchmark.md</p></div>`);
await page.evaluate(() => ["b1", "b2", "b3", "b4"].forEach((id) => (document.getElementById(id).style.opacity = 0)));
done = await scene("bench");
await sleep(9500);
for (const [id, ms] of [["b1", 4200], ["b2", 2600], ["b3", 4600], ["b4", 0]]) {
  await page.evaluate((id) => { const e = document.getElementById(id); e.style.transition = "opacity .5s"; e.style.opacity = 1; }, id);
  await sleep(ms);
}
await done();

// 10 · antares down (real output)
const Dn = T("t_down.txt");
await card(pane("d", Dn, "big", "real run · 65 minutes incl. the full benchmark"));
done = await scene("down");
await type("d", "$ zeroday antares down");
await sleep(500);
await reveal("d", Dn);
await mark("d", Dn, /deleted/);
await done();

// 11 · Limits
await card(`<div class="card"><div class="kicker">What it is not</div><h2>Localization, not proof.</h2>
<ul><li>Never writes exploits or PoCs · never auto-merges · a human decides</li>
<li>A 1B model misses often — every answer is a <b>candidate</b>, with hashed evidence (<code>zeroday verify</code>)</li>
<li>Your code goes only to the pod <i>you</i> start · keys never saved · Desk answers on localhost only</li></ul></div>`);
done = await scene("limits"); await done();

// 12 · Close
await card(`<div class="card"><div class="kicker">Try it</div><h1>ZERODAY</h1><p style="font-size:30px"><code>github.com/pandeyaby/ZERODAY</code></p>
<p style="font-size:22px"><code>npm run zeroday -- antares up</code> → <code>scan --repo .</code> → <code>antares down</code></p>
<p class="muted">Apache-2.0 · not a Cisco product · Antares-1B by Foundation AI · localization ≠ exploitability</p></div>`);
done = await scene("close"); await done();
await sleep(800);

const total = (Date.now() - t0) / 1000;
const video = page.video();
await context.close();
await browser.close();
const webm = await video.path();
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ webm, total, timeline }, null, 1));
console.log(JSON.stringify({ webm, total: Math.round(total), scenes: timeline.map((t) => `${t.id}@${t.start.toFixed(1)}`) }));
