// usage: PORT=4173 node tools/figcheck/smoke.mjs <slug> [<slug> ...]
// Steps every scope on each chapter page once and reports page errors.
import { chromium } from "playwright";
const slugs = process.argv.slice(2);
const b = await chromium.launch();
for (const s of slugs) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(`http://localhost:${process.env.PORT || 4173}/ch/${s}/`, { waitUntil: "networkidle" });
  // step every scope once to surface runtime errors in draw code
  const n = await p.$$eval("figure.scope", (els) => els.length);
  for (let i = 0; i < n; i++) {
    const btn = p.locator("figure.scope").nth(i).locator(".sc-btn--next");
    const steps = await p.locator("figure.scope").nth(i).locator(".sc-dot").count();
    for (let k = 1; k < steps; k++) { if (await btn.isEnabled()) await btn.click(); }
  }
  await p.waitForTimeout(300);
  console.log(`${s.padEnd(26)} scopes=${n} ${errs.length ? "ERRORS: " + errs.slice(0, 3).join(" | ") : "ok"}`);
  await p.close();
}
await b.close();
