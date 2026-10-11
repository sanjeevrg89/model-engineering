#!/usr/bin/env node
// Check every internal link and #anchor in a built site (default dist/).
// Usage: node scripts/check-links.mjs [dir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.resolve(process.argv[2] || path.join(ROOT, "dist"));
const pages = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
};
walk(DIST);
const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) {
    const html = fs.readFileSync(file, "utf8");
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
};
let bad = 0;
let checked = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  // figures and scopes get their ids from the HTML too; dynamic ids are not linked to
  for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|data:|javascript:|\/)/.test(href)) continue; // root-absolute: 404 page only
    checked++;
    const [p, frag] = href.split("#");
    let target = page;
    if (p) {
      target = path.resolve(path.dirname(page), p);
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
      if (!fs.existsSync(target)) {
        bad++;
        console.log(`missing  ${path.relative(DIST, page)} → ${href}`);
        continue;
      }
    }
    if (frag && target.endsWith(".html") && !idsOf(target).has(frag)) {
      bad++;
      console.log(`anchor   ${path.relative(DIST, page)} → ${href}`);
    }
  }
}
console.log(`${checked} internal links checked across ${pages.length} pages · ${bad} broken`);
process.exit(bad ? 1 : 0);
