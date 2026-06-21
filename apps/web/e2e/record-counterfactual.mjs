// Records the honest "same agent, one switch" counterfactual at 4K:
// CAPABILITY-ONLY (gate off) ships the fraudulent quote -> flip to CLARITYLOOP (gate on) -> escalates.
// Single continuous take so the switch-flip + opposite outcomes read as one real session.
import { chromium } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
const BASE = "http://localhost:5173/", OUT = "e2e/recordings", SIZE = { width: 3840, height: 2160 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--high-dpi-support=1", "--force-device-scale-factor=2"] });
const settle = async (p) => { await p.evaluate(() => document.fonts?.ready); await p.waitForTimeout(500); };

const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: SIZE } });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" }); await settle(p);
// scroll to the counterfactual section (header "Same agent. Same request. One switch.")
await p.evaluate(() => { const e = [...document.querySelectorAll("h2")].find(e => e.textContent?.includes("Same agent")); window.scrollTo({ top: e ? e.getBoundingClientRect().top + window.scrollY - 60 : 0, behavior: "instant" }); });
await p.waitForTimeout(1200);

// scope to the counterfactual section (the old live-loop section also has a "Run ClarityLoop" button)
const cf = p.locator("section.reveal").filter({ has: p.getByRole("heading", { name: /Same agent/ }) });
const log = (m) => console.log(`[rec] ${m}`);

// --- pass 1: capability-only (gate off) ships the fraud ---
await cf.getByText("CAPABILITY-ONLY", { exact: true }).click();
await p.waitForTimeout(500);
await cf.getByRole("button", { name: /Run capability-only/i }).click(); log("pass1 run clicked");
await cf.getByText("no release control").waitFor({ state: "visible", timeout: 120000 }); log("pass1 SHIPPED verdict shown");
await p.waitForTimeout(6500);                              // dwell on the shipped wrong quote

// --- pass 2: flip the switch to ClarityLoop (gate on) -> escalate ---
await cf.getByText("CLARITYLOOP", { exact: true }).click();
await p.waitForTimeout(800);
await cf.getByRole("button", { name: /Run ClarityLoop/i }).click(); log("pass2 run clicked");
await cf.getByText("blocked before commit").waitFor({ state: "visible", timeout: 120000 }); log("pass2 ESCALATED verdict shown");
await p.waitForTimeout(6500);                              // dwell on the escalation

const v = p.video(); await ctx.close(); renameSync(await v.path(), join(OUT, "cf_switch.webm"));
await browser.close(); console.log("saved cf_switch");
