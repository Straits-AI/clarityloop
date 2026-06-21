import { chromium } from "@playwright/test";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", e => errs.push(String(e).slice(0,200)));
await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
console.log("hero:", await p.locator("text=Deterministic code").count() > 0);
await p.locator("button", { hasText: /Run ClarityLoop/i }).click();
// real workflow step (e.g. retrieve_memory) should appear
const wf = await p.waitForSelector("text=retrieve_memory", { timeout: 60000 }).then(()=>true).catch(()=>false);
console.log("real workflow rendered:", wf);
// real gate decision
const gate = await p.waitForSelector("text=NEEDS MORE INFO", { timeout: 30000 }).then(()=>true).catch(()=>false);
const esc = await p.locator("text=ESCALATE").count();
console.log("gate NEEDS MORE INFO:", gate, "| ESCALATE count:", esc);
// real extracted fact (from the live state) somewhere? check trace populated
const frames = await p.locator("text=scored").count();
console.log("trace frames(scored):", frames);
console.log("pageerrors:", errs.slice(0,3));
await b.close();
