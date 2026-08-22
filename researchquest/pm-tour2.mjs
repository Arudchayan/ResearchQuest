import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = "C:/Users/DELL/AppData/Local/Temp/opencode/rq-shots";
fs.mkdirSync(OUT, { recursive: true });
const log = { steps: [], errors: [], perf: null, xpTrail: [] };
const step = (s, d) => { log.steps.push({ s, d }); console.log(`STEP: ${s} ${d ?? ""}`); };

const browser = await chromium.launch({
  headless: false, slowMo: 80,
  executablePath: "C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !t.includes("data-matrix-id")) log.errors.push(`[console] ${t.slice(0, 220)}`); });
page.on("pageerror", (e) => log.errors.push(`[pageerror] ${String(e).slice(0, 220)}`));

async function shot(name) { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${name}.png` }); step("shot", name); }
async function xp() {
  try { const t = await page.locator("text=/\\d+ XP/").first().textContent({ timeout: 3000 }); return t?.trim(); } catch { return "?"; }
}

try {
  // ---------- sign in ----------
  await page.goto("http://127.0.0.1:5317", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').fill("arudchayan01@gmail.com");
  await page.locator('input[type="password"]').fill("3As278ePfWCBFLZ@");
  const t0 = Date.now();
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.locator("h1, [class*=serif]").filter({ hasText: /Good (morning|afternoon|evening)/i }).first().waitFor({ timeout: 20000 });
  step("signin-to-dashboard-ms", String(Date.now() - t0));
  log.xpTrail.push({ at: "after-signin", xp: await xp() });
  await shot("100-dashboard-signed-in");

  // ---------- perf: resource summary on SPA ----------
  const perf = await page.evaluate(() => {
    const res = performance.getEntriesByType("resource");
    const nav = performance.getEntriesByType("navigation")[0];
    const byType = {};
    for (const r of res) {
      const t = r.initiatorType || "other";
      byType[t] = byType[t] || { n: 0, bytes: 0, ms: 0 };
      byType[t].n++; byType[t].bytes += r.transferSize || 0; byType[t].ms += r.duration;
    }
    return {
      nav: nav ? { domContentLoaded: nav.domContentLoadedEventEnd, load: nav.loadEventEnd } : null,
      resources: byType,
      totalRequests: res.length,
      totalBytes: res.reduce((a, r) => a + (r.transferSize || 0), 0),
    };
  });
  log.perf = perf; step("perf", JSON.stringify(perf).slice(0, 600));

  // ---------- create a note via command palette ----------
  await page.keyboard.press("ControlOrMeta+k");
  await page.waitForTimeout(500);
  await page.locator('[cmdk-input], input[placeholder*="command" i]').first().fill("New Note");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  await shot("101-new-note-editor");
  // type into title
  const titleInput = page.locator('input[aria-label="Note title"]');
  if (await titleInput.count()) {
    await titleInput.fill("Billion-dollar teardown notes");
    // type into CodeMirror
    await page.locator(".cm-content").click();
    await page.keyboard.type("## Core loop\nCapture -> Connect -> Synthesize -> Write.\n\nThe moat is the **graph + AI synthesis layer**.");
    await page.waitForTimeout(1200);
    await shot("102-note-typed");
    log.xpTrail.push({ at: "note-created", xp: await xp() });
  }

  // ---------- create an idea ----------
  await page.goto("http://127.0.0.1:5317/ideas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: /new idea/i }).first().click();
  await page.waitForTimeout(800);
  // dialog form?
  const ideaTitle = page.locator('input[placeholder*="title" i], input[name="title" i]').first();
  if (await ideaTitle.count()) {
    await ideaTitle.fill("LLM-assisted systematic literature reviews");
    const ideaDesc = page.locator('textarea').first();
    if (await ideaDesc.count()) await ideaDesc.fill("Can LLM pipelines cut systematic review screening time by 80% without recall loss?");
    await shot("103-new-idea-form");
    await page.getByRole("button", { name: /create|save/i }).first().click();
    await page.waitForTimeout(1500);
  }
  await shot("104-idea-created");

  // open the new idea detail (first card in Seed)
  const ideaCard = page.locator('text=LLM-assisted systematic literature reviews').first();
  if (await ideaCard.count()) {
    await ideaCard.click();
    await page.waitForTimeout(1500);
    await shot("105-idea-detail");
    // run Deep Research
    const dr = page.getByRole("button", { name: /deep research/i }).first();
    if (await dr.count()) {
      const t1 = Date.now();
      await dr.click();
      step("deep-research-clicked");
      try {
        await page.locator('text=/research landscape|suggested keywords|reasoning/i').first().waitFor({ timeout: 90000 });
        step("deep-research-done-ms", String(Date.now() - t1));
      } catch { step("deep-research-timeout-or-failed", String(Date.now() - t1)); }
      await shot("106-deep-research-result");
    } else step("no-deep-research-button");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }

  // ---------- add paper via DOI + dedup test ----------
  await page.goto("http://127.0.0.1:5317/papers", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /add paper/i }).first().click();
  await page.waitForTimeout(1200);
  await shot("107-add-paper-view");
  const doiInput = page.locator('input[placeholder*="DOI" i]').first();
  if (await doiInput.count()) {
    await doiInput.fill("10.1038/nature14539");
    await page.getByRole("button", { name: /fetch|lookup|add|resolve/i }).first().click().catch(() => {});
    await page.waitForTimeout(6000);
    await shot("108-doi-fetched");
    // try adding the SAME doi again to test dedup
    await doiInput.fill("10.1038/nature14539");
    await page.getByRole("button", { name: /fetch|lookup|add|resolve/i }).first().click().catch(() => {});
    await page.waitForTimeout(6000);
    await shot("109-doi-duplicate-attempt");
  }

  // ---------- keyword search tab ----------
  const kwTab = page.getByRole("tab", { name: /keyword/i }).first();
  if (await kwTab.count()) {
    await kwTab.click();
    await page.waitForTimeout(500);
    const kwInput = page.locator('input[placeholder*="search" i]').first();
    await kwInput.fill("retrieval augmented generation");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(7000);
    await shot("110-keyword-search-results");
  }

  // ---------- bibtex import ----------
  const bibTab = page.getByRole("tab", { name: /bibtex/i }).first();
  if (await bibTab.count()) {
    await bibTab.click();
    await page.waitForTimeout(500);
    const ta = page.locator("textarea").first();
    if (await ta.count()) {
      await ta.fill(`@article{vaswani2017attention,\n  title={Attention Is All You Need},\n  author={Vaswani, Ashish and Shazeer, Noam},\n  journal={NeurIPS},\n  year={2017}\n}`);
      await shot("111-bibtex-pasted");
      await page.getByRole("button", { name: /import|add/i }).first().click().catch(() => {});
      await page.waitForTimeout(3000);
      await shot("112-bibtex-imported");
    }
  }
  await page.keyboard.press("Escape");

  // ---------- keyboard-only a11y pass ----------
  await page.goto("http://127.0.0.1:5317/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const focusTrail = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const d = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}${el.textContent ? ":" + el.textContent.trim().slice(0, 40) : ""}` : "none";
    });
    focusTrail.push(d);
  }
  fs.writeFileSync(`${OUT}/focus-trail.json`, JSON.stringify(focusTrail, null, 2));
  step("focus-trail-captured", focusTrail.slice(0, 6).join(" | "));
  await shot("113-after-tabbing");

  // ---------- invalid route ----------
  await page.goto("http://127.0.0.1:5317/bogus-route", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await shot("114-invalid-route");

  // ---------- offline behavior ----------
  await ctx.setOffline(true);
  await page.goto("http://127.0.0.1:5317/notes", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot("115-offline-notes");
  await ctx.setOffline(false);
  await page.waitForTimeout(1500);

  // ---------- dark mode ----------
  await page.goto("http://127.0.0.1:5317/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const themeBtn = page.locator('button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i]').first();
  if (await themeBtn.count()) { await themeBtn.click(); await page.waitForTimeout(900); }
  else {
    // fallback: moon icon in sidebar bottom
    await page.locator("button:has(svg.lucide-moon)").first().click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await shot("116-dark-dashboard");
  await page.goto("http://127.0.0.1:5317/notes", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot("117-dark-notes");

  // ---------- mobile signed-in pass ----------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on("console", (m) => { if (m.type() === "error") log.errors.push(`[m-console] ${m.text().slice(0, 200)}`); });
  await mp.goto("http://127.0.0.1:5317", { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(2000);
  await mp.locator('input[type="email"]').fill("arudchayan01@gmail.com");
  await mp.locator('input[type="password"]').fill("3As278ePfWCBFLZ@");
  await mp.getByRole("button", { name: /sign in/i }).first().click();
  await mp.waitForTimeout(4000);
  await mp.screenshot({ path: `${OUT}/120-mobile-dashboard.png` });
  await mp.goto("http://127.0.0.1:5317/notes", { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: `${OUT}/121-mobile-notes.png` });
  await mp.goto("http://127.0.0.1:5317/focus", { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: `${OUT}/122-mobile-focus.png` });
  await mctx.close();

  // ---------- final XP ----------
  log.xpTrail.push({ at: "end", xp: await xp() });
} catch (e) {
  log.errors.push(`[fatal] ${String(e).slice(0, 600)}`);
  await page.screenshot({ path: `${OUT}/199-fatal.png` }).catch(() => {});
}

fs.writeFileSync(`${OUT}/phase2-log.json`, JSON.stringify(log, null, 2));
await browser.close();
console.log("PHASE2 DONE");
console.log("ERRORS:", JSON.stringify(log.errors.slice(0, 12), null, 2));
