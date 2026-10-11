// usage: node tools/figcheck/textcheck.mjs [slug | /page/path/ ...] [--port=4173] [--w=1440] [--dark] [--params] [--json=FILE]
// Checks the text of every figure on every chapter (or the slugs given) in one browser:
// each step of each scope, and each static figure. Reports text that is clipped by its
// SVG, smaller than 10.5 px, or overlapping other text, the same tests as steps.mjs.
// Reduced motion is on, so steps render without transitions. With --params, each control of a
// figure (select options; a range's min, middle and max) is swept one at a time, others at default.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
const course = JSON.parse(fs.readFileSync(path.join(ROOT, "course.json"), "utf8"));
const slugs = argv.filter((a) => !a.startsWith("--"));
const chapters = slugs.length ? slugs : course.parts.flatMap((p) => p.chapters).map((c) => c.slug);
const w = Number(args.w || 1440);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: args.dark ? "dark" : "light", reducedMotion: "reduce", deviceScaleFactor: 1 });
const report = [];
let total = 0;

const inspect = (sel) => {
  const root = document.querySelector(sel);
  const problems = [];
  const svgs = root.querySelectorAll(".ch").length ? [...root.querySelectorAll(".ch svg")] : [...root.querySelectorAll("svg")];
  svgs.forEach((svg, ci) => {
    const sr = svg.getBoundingClientRect();
    if (!sr.width) return;
    const texts = [...svg.querySelectorAll("text")].filter((t) => {
      const cs = getComputedStyle(t);
      let op = 1;
      for (let el = t; el && el !== svg; el = el.parentElement) {
        const o = parseFloat(getComputedStyle(el).opacity);
        if (!isNaN(o)) op *= o;
      }
      return op > 0.5 && cs.display !== "none" && cs.visibility !== "hidden" && t.textContent.trim();
    });
    const boxes = texts.map((t) => ({ t: t.textContent.trim().slice(0, 40), r: t.getBoundingClientRect(), fs: parseFloat(getComputedStyle(t).fontSize) }));
    for (const b of boxes) {
      if (b.r.left < sr.left - 0.5 || b.r.right > sr.right + 0.5 || b.r.top < sr.top - 0.5 || b.r.bottom > sr.bottom + 0.5) problems.push(`svg${ci} CLIP "${b.t}"`);
      if (b.fs < 10.4) problems.push(`svg${ci} SMALL ${b.fs}px "${b.t}"`);
    }
    for (let a = 0; a < boxes.length; a++)
      for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a].r, B = boxes[b].r;
        const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox > 1.5 && oy > 2.5) problems.push(`svg${ci} OVERLAP "${boxes[a].t}" / "${boxes[b].t}"`);
      }
  });
  return problems;
};

for (const slug of chapters) {
  const url = slug.startsWith("/") ? slug : `/ch/${slug}/`;
  await page.goto(`http://localhost:${args.port || 4173}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const figs = await page.$$eval('figure[id^="fig-"], .scope[id], .svgfig[id]', (els) => [...new Set(els.map((e) => e.id))]);
  for (const id of figs) {
    const sel = "#" + id;
    await page.locator(sel).first().scrollIntoViewIfNeeded();
    const found = new Map();
    // every step of the figure in its current parameter state
    const sweep = async (label) => {
      const n = await page.evaluate((s) => document.querySelectorAll(s + " .sc-dot").length, sel);
      for (let i = 0; i < Math.max(n, 1); i++) {
        if (n > 1) await page.locator(sel + " .sc-dot").nth(i).click(); // a one-step scope hides its only dot
        await page.waitForTimeout(120);
        for (const p of await page.evaluate(inspect, sel)) {
          const key = `${label}step ${i}: ${p}`;
          if (![...found.keys()].some((k) => k.endsWith(`: ${p}`))) found.set(key, true);
        }
      }
      return Math.max(n, 1);
    };
    const steps = await sweep("");
    let states = 1;
    if (args.params) {
      const controls = await page.evaluate((s) => [...document.querySelectorAll(`${s} .scope__params select, ${s} .scope__params input[type=range]`)].map((c) => {
        if (c.tagName === "SELECT") return { id: c.id, def: c.value, values: [...c.options].map((o) => o.value) };
        const min = Number(c.min), max = Number(c.max), step = Number(c.step) || 1;
        const mid = min + Math.round((max - min) / 2 / step) * step;
        return { id: c.id, def: c.value, values: [...new Set([min, mid, max].map(String))] };
      }), sel);
      const set = (cid, v) => page.evaluate(([cid, v]) => {
        const c = document.getElementById(cid);
        c.value = v;
        c.dispatchEvent(new Event("input", { bubbles: true }));
      }, [cid, v]);
      for (const c of controls) {
        for (const v of c.values) {
          if (v === c.def) continue;
          await set(c.id, v);
          await page.waitForTimeout(150);
          await sweep(`[${c.id.replace(id + "-", "")}=${v}] `);
          states++;
        }
        await set(c.id, c.def);
        await page.waitForTimeout(150);
      }
    }
    const problems = [...found.keys()];
    total += problems.length;
    report.push({ slug, fig: id, steps, states, problems });
    console.log(`${problems.length ? "PROBLEMS" : "ok      "} ${slug} ${sel} (${steps} steps${states > 1 ? `, ${states} parameter states` : ""})${problems.length ? "\n  " + problems.join("\n  ") : ""}`);
  }
}
await browser.close();
if (args.json) fs.writeFileSync(args.json, JSON.stringify(report, null, 1));
console.log(`${report.length} figures, ${total} text problems`);
process.exit(total ? 1 : 0);
