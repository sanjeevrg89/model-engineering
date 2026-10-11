#!/usr/bin/env node
// Move a pinned GitHub source to a new release and carry every <ref> and
// <excerpt> line number across through git's diff of the two commits.
// A line that git leaves untouched moves by the net size of the hunks above it.
// A line inside a rewritten hunk is flagged for a human, unless its search
// string sits exactly once in the replacing hunk.
//
// Usage:
//   node scripts/repin.mjs --latest <source>               print the newest stable tag
//   node scripts/repin.mjs <source> <tag> [--write] [--report out.json]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COURSE = path.join(ROOT, "course.json");
const course = JSON.parse(fs.readFileSync(COURSE, "utf8"));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : null);
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--report"));

const run = (cmd, argv, cwd) =>
  execFileSync(cmd, argv, { cwd, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 30 }).toString();

function source(key) {
  const src = course.sources[key];
  if (!src) throw new Error(`unknown source "${key}"`);
  if (src.host && src.host !== "github") throw new Error(`${key} is not a GitHub source`);
  return src;
}

function stableTags(src) {
  const out = run("git", ["ls-remote", "--tags", "--refs", `https://github.com/${src.repo}.git`]);
  const tags = [];
  for (const line of out.split("\n")) {
    const [sha, ref] = line.split("\t");
    const tag = ref?.replace("refs/tags/", "");
    const m = tag?.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (m) tags.push({ tag, sha, v: [+m[1], +m[2], +m[3]] });
  }
  return tags.sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1] || a.v[2] - b.v[2]);
}

if (flag("--latest")) {
  const src = source(positional[0]);
  const tags = stableTags(src);
  console.log(tags.at(-1)?.tag ?? "");
  process.exit(0);
}

const [key, newTag] = positional;
if (!key || !newTag) {
  console.error("usage: node scripts/repin.mjs <source> <tag> [--write] [--report out.json]");
  process.exit(2);
}
const src = source(key);
const target = stableTags(src).find((t) => t.tag === newTag);
const newCommit = target?.sha ?? (/^[0-9a-f]{40}$/.test(newTag) ? newTag : null);
if (!newCommit) throw new Error(`no tag ${newTag} in ${src.repo}`);
const oldCommit = src.commit;
if (oldCommit === newCommit) {
  console.log(`${key} is already at ${newTag}`);
  process.exit(0);
}

// Both trees in one scratch repo, blobs fetched lazily.
const repo = fs.mkdtempSync(path.join(os.tmpdir(), `repin-${key}-`));
run("git", ["init", "-q"], repo);
run("git", ["remote", "add", "origin", `https://github.com/${src.repo}.git`], repo);
for (const c of [oldCommit, newCommit]) run("git", ["fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", c], repo);
// Annotated tags resolve to tag objects; peel to the commit.
const newPeeled = run("git", ["rev-parse", `${newCommit}^{commit}`], repo).trim();

const renames = new Map();
for (const line of run("git", ["diff", "-M", "--name-status", oldCommit, newPeeled], repo).split("\n")) {
  const parts = line.split("\t");
  if (parts[0]?.startsWith("R")) renames.set(parts[1], parts[2]);
}

const hunkCache = new Map();
function hunks(oldPath, newPath) {
  const k = `${oldPath}\0${newPath}`;
  if (!hunkCache.has(k)) {
    const diff = run("git", ["diff", "-U0", "-M", oldCommit, newPeeled, "--", oldPath, newPath], repo);
    const hs = [];
    for (const m of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm))
      hs.push([+m[1], m[2] === undefined ? 1 : +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]);
    hunkCache.set(k, hs);
  }
  return hunkCache.get(k);
}

// [newLine, null] for an untouched line, [null, hunk] for a rewritten one.
function mapLine(oldPath, newPath, n) {
  let shift = 0;
  for (const [a, b, c, d] of hunks(oldPath, newPath)) {
    if (b === 0) {
      if (a < n) shift += d;
      continue;
    }
    if (n < a) break;
    if (n <= a + b - 1) return [null, [a, b, c, d]];
    shift += d - b;
  }
  return [n + shift, null];
}

const fileCache = new Map();
function newLines(p) {
  if (!fileCache.has(p)) {
    let lines = null;
    try {
      lines = run("git", ["show", `${newPeeled}:${p}`], repo).split("\n");
    } catch {
      lines = null;
    }
    fileCache.set(p, lines);
  }
  return fileCache.get(p);
}

const windowHas = (lines, n, s) => lines.slice(Math.max(0, n - 3), n + 2).join("\n").includes(s);
const decode = (v) =>
  v.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const ranges = (spec) => spec.split(",").map((part) => (part.includes("-") ? part.split("-").map(Number) : [+part, +part]));

const report = { source: key, from: src.tag, to: newTag, unchanged: 0, shifted: 0, rescued: 0, flagged: [] };

function fixTag(kind, attrsSrc, where) {
  const attrs = {};
  for (const m of attrsSrc.matchAll(/(\w+)=("([^"]*)"|'([^']*)')/g)) attrs[m[1]] = decode(m[3] ?? m[4]);
  if (attrs.e !== key || !attrs.l) return attrsSrc;
  const oldP = attrs.p;
  const newP = renames.get(oldP) ?? oldP;
  const lines = newLines(newP);
  const flagIt = (why) => (report.flagged.push({ where, kind, path: oldP, lines: attrs.l, s: attrs.s ?? "", why }), attrsSrc);
  if (!lines) return flagIt(`file missing at ${newTag}`);
  const s = attrs.s ?? "";
  const updates = {};
  if (newP !== oldP) updates.p = newP;
  if (kind === "ref") {
    const n = +attrs.l;
    let [m, h] = mapLine(oldP, newP, n);
    if (m === null) {
      const [, , c, d] = h;
      const hits = [];
      for (let i = Math.max(1, c - 5); i <= Math.min(lines.length, c + d + 5); i++) if (s && lines[i - 1].includes(s)) hits.push(i);
      if (hits.length !== 1) return flagIt("line was rewritten");
      m = hits[0];
      report.rescued++;
    }
    if (s && !windowHas(lines, m, s)) return flagIt("search string no longer at the mapped line");
    if (m !== n) updates.l = String(m);
  } else {
    const mapped = [];
    for (const [x, y] of ranges(attrs.l)) {
      const ls = [];
      for (let k = x; k <= y; k++) ls.push(mapLine(oldP, newP, k)[0]);
      if (ls.some((v) => v === null) || ls.some((v, i) => v !== ls[0] + i)) return flagIt(`range ${x}-${y} touches rewritten lines`);
      mapped.push([ls[0], ls.at(-1)]);
    }
    const spec = mapped.map(([x, y]) => (x === y ? `${x}` : `${x}-${y}`)).join(",");
    if (spec !== attrs.l) updates.l = spec;
    if (attrs.hl) {
      const hl = attrs.hl
        .split(",")
        .map((part) => part.split("-").map((v) => mapLine(oldP, newP, +v)[0]).join("-"))
        .join(",");
      if (hl !== attrs.hl) updates.hl = hl;
    }
    if (s) {
      const body = mapped.flatMap(([x, y]) => lines.slice(x - 1, y)).join("\n");
      if (!body.includes(s)) return flagIt("search string not in the remapped excerpt");
    }
  }
  if (Object.keys(updates).length) report.shifted++;
  else report.unchanged++;
  let out = attrsSrc;
  for (const [k, v] of Object.entries(updates)) out = out.replace(new RegExp(`\\b${k}="[^"]*"`), `${k}="${v}"`);
  return out;
}

const pages = [];
const chaptersDir = path.join(ROOT, "src", "chapters");
for (const d of fs.readdirSync(chaptersDir).sort()) {
  const f = path.join(chaptersDir, d, "index.html");
  if (fs.existsSync(f)) pages.push(f);
}
for (const f of fs.readdirSync(path.join(ROOT, "src", "pages")).sort())
  if (f.endsWith(".html")) pages.push(path.join(ROOT, "src", "pages", f));

for (const f of pages) {
  const text = fs.readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f);
  const next = text.replace(/<(ref|excerpt)\b([^>]*)>/g, (all, kind, attrsSrc, offset) => {
    const line = text.slice(0, offset).split("\n").length;
    return `<${kind}${fixTag(kind, attrsSrc, `${rel}:${line}`)}>`;
  });
  if (flag("--write") && next !== text) fs.writeFileSync(f, next);
}

if (flag("--write")) {
  // Rewrite only this source's tag and commit lines, keeping the file's formatting.
  const raw = fs.readFileSync(COURSE, "utf8");
  const start = raw.indexOf(`"${key}": {`);
  const end = raw.indexOf("}", start);
  const block = raw
    .slice(start, end)
    .replace(/"tag": "[^"]*"/, `"tag": "${newTag}"`)
    .replace(/"commit": "[^"]*"/, `"commit": "${newPeeled}"`);
  fs.writeFileSync(COURSE, raw.slice(0, start) + block + raw.slice(end));
}

fs.rmSync(repo, { recursive: true, force: true });
const reportPath = opt("--report");
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  `${key} ${src.tag} → ${newTag}: unchanged ${report.unchanged} · shifted ${report.shifted} · rescued ${report.rescued} · flagged ${report.flagged.length}${flag("--write") ? "" : " (dry run)"}`,
);
for (const x of report.flagged) console.log(`FLAG ${x.where}: ${x.kind} ${x.path}:${x.lines} — ${x.why}`);
