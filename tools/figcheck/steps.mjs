// usage: node tools/figcheck/steps.mjs <path> <sel> <prefix> [--port=4195] [--outdir=DIR] [--w=1440] [--dark] [--set=id:value,...] [--noshot] [--only=0,3]
// Steps through every step of a scope, screenshots each, prints caption/delta/notes,
// and reports overlapping or clipped SVG text in each channel.
import { chromium } from "playwright";
const args = Object.fromEntries(process.argv.slice(5).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const [path, sel, prefix] = process.argv.slice(2);
const w = Number(args.w || 1440);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: args.dark ? "dark" : "light", deviceScaleFactor: w < 600 ? 2 : 1 });
const errs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await page.goto(`http://localhost:${args.port || 4195}` + path, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const fig = page.locator(sel).first();
await fig.scrollIntoViewIfNeeded();
if (args.set) {
  for (const kv of String(args.set).split(",")) {
    const [id, v] = kv.split(":");
    await page.evaluate(([sel, id, v]) => {
      const root = document.querySelector(sel);
      const c = root.querySelector(`#${root.id}-${id}`);
      if (!c) throw new Error("no param " + id);
      c.value = v;
      c.dispatchEvent(new Event("input", { bubbles: true }));
    }, [sel, id, v]);
  }
  await page.waitForTimeout(500);
}
const outdir = args.outdir || "figcheck-out";
await import("node:fs").then((fs) => fs.mkdirSync(outdir, { recursive: true }));
const n = await page.evaluate((sel) => document.querySelectorAll(sel + " .sc-dot").length, sel);
const only = args.only ? String(args.only).split(",").map(Number) : null;
for (let i = 0; i < Math.max(n, 1); i++) {
  if (i > 0) { await fig.locator(".sc-btn--next").first().click(); }
  await page.waitForTimeout(900);
  if (only && !only.includes(i)) continue;
  const info = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const cap = root.querySelector(".scope__caption")?.innerText || "";
    const delta = root.querySelector(".delta")?.innerText.replace(/\s+/g, " ") || "";
    const deltaDiff = root.querySelector(".delta")?.className || "";
    const notes = [...root.querySelectorAll(".ch__note")].map((x) => x.innerText);
    const problems = [];
    root.querySelectorAll(".ch").forEach((ch, ci) => {
      const svg = ch.querySelector("svg");
      const sr = svg.getBoundingClientRect();
      const texts = [...svg.querySelectorAll("text")].filter((t) => {
        const cs = getComputedStyle(t);
        let op = 1; let el = t;
        while (el && el !== svg) { const o = parseFloat(getComputedStyle(el).opacity); if (!isNaN(o)) op *= o; el = el.parentElement; }
        return op > 0.5 && cs.display !== "none" && cs.visibility !== "hidden" && t.textContent.trim();
      });
      const boxes = texts.map((t) => ({ t: t.textContent.trim().slice(0, 40), r: t.getBoundingClientRect(), fs: parseFloat(getComputedStyle(t).fontSize) }));
      for (const b of boxes) {
        if (b.r.left < sr.left - 0.5 || b.r.right > sr.right + 0.5 || b.r.top < sr.top - 0.5 || b.r.bottom > sr.bottom + 0.5) problems.push(`ch${ci} CLIP "${b.t}" [${Math.round(b.r.left - sr.left)},${Math.round(b.r.right - sr.left)}]x[${Math.round(b.r.top - sr.top)},${Math.round(b.r.bottom - sr.top)}] svg ${Math.round(sr.width)}x${Math.round(sr.height)}`);
        if (b.fs < 10.4) problems.push(`ch${ci} SMALL ${b.fs}px "${b.t}"`);
      }
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a].r, B = boxes[b].r;
        const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox > 1.5 && oy > 2.5) problems.push(`ch${ci} OVERLAP "${boxes[a].t}" / "${boxes[b].t}" (${ox.toFixed(1)}x${oy.toFixed(1)})`);
      }
    });
    return { cap, delta, deltaDiff, notes, problems };
  }, sel);
  console.log(`--- ${prefix} step ${i} ---`);
  console.log("CAPTION:", info.cap);
  console.log("STRIP:", info.deltaDiff.includes("is-diff") ? "[Δ]" : "[=]", info.delta);
  info.notes.forEach((x, k) => console.log(`NOTE ${k}:`, x));
  if (info.problems.length) console.log("PROBLEMS:\n  " + info.problems.join("\n  "));
  if (!args.noshot) await fig.screenshot({ path: `${outdir}/${prefix}-s${String(i).padStart(2, "0")}.png` });
}
const metrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log(prefix, "steps", n, JSON.stringify(metrics), errs.length ? "\n" + errs.join("\n") : "");
await browser.close();
