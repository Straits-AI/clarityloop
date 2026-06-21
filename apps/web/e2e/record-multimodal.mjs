// Records (1) the Qwen Model Router strip and (2) qwen-vl-plus reading the price-sheet IMAGE live, at 4K.
import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
const BASE = "http://localhost:5173/", OUT = "e2e/recordings", SIZE = { width: 3840, height: 2160 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--high-dpi-support=1", "--force-device-scale-factor=2"] });
const settle = async (p) => { await p.evaluate(() => document.fonts?.ready); await p.waitForTimeout(500); };
const scrollToText = async (p, t) => { await p.evaluate((t) => { const e = [...document.querySelectorAll("h2,span")].find(e => e.textContent?.trim().startsWith(t)); window.scrollTo({ top: e ? e.getBoundingClientRect().top + window.scrollY - 60 : 0, behavior: "instant" }); }, t); await p.waitForTimeout(1000); };
const clip = async (id, fn) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: SIZE } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" }); await settle(p);
  await fn(p);
  const v = p.video(); await ctx.close(); renameSync(await v.path(), join(OUT, `${id}.webm`)); console.log("saved", id);
};

// 1) Qwen Model Router strip (top of page)
await clip("qwen_router", async (p) => {
  await scrollToText(p, "Qwen Model Router");
  await p.waitForTimeout(4500);
});

// 2) qwen-vl-plus reads the price-sheet image
await clip("mm_parse", async (p) => {
  await scrollToText(p, "Qwen-VL reads the attached price sheet");
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /Parse with Qwen-VL/i }).click();
  console.log("[rec] parse clicked");
  await p.getByText("CTN-COFFEE-1KG").first().waitFor({ state: "visible", timeout: 120000 });
  console.log("[rec] line items extracted");
  await p.waitForTimeout(6000);
});

await browser.close(); console.log("done");
