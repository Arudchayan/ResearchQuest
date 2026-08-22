import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = "C:/Users/DELL/AppData/Local/Temp/opencode/rq-shots";
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const notes = [];

const browser = await chromium.launch({
  headless: false,
  slowMo: 120,
  executablePath: "C:/Users/DELL/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`));
page.on("requestfailed", (r) => {
  const f = r.failure()?.errorText ?? "";
  if (!f.includes("ERR_ABORTED")) errors.push(`[reqfail] ${r.url().slice(0, 120)} ${f}`);
});

async function shot(name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  notes.push(`shot ${name} @ ${page.url()}`);
}

try {
  await page.goto("http://127.0.0.1:5317", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot("01-initial-load");

  // Sign in if auth screen is showing
  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.count()) {
    await emailInput.fill("arudchayan01@gmail.com");
    await page.locator('input[type="password"]').fill("3As278ePfWCBFLZ@");
    await shot("02-auth-filled");
    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.waitForTimeout(4000);
    await shot("03-after-signin");
  }

  // Dashboard
  await page.goto("http://127.0.0.1:5317/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await shot("10-dashboard");

  // Notes
  await page.goto("http://127.0.0.1:5317/notes", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot("20-notes-list");
  // open first note if present
  const noteItem = page.locator('[class*="cursor-pointer"]').first();
  if (await noteItem.count()) {
    try { await noteItem.click({ timeout: 3000 }); await page.waitForTimeout(1500); await shot("21-note-editor"); } catch {}
  }

  // Papers
  await page.goto("http://127.0.0.1:5317/papers", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot("30-papers");

  // Ideas
  await page.goto("http://127.0.0.1:5317/ideas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot("40-ideas-board");

  // Tasks
  await page.goto("http://127.0.0.1:5317/tasks", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot("50-tasks");

  // Topics
  await page.goto("http://127.0.0.1:5317/topics", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot("60-topics");

  // Focus
  await page.goto("http://127.0.0.1:5317/focus", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot("70-focus");

  // Command palette
  await page.keyboard.press("ControlOrMeta+k");
  await page.waitForTimeout(900);
  await shot("80-command-palette");
  await page.keyboard.press("Escape");

  // Mobile pass
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mctx.newPage();
  mp.on("console", (m) => { if (m.type() === "error") errors.push(`[m-console] ${m.text().slice(0, 300)}`); });
  await mp.goto("http://127.0.0.1:5317/", { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(2500);
  await mp.screenshot({ path: `${OUT}/90-mobile-dashboard.png` });
  await mp.goto("http://127.0.0.1:5317/notes", { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: `${OUT}/91-mobile-notes.png` });
  await mctx.close();
} catch (e) {
  errors.push(`[fatal] ${String(e).slice(0, 500)}`);
  await page.screenshot({ path: `${OUT}/99-fatal.png` }).catch(() => {});
}

fs.writeFileSync(`${OUT}/tour-log.json`, JSON.stringify({ notes, errors }, null, 2));
await browser.close();
console.log("DONE");
console.log("ERRORS:", JSON.stringify(errors, null, 2).slice(0, 4000));

