/** Shared pacing + on-screen step labels for shareable Desk UI demos. */
export const PLAY_URL = process.env.ZERODAY_PLAY_URL || "http://127.0.0.1:3333/play";

/** slow (default): readable for humans. fast: old CI-ish pacing. */
const PACE = (process.env.ZERODAY_DEMO_PACE || "slow").toLowerCase();
export const PAUSE_MS = Number(
  process.env.ZERODAY_PAUSE_MS || (PACE === "fast" ? 1200 : 4200),
);
export const DWELL_MS = Number(
  process.env.ZERODAY_DWELL_MS || (PACE === "fast" ? 800 : 2800),
);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Persistent bottom banner so viewers know which step they're watching. */
export async function showStep(page, title, detail = "") {
  await page.evaluate(
    ({ title, detail }) => {
      let el = document.getElementById("zeroday-demo-step");
      if (!el) {
        el = document.createElement("div");
        el.id = "zeroday-demo-step";
        el.setAttribute(
          "style",
          [
            "position:fixed","left:16px","right:16px","bottom:16px","z-index:2147483647",
            "background:rgba(8,12,18,0.92)","color:#e8f0ff","border:1px solid #3d8bfd",
            "border-radius:12px","padding:14px 18px","font:600 16px/1.35 ui-sans-serif,system-ui",
            "box-shadow:0 8px 28px rgba(0,0,0,0.45)","pointer-events:none",
          ].join(";"),
        );
        document.body.appendChild(el);
      }
      el.innerHTML = `<div style="letter-spacing:0.04em;text-transform:uppercase;font-size:11px;color:#8eb6ff;margin-bottom:4px">ZERODAY Desk demo</div><div>${title}</div>${
        detail
          ? `<div style="margin-top:6px;font-weight:400;font-size:13px;color:#b7c4d8">${detail}</div>`
          : ""
      }`;
    },
    { title, detail },
  );
}

export async function shot(page, outDir, name) {
  const p = `${outDir}/${name}`;
  await page.screenshot({ path: p, fullPage: true });
  console.log("screenshot:", p);
  return p;
}

export async function step(page, outDir, { title, detail, shotName, dwell }) {
  await showStep(page, title, detail);
  await sleep(PAUSE_MS);
  if (shotName) await shot(page, outDir, shotName);
  await sleep(dwell ?? DWELL_MS);
}
