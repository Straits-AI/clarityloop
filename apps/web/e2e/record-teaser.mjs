import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
const BASE = "http://localhost:5173/";
const OUT = "e2e/recordings"; const SIZE = { width: 1920, height: 1080 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb","--font-render-hinting=none"] });
const settle = async (p) => { await p.evaluate(() => document.fonts?.ready); await p.waitForTimeout(400); };
const scrollTo = async (p, t, ms=1200) => { await p.evaluate((t)=>{const e=[...document.querySelectorAll("h2,h3")].find(e=>e.textContent?.includes(t)); window.scrollTo({top:(e?e.getBoundingClientRect().top+window.scrollY-90:0),behavior:"smooth"});},t); await p.waitForTimeout(ms); };

async function take(id, fn) {
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" }); await settle(p); await p.waitForTimeout(700);
  await fn(p); await p.waitForTimeout(400);
  const v = p.video(); await ctx.close(); renameSync(await v.path(), join(OUT, `${id}.webm`)); console.log("saved", id);
}

// One continuous USAGE take: interact + tour, all with motion.
await take("usage", async (p) => {
  await p.waitForSelector("text=Deterministic code"); await p.waitForTimeout(1800);   // hero
  await scrollTo(p, "Live commit loop", 1400);
  await p.locator("button", { hasText: /Run ClarityLoop/i }).click();
  await p.waitForSelector("text=CLEAR TO COMMIT", { timeout: 25000 }).catch(()=>{});
  await p.waitForTimeout(3200);                                                        // hold on resolved loop
  await scrollTo(p, "Improvement & promotion", 1500); await p.waitForTimeout(2200);
  await scrollTo(p, "ClarityLoopBench", 1500); await p.waitForTimeout(3000);
  await scrollTo(p, "Different axis from HarnessX", 1500); await p.waitForTimeout(2600);
});
await browser.close();
console.log("done");
