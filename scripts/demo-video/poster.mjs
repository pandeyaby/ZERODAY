import { chromium } from "playwright";
import path from "node:path";
const OUT = process.env.OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "zeroday-reports", "demo-video");
import fs from "node:fs";
const img = fs.readFileSync(path.join(OUT, "poster-src.png")).toString("base64");
const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.setContent(`<html><body style="margin:0;width:1280px;height:720px;position:relative;font-family:Inter,system-ui,sans-serif;overflow:hidden;background:#05080c">
<div style="position:absolute;left:0;right:0;top:0;height:128px;background:#05080c;border-bottom:1px solid #1f2b3a;padding:30px 56px;box-sizing:border-box;color:#e6edf3">
<div style="font-size:42px;font-weight:700;letter-spacing:.02em">ZERODAY <span style="color:#3ddc97">+ Antares-1B</span></div>
<div style="font-size:21px;color:#9fb0c6;margin-top:4px">3-minute demo · real runs on a RunPod A40 · no mocks</div></div>
<div style="position:absolute;left:0;top:128px;width:1280px;height:520px;overflow:hidden">
<img src="data:image/png;base64,${img}" style="position:absolute;left:0;top:-22px;width:1280px;height:720px"></div>
<div style="position:absolute;left:40px;top:545px;width:92px;height:92px;border-radius:50%;background:rgba(61,220,151,.96);box-shadow:0 10px 40px rgba(0,0,0,.6)">
<div style="position:absolute;left:35px;top:24px;width:0;height:0;border-top:22px solid transparent;border-bottom:22px solid transparent;border-left:34px solid #0b0f14"></div></div>
<div style="position:absolute;left:150px;top:568px;color:#e6edf3;font-size:26px;font-weight:600">Watch the demo <span style="color:#9fb0c6;font-weight:400;font-size:20px">— rules say NOT SCANNED; Antares ranks the fixed file first</span></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:72px;padding:0 56px;background:#05080c;border-top:1px solid #1f2b3a;color:#e6edf3;font-size:20px;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box">
<span>antares up → rules vs Antares on a real CVE → scan a repo → benchmark → antares down</span><span style="color:#3ddc97;font-weight:600">▶ 3:28</span></div>
</body></html>`);
await p.screenshot({ path: path.join(OUT, "zeroday-demo-poster.png") });
await b.close();
