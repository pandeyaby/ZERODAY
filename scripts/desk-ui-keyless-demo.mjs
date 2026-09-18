/**
 * Slow, shareable keyless Desk Console demo (no spend / no live locate).
 * Pace: ZERODAY_DEMO_PACE=slow|fast (default slow). Review before git push.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAY_URL,
  PAUSE_MS,
  DWELL_MS,
  sleep,
  step,
  shot,
} from "./desk-ui-demo-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts", "desk-ui-demo");
fs.mkdirSync(OUT, { recursive: true });

const log = [];
let pass = true;
let locateOk = false;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

try {
  console.log(`pace pause=${PAUSE_MS} dwell=${DWELL_MS} url=${PLAY_URL}`);
  await page.goto(PLAY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="desk-console"]', { timeout: 30000 });
  await step(page, OUT, {
    title: "1 · Desk Console (keyless)",
    detail: "Hard limits: no PoC · localization ≠ exploitability · human in the loop",
    shotName: "01-hard-limits.png",
  });

  const body = await page.locator('[data-testid="desk-console"]').innerText();
  if (!/no PoC/i.test(body) || !/localization\s*≠\s*exploitability/i.test(body)) {
    pass = false;
    log.push("FAIL: hard-limits copy missing");
  } else log.push("hard-limits ok");

  const inv = page.getByRole("button", { name: /^inventory$/i });
  if (await inv.count()) {
    await inv.click();
    await step(page, OUT, {
      title: "2 · Enable checked-in fixture",
      detail: "Keyless path uses repo fixtures — no GPU, no HF token, $0",
      shotName: "02-fixture-checkbox.png",
    });
    const fixture = page.getByLabel(/Use checked-in fixture|checked-in fixture/i);
    if (await fixture.count()) {
      await fixture.check();
      log.push("fixture checked");
      await sleep(DWELL_MS);
    }
  }

  const rules = page.getByRole("button", { name: /locate --rules|rules/i }).first();
  await rules.click();
  await step(page, OUT, {
    title: "3 · Keyless locate — rules",
    detail: "Same desk shape as live Antares; brain is fixture/rules, not GPU",
    shotName: "03-rules-ready.png",
  });

  const run = page.getByRole("button", { name: /Run locate --rules|Run /i }).first();
  await run.click();
  log.push("clicked Run");
  await showWaiting(page);
  await page.waitForSelector("text=Results", { timeout: 90000 });
  await sleep(PAUSE_MS);
  const after = await page.locator('[data-testid="desk-console"]').innerText();
  locateOk = /Results/i.test(after) && (/Findings|ranked|needs_human/i.test(after));
  if (!locateOk) {
    pass = false;
    log.push("FAIL: no results panel");
  } else log.push("locate results ok");
  await step(page, OUT, {
    title: "4 · Results — ranked files + evidence",
    detail: "SARIF / reports stay local. Localization ≠ exploitability.",
    shotName: "04-locate-result.png",
    dwell: PAUSE_MS + DWELL_MS,
  });

  await page.locator('[data-testid="reports-panel-tab"]').click();
  await page.waitForSelector('[data-testid="reports-panel"]', { timeout: 20000 });
  await step(page, OUT, {
    title: "5 · Reports & cassettes",
    detail: "Browse prior runs without leaving the desk",
    shotName: "05-reports-panel.png",
  });

  await page.locator('[data-testid="live-brain-tab"]').click();
  await page.waitForSelector('[data-testid="live-brain-panel"]', { timeout: 20000 });
  await step(page, OUT, {
    title: "6 · Live brain (opt-in)",
    detail: "Shown for honesty — this keyless demo never confirms spend",
    shotName: "06-live-brain.png",
  });

  const openSpend = page.locator('[data-testid="live-locate-open"]');
  if (await openSpend.count() && (await openSpend.isEnabled())) {
    await openSpend.click();
    await sleep(PAUSE_MS);
    if (await page.locator('[data-testid="spend-banner"]').count()) {
      await step(page, OUT, {
        title: "7 · Spend banner — Cancel",
        detail: "Human must confirm cost. Demo cancels. No live locate.",
        shotName: "07-spend-banner.png",
      });
      await page.getByRole("button", { name: /^Cancel$/i }).click();
      await sleep(DWELL_MS);
      log.push("spend cancelled");
    }
  } else log.push("spend open skipped (disabled)");

  await page.getByRole("button", { name: /^FAQ$/i }).click();
  await page.waitForSelector('[data-testid="faq-panel"]', { timeout: 15000 });
  const faq = await page.locator('[data-testid="faq-panel"]').innerText();
  if (!/localization\s*≠\s*exploitability/i.test(faq)) {
    pass = false;
    log.push("FAIL: FAQ missing localization ≠ exploitability");
  } else log.push("FAQ ok");
  await step(page, OUT, {
    title: "8 · FAQ — hard limits",
    detail: "Same honesty as the product defaults",
    shotName: "09-faq.png",
  });

  const howto = page.getByRole("button", { name: /How orgs use this|orgs use/i });
  if (await howto.count()) {
    await howto.click();
    await sleep(PAUSE_MS);
    await step(page, OUT, {
      title: "9 · How orgs use this",
      detail: "Action / cassette / desk habit — still human-gated",
      shotName: "10-howto.png",
    });
  }

  await page.getByRole("button", { name: /Desk Console/i }).click();
  await page.waitForSelector('[data-testid="desk-console"]');
  await step(page, OUT, {
    title: "10 · Back to Desk",
    detail: "Keyless daily driver ready. Live Antares is a separate opt-in clip.",
    shotName: "11-back-desk.png",
  });
} catch (e) {
  pass = false;
  log.push("EXCEPTION: " + (e?.stack || e));
  try {
    await shot(page, OUT, "99-error.png");
  } catch {}
}

async function showWaiting(page) {
  await page.evaluate(() => {
    const el = document.getElementById("zeroday-demo-step");
    if (el)
      el.innerHTML =
        '<div style="letter-spacing:0.04em;text-transform:uppercase;font-size:11px;color:#8eb6ff;margin-bottom:4px">ZERODAY Desk demo</div><div>Running keyless locate…</div><div style="margin-top:6px;font-weight:400;font-size:13px;color:#b7c4d8">Waiting for Results (fixture / rules — $0)</div>';
  });
}

const videoPath = await page.video()?.path();
await context.close();
await browser.close();

const finalVideo = path.join(OUT, "desk-console-keyless-demo.webm");
if (videoPath && fs.existsSync(videoPath)) {
  fs.copyFileSync(videoPath, finalVideo);
  log.push(`video ${finalVideo} (${fs.statSync(finalVideo).size} bytes)`);
}

const summary = {
  pass: pass && locateOk,
  locateOk,
  spendConfirmed: false,
  pace: { PAUSE_MS, DWELL_MS },
  video: finalVideo,
  log,
};
fs.writeFileSync(path.join(OUT, "keyless-journey-log.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(
  path.join(OUT, "KEYLESS_VALIDATION.md"),
  `# Keyless Desk demo\n\n**Pace:** pause ${PAUSE_MS}ms / dwell ${DWELL_MS}ms\n**Pass:** ${summary.pass}\n**Video:** \`${finalVideo}\`\n\nSpend confirm: never clicked.\n\n## Log\n\n${log.map((l) => `- ${l}`).join("\n")}\n`,
);
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 2);
