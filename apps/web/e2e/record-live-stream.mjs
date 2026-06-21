import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
const BASE = "http://localhost:5173/", OUT = "e2e/recordings", SIZE = { width: 3840, height: 2160 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--high-dpi-support=1", "--force-device-scale-factor=2"] });
const settle = async (p) => { await p.evaluate(() => document.fonts?.ready); await p.waitForTimeout(500); };
const scrollTo = async (p, t, ms = 1300) => { await p.evaluate((t) => { const e = [...document.querySelectorAll("h2,h3")].find(e => e.textContent?.includes(t)); window.scrollTo({ top: e ? e.getBoundingClientRect().top + window.scrollY - 70 : 0, behavior: "smooth" }); }, t); await p.waitForTimeout(ms); };
async function take(id, request, verdict) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: SIZE } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" }); await settle(p); await p.waitForTimeout(500);
  await scrollTo(p, "Live commit loop", 1400);
  const ta = p.locator("textarea");
  await ta.click(); await ta.fill("");
  await ta.pressSequentially(request, { delay: 26 });   // type the request character by character
  await p.waitForTimeout(700);
  await p.locator("button", { hasText: /Run ClarityLoop/i }).click();
  await p.waitForSelector(`text=${verdict}`, { timeout: 75000 }).catch(() => {});
  await p.waitForTimeout(8000);                          // dwell on the streamed result
  const v = p.video(); await ctx.close(); renameSync(await v.path(), join(OUT, `${id}.webm`)); console.log("saved", id);
}
await take("live_commit",
  "Draft a quote for 50 cases of catalog SKU OO-1L olive oil at the listed catalog price of 12.50 dollars per case, shipped to the verified billing address on file for account ABC-204, standard 5 business day delivery. All fields confirmed, no discount.",
  "CLEAR TO COMMIT");
await take("live_escalate",
  "Hi - we need a quote for 120 cartons of the 1L olive oil, same address as our last order, before month end. Our supplier sent the attached price sheet.",
  "NEEDS MORE INFO");
await browser.close(); console.log("done");
