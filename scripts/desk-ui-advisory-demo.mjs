/**
 * Desk UI walkthrough for docs/demo.md: advisory → exposure → ranked files, then
 * a CWE scan. Screenshots only (no video). Start the Desk first:
 *
 *   ZERODAY_OSV_DIR=fixtures/advisories/osv npm run dev
 *   node scripts/desk-ui-advisory-demo.mjs
 *
 * ZERODAY_DEMO_REPO / ZERODAY_DEMO_CWE pick the second scan (default: the bundled
 * rules sample, CWE-89). A repo outside this checkout needs ZERODAY_UI_ROOTS.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAY_URL } from "./desk-ui-demo-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.ZERODAY_DEMO_OUT || path.join(ROOT, "artifacts", "desk-ui-demo");
const SECOND_REPO = process.env.ZERODAY_DEMO_REPO || "fixtures/locate/rules-sample";
const SECOND_CWE = process.env.ZERODAY_DEMO_CWE || "CWE-89";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const results = [];

async function scan(repo, advisory, shotName) {
  await page.getByPlaceholder("CWE-89").fill(advisory);
  await page.getByPlaceholder("fixtures/locate/rules-sample").first().fill(repo);
  const list = page.locator('[data-testid="desk-ranked-files"]');
  const before = (await list.count()) ? await list.evaluate((el) => el.textContent) : null;
  await page.getByRole("button", { name: /Run locate --rules/i }).click();
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector('[data-testid="desk-ranked-files"]');
      return !!el && el.textContent !== prev;
    },
    before,
    { timeout: 90_000 },
  );
  await list.scrollIntoViewIfNeeded();
  const text = await list.innerText();
  await page.screenshot({ path: path.join(OUT, shotName), fullPage: true });
  results.push({ repo, advisory, shot: shotName, firstFinding: text.split("\n")[0] });
  return text;
}

let ok = true;
try {
  await page.goto(PLAY_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector('[data-testid="desk-console"]', { timeout: 30_000 });
  await page.screenshot({ path: path.join(OUT, "demo-01-desk.png") });

  const adv = await scan("fixtures/advisory/npm-lodash", "CVE-2021-23337", "demo-02-advisory.png");
  const exposure = await page.locator('[data-testid="desk-exposure"]').innerText();
  ok &&= /affected/i.test(exposure) && /4\.17\.21/.test(exposure) && /^1\. src\/email\.js/m.test(adv);

  const cwe = await scan(SECOND_REPO, SECOND_CWE, "demo-03-cwe.png");
  ok &&= cwe.trim().length > 0;
} catch (e) {
  ok = false;
  results.push({ error: String(e) });
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok, out: OUT, results }, null, 2));
process.exit(ok ? 0 : 1);
