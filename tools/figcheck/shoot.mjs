// usage: node shoot.mjs <path> <name> [--port=4173] [--outdir=DIR] [--w=1440] [--h=900] [--dark] [--full] [--clicks=N] [--sel=#fig-1-1] [--scroll=selector]
import { chromium } from "playwright";
const args = Object.fromEntries(process.argv.slice(4).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const [path, name] = process.argv.slice(2);
const w = Number(args.w || 1440);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: Number(args.h || (w < 600 ? 844 : 900)) }, colorScheme: args.dark ? "dark" : "light", deviceScaleFactor: w < 600 ? 2 : 1 });
const errs = [];
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
page.on("pageerror", e => errs.push("pageerror: " + e.message));
await page.goto(`http://localhost:${args.port || 4173}` + path, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
if (args.scroll) { await page.locator(args.scroll).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
if (args.clicks) {
  const sc = page.locator((args.sel || ".scope") + " .sc-btn--next").first();
  for (let i = 0; i < Number(args.clicks); i++) { await sc.click(); await page.waitForTimeout(120); }
  await page.waitForTimeout(600);
}
const outdir = args.outdir || "figcheck-out";
await import("node:fs").then((fs) => fs.mkdirSync(outdir, { recursive: true }));
const out = `${outdir}/${name}.png`;
if (args.sel && !args.full) await page.locator(args.sel).first().screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: !!args.full });
const metrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
console.log(out, JSON.stringify(metrics), errs.length ? "\n" + errs.join("\n") : "");
await browser.close();
