import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
const BASE = "http://localhost:5173/", OUT = "e2e/recordings";
const SIZE = { width: 3840, height: 2160 };  // 4K recording for crisp punch-ins
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--high-dpi-support=1", "--force-device-scale-factor=2"] });
const settle = async (p) => { await p.evaluate(() => document.fonts?.ready); await p.waitForTimeout(400); };
const scrollTo = async (p, t, ms = 1300) => { await p.evaluate((t) => { const e = [...document.querySelectorAll("h2,h3")].find(e => e.textContent?.includes(t)); window.scrollTo({ top: e ? e.getBoundingClientRect().top + window.scrollY - 90 : 0, behavior: "smooth" }); }, t); await p.waitForTimeout(ms); };
async function take(id, fn) {
  // viewport 1920x1080 @ deviceScaleFactor 2 => renders at 3840x2160; recordVideo captures 4K
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: SIZE } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" }); await settle(p); await p.waitForTimeout(700);
  await fn(p); await p.waitForTimeout(400);
  const v = p.video(); await ctx.close(); renameSync(await v.path(), join(OUT, `${id}.webm`)); console.log("saved", id);
}
// c2_loop: scroll to loop, run, watch resolve, dwell
await take("c2_loop", async (p) => {
  await scrollTo(p, "Live commit loop", 1500);
  await p.locator("button", { hasText: /Run ClarityLoop/i }).click();
  await p.waitForSelector("text=CLEAR TO COMMIT", { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(30000);
});
// c3_promotion: scroll to promotion, dwell
await take("c3_promotion", async (p) => { await scrollTo(p, "Improvement & promotion", 1500); await p.waitForTimeout(26000); });
// usage: hero -> run -> scroll tour (for the status-bar close-up + context)
await take("usage", async (p) => {
  await p.waitForSelector("text=Deterministic code"); await p.waitForTimeout(2000);
  await scrollTo(p, "Live commit loop", 1400);
  await p.locator("button", { hasText: /Run ClarityLoop/i }).click();
  await p.waitForSelector("text=CLEAR TO COMMIT", { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(3000);
  await scrollTo(p, "Different axis from HarnessX", 1500); await p.waitForTimeout(3000);
});
await browser.close(); console.log("done");
