import { chromium } from "playwright";
// usage: node labrun.mjs <path> <labSelector> <skeleton|solution> [port] [outdir]
const [path, labSel, mode, port = "4173", outdir = "."] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
await page.goto(`http://localhost:${port}` + path, { waitUntil: "networkidle" });
const lab = page.locator(labSel);
await lab.scrollIntoViewIfNeeded();
await page.waitForSelector(labSel + " .lab__head button");
await page.waitForTimeout(800);
if (mode === "solution") {
  await lab.getByRole("button", { name: "Show solution" }).click();
  await lab.locator(".lab__confirm .btn--primary").click();
  await page.waitForTimeout(500);
}
const t0 = Date.now();
await lab.getByRole("button", { name: "Run tests" }).click();
await page.waitForFunction((sel) => { const s = document.querySelector(sel + " .lab__status"); return s && (s.dataset.state === "pass" || s.dataset.state === "fail"); }, labSel, { timeout: 120000 });
const status = await lab.locator(".lab__status").innerText();
const log = await lab.locator(".lab__log").innerText();
console.log(`[${mode}] ${((Date.now()-t0)/1000).toFixed(1)}s status: ${status}\n${log}`);
await lab.screenshot({ path: `${outdir}/lab-${path.split("/").filter(Boolean).pop()}-${mode}.png` });
if (errs.length) console.log(errs.join("\n"));
await browser.close();
