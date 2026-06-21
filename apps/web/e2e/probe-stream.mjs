import { chromium } from "@playwright/test";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await p.locator("textarea").fill("Hi we need a quote for 120 cartons of the 1L olive oil, same address as last order, before month end. Supplier price sheet attached.");
await p.locator("button", { hasText: /Run ClarityLoop/i }).click();
// model output console should fill with streamed tokens
await p.waitForTimeout(20000);
const out = await p.locator('[data-testid="model-output"] pre').innerText().catch(()=> "");
console.log("model output chars:", out.length, "| starts:", JSON.stringify(out.slice(0,60)));
const gate = await p.locator("text=NEEDS MORE INFO").count();
console.log("gate NEEDS MORE INFO:", gate>0);
await b.close();
