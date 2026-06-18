// Records 5 demo clips of the ClarityLoop console via real UI interaction.
// One Playwright context per clip => one .webm per scenario. Generous dwell;
// Remotion trims each clip to its voiceover duration.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:5173/";
const OUT = "e2e/recordings";
const SIZE = { width: 1920, height: 1080 };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb", "--font-render-hinting=none"] });

async function settleFonts(page) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.waitForTimeout(400);
}
async function smoothTo(page, selectorText) {
  await page.evaluate((t) => {
    const els = [...document.querySelectorAll("h2,h3")];
    const el = els.find((e) => e.textContent && e.textContent.includes(t));
    const y = el ? el.getBoundingClientRect().top + window.scrollY - 90 : 0;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, selectorText);
  await page.waitForTimeout(1400);
}

async function clip(id, fn) {
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // single load => one brief flash at the very start only (no mid-clip reload flash)
  await page.goto(BASE, { waitUntil: "networkidle" });
  await settleFonts(page);
  await page.waitForTimeout(800);
  await fn(page);
  await page.waitForTimeout(500);
  const vid = page.video();
  await ctx.close();
  const p = await vid.path();
  const dest = join(OUT, `${id}.webm`);
  renameSync(p, dest);
  console.log(`saved ${dest}`);
}

// ── c1 · thesis (hero + stat band reveal) ─────────────────────────────────────
await clip("c1_thesis", async (page) => {
  await page.waitForSelector("text=Deterministic code");
  await page.waitForTimeout(31000); // hold on hero while reveal + stat band play
});

// ── c2 · live commit loop (run → stream from Alibaba FC → CLEAR TO COMMIT) ────
await clip("c2_loop", async (page) => {
  await smoothTo(page, "Live commit loop");
  await page.waitForTimeout(2500);
  await page.locator("button", { hasText: /Run ClarityLoop/i }).click();
  // stream resolves from the deployed FC endpoint; wait for the gate verdict to settle
  await page.waitForSelector("text=CLEAR TO COMMIT", { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(30000);
});

// ── c3 · improvement & promotion ─────────────────────────────────────────────
await clip("c3_promotion", async (page) => {
  await smoothTo(page, "Improvement & promotion");
  await page.waitForTimeout(26000);
});

// ── c4 · ClarityLoopBench (runs in-browser, then the 5-baseline table) ───────
await clip("c4_bench", async (page) => {
  await smoothTo(page, "ClarityLoopBench");
  await page.waitForSelector("text=Baseline (Harness Evolution)", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(33000);
});

// ── c5 · composes with HarnessX / AgentDojo ──────────────────────────────────
await clip("c5_compose", async (page) => {
  await smoothTo(page, "Different axis from HarnessX");
  await page.waitForTimeout(31000);
});

await browser.close();
console.log("RECORDINGS:", readdirSync(OUT).filter((f) => f.endsWith(".webm")));
