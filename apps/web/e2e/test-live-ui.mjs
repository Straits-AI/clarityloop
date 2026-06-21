// Drives the LIVE deployed dashboard (served from Alibaba FC) to prove the clickable UI works.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const URL = process.env.TEST_URL || "https://clarityloop-api-jewijtekcx.ap-southeast-1.fcapp.run/";
mkdirSync("e2e/qa", { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
console.log("[live] goto", URL);
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector("text=Same agent", { timeout: 60000 });
await p.evaluate(() => document.fonts?.ready);
await p.waitForTimeout(800);
await p.screenshot({ path: "e2e/qa/live_top.png" });
console.log("[live] dashboard rendered · pageerrors:", errs);

// run the counterfactual on the LIVE backend (capability-only ships the fraud)
const cf = p.locator("section.reveal").filter({ has: p.getByRole("heading", { name: /Same agent/ }) });
await cf.getByText("CAPABILITY-ONLY", { exact: true }).click();
await cf.getByRole("button", { name: /Run capability-only/i }).click();
console.log("[live] ran capability-only — waiting for live verdict…");
await cf.getByText("no release control").waitFor({ state: "visible", timeout: 120000 });
console.log("[live] SHIPPED verdict rendered (live Qwen round-trip OK)");
await p.waitForTimeout(800);
await cf.scrollIntoViewIfNeeded();
await p.screenshot({ path: "e2e/qa/live_counterfactual.png" });
await b.close();
console.log("[live] done");
