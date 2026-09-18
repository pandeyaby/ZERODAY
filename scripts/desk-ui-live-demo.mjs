/**
 * Slow Live Antares Desk demo against a local completions host (default :8000).
 * Uses Validate live ≤60s when present; never starts RunPod.
 * Review before git push.
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
  showStep,
} from "./desk-ui-demo-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts", "desk-ui-demo");
fs.mkdirSync(OUT, { recursive: true });

const ENDPOINT =
  process.env.ZERODAY_LIVE_ENDPOINT || "http://127.0.0.1:8000/v1";
const MODEL =
  process.env.ZERODAY_LIVE_MODEL ||
  "/Users/abhinavpandey/Documents/GitHub/_zeroday-batch/antares-350m-official";
const REPO = process.env.ZERODAY_LIVE_REPO || "fixtures/locate/rules-sample";
const CWE = process.env.ZERODAY_LIVE_CWE || "CWE-89";

const log = [];
let doctorOk = false;
let locateOk = false;
let spendConfirmed = false;

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
  console.log(`pace pause=${PAUSE_MS} dwell=${DWELL_MS}`);
  console.log(`endpoint=${ENDPOINT} model=${MODEL}`);
  await page.goto(PLAY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="desk-console"]', { timeout: 30000 });

  await page.locator('[data-testid="live-brain-tab"]').click();
  await page.waitForSelector('[data-testid="live-brain-panel"]');
  await step(page, OUT, {
    title: "1 · Live brain (opt-in)",
    detail: "Completions endpoint you host — ZERODAY never auto-provisions pods",
    shotName: "live-01-panel.png",
  });

  const p350 = page.locator('[data-testid="preset-antares-350m-ollama"]');
  const p1b = page.locator('[data-testid="preset-antares-1b"]');
  if (await p350.count()) await p350.click();
  else if (await p1b.count()) await p1b.click();
  await sleep(DWELL_MS);

  await page.locator('[data-testid="live-endpoint"]').fill(ENDPOINT);
  await page.locator('[data-testid="live-model"]').fill(MODEL);

  const panel = page.locator('[data-testid="live-brain-panel"]');
  const labels = panel.locator("label");
  const n = await labels.count();
  for (let i = 0; i < n; i++) {
    const lab = labels.nth(i);
    const t = (await lab.innerText()).toLowerCase();
    const input = lab.locator("input").first();
    if ((await input.count()) === 0) continue;
    if (t.includes("repo")) await input.fill(REPO);
    if (t.includes("cwe")) await input.fill(CWE);
  }

  // loopback — remote ack should stay off
  const remote = page.locator('[data-testid="remote-inference-ack"]');
  if ((await remote.count()) && (await remote.isChecked())) await remote.uncheck();

  await step(page, OUT, {
    title: "2 · Point at local Antares",
    detail: `${ENDPOINT} · ${CWE} · ${REPO}`,
    shotName: "live-02-configured.png",
  });

  await page.locator('[data-testid="live-save"]').click();
  await sleep(PAUSE_MS);
  await step(page, OUT, {
    title: "3 · Save config",
    detail: "Persisted under .zeroday/ — secrets stay in env names only",
    shotName: "live-03-saved.png",
  });

  // Prefer Validate live ≤60s CTA when present
  const validate = page.locator('[data-testid="live-validate"]');
  if (await validate.count()) {
    await showStep(
      page,
      "4 · Validate live (≤60s)",
      "Doctor + fixture locate path — still needs spend confirm",
    );
    await sleep(PAUSE_MS);
    await validate.click();
    log.push("clicked live-validate");
  } else {
    await page.locator('[data-testid="live-doctor"]').click();
    log.push("clicked live-doctor");
  }

  await sleep(Math.max(8000, PAUSE_MS * 2));
  await step(page, OUT, {
    title: "5 · Doctor / validate",
    detail: "Wait for green checks before any spend confirm",
    shotName: "live-04-doctor.png",
    dwell: PAUSE_MS,
  });

  const blob = await page.locator('[data-testid="desk-console"]').innerText();
  doctorOk =
    /DOCTOR:\s*pass/i.test(blob) ||
    (/\bPASS\b/.test(blob) && !/ECONNREFUSED|FAIL/i.test(blob));
  log.push(doctorOk ? "doctor GREEN" : "doctor NOT green :: " + blob.slice(0, 500).replace(/\s+/g, " "));

  if (doctorOk) {
    // If validate already opened spend, use it; else open locate
    if (!(await page.locator('[data-testid="spend-banner"]').count())) {
      await page.locator('[data-testid="live-locate-open"]').click();
      await page.waitForSelector('[data-testid="spend-banner"]', { timeout: 15000 });
    }
    await step(page, OUT, {
      title: "6 · Spend confirm (human gate)",
      detail: "Explicit click required — localization only, never a PoC",
      shotName: "live-05-spend-banner.png",
    });
    await page.locator('[data-testid="spend-confirm"]').click();
    spendConfirmed = true;
    log.push("spend-confirm clicked");

    await showStep(page, "7 · Live locate running…", "Antares localizing CWE-89 on rules-sample");
    try {
      await page.waitForFunction(() => {
        const t = document.querySelector('[data-testid="desk-console"]')?.innerText || "";
        return (
          /src\/(search|index)\.js/i.test(t) ||
          (/Findings|Ranked/i.test(t) && /CWE-89/i.test(t)) ||
          /LiveEndpointError|ECONNREFUSED/i.test(t)
        );
      }, { timeout: 240000 });
    } catch {
      log.push("timeout waiting for live locate");
    }
    await sleep(PAUSE_MS + DWELL_MS);
    await step(page, OUT, {
      title: "8 · Live results",
      detail: "Ranked files + artifacts — needs_human still true",
      shotName: "live-06-locate-result.png",
      dwell: PAUSE_MS + DWELL_MS,
    });
    const after = await page.locator('[data-testid="desk-console"]').innerText();
    locateOk =
      (/Findings|Ranked|src\//i.test(after) && !/LiveEndpointError|ECONNREFUSED/i.test(after));
    log.push(locateOk ? "LIVE LOCATE SUCCESS" : "LIVE LOCATE FAIL/partial");
  } else {
    await shot(page, OUT, "live-05-doctor-blocked.png");
    log.push("skipped spend + locate");
  }
} catch (e) {
  log.push("EXCEPTION: " + (e?.stack || e));
  try {
    await shot(page, OUT, "live-99-error.png");
  } catch {}
}

const videoPath = await page.video()?.path();
await context.close();
await browser.close();

const finalVideo = path.join(OUT, "desk-console-live-antares-demo.webm");
if (videoPath && fs.existsSync(videoPath)) {
  fs.copyFileSync(videoPath, finalVideo);
  log.push(`video ${finalVideo} (${fs.statSync(finalVideo).size} bytes)`);
}

const summary = {
  pass: doctorOk && locateOk,
  doctorOk,
  locateOk,
  spendConfirmed,
  pace: { PAUSE_MS, DWELL_MS },
  endpoint: ENDPOINT,
  model: MODEL,
  video: finalVideo,
  runPod: false,
  log,
};
fs.writeFileSync(path.join(OUT, "live-journey-log.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(
  path.join(OUT, "LIVE_VALIDATION.md"),
  `# Live Antares Desk demo (local)\n\n**Pace:** pause ${PAUSE_MS}ms / dwell ${DWELL_MS}ms\n**Pass:** ${summary.pass}\n**Endpoint:** ${ENDPOINT}\n**Video:** \`${finalVideo}\`\n**RunPod:** no\n\n## Log\n\n${log.map((l) => `- ${l}`).join("\n")}\n`,
);
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 2);
