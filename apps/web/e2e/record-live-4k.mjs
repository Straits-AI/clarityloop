import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
const BASE = "http://localhost:5173/", OUT = "e2e/recordings", SIZE = { width: 3840, height: 2160 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--high-dpi-support=1", "--force-device-scale-factor=2"] });
const settle = async (p) => { await p.evaluate(() => document.fonts?.ready); await p.waitForTimeout(500); };
const scrollTo = async (p, t, ms = 1200) => { await p.evaluate((t) => { const e = [...document.querySelectorAll("h2,h3")].find(e => e.textContent?.includes(t)); window.scrollTo({ top: e ? e.getBoundingClientRect().top + window.scrollY - 80 : 0, behavior: "smooth" }); }, t); await p.waitForTimeout(ms); };
async function take(id, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: SIZE } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" }); await settle(p); await p.waitForTimeout(600);
  await fn(p); await p.waitForTimeout(400);
  const v = p.video(); await ctx.close(); renameSync(await v.path(), join(OUT, `${id}.webm`)); console.log("saved", id);
}
async function liveRun(p, caseLabel, verdictText) {
  await scrollTo(p, "Live commit loop", 1400);
  await p.locator("button", { hasText: new RegExp(caseLabel, "i") }).click();   // select case
  await p.waitForTimeout(900);
  await p.locator("button", { hasText: /Run ClarityLoop/i }).click();           // real run
  await p.waitForSelector(`text=${verdictText}`, { timeout: 70000 }).catch(() => {});
  await p.waitForTimeout(7000);                                                  // dwell on result
}
await take("live_commit", async (p) => { await liveRun(p, "Complete order", "CLEAR TO COMMIT"); });
await take("live_escalate", async (p) => { await liveRun(p, "Ambiguous request", "NEEDS MORE INFO"); });
await browser.close(); console.log("done");
