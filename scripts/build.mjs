#!/usr/bin/env node
// Build the course into dist/. Zero dependencies: `node scripts/build.mjs`.
//
// Chapters are HTML fragments with a few build-time tags:
//   <ref e="vllm" p="vllm/v1/core/block_pool.py" l="128" s="BlockPool">label</ref>
//   <excerpt e="sglang" p="python/sglang/srt/mem_cache/radix_cache.py" l="210-236" hl="220-224" s="match_prefix" title="…" note="…"></excerpt>
//   <snippet lang="python" title="…">code</snippet>
// Refs and excerpts resolve against shallow clones in .cache/src/<repo> at the
// commits pinned in course.json (run `node scripts/fetch-sources.mjs`). Resolved
// excerpt text is written to src/excerpts.lock.json so a build without clones
// (e.g. CI) still reproduces every excerpt byte for byte.
//
// Flags: --strict  fail on any unverified ref/excerpt (used by `npm run check`)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { highlight, langFor } from "./highlight.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const argOut = process.argv.indexOf("--out");
// --out lets several authors build and preview in parallel without sharing dist/
// --artifact writes a variant for hosts that serve files by exact path (no
// directory index) and wrap the entry page in their own document skeleton
const ARTIFACT = process.argv.includes("--artifact");
const DIST =
  argOut > 0 ? path.resolve(process.argv[argOut + 1]) : path.join(ROOT, ARTIFACT ? "dist-artifact" : "dist");
const STRICT = process.argv.includes("--strict");
// --only 05-blocks-and-pools,06-who-runs builds just those chapters (plus the landing
// page), so one author's half-written chapter never fails another author's build
const argOnly = process.argv.indexOf("--only");
const ONLY = argOnly > 0 ? new Set(process.argv[argOnly + 1].split(",").map((x) => x.trim())) : null;

const course = JSON.parse(fs.readFileSync(path.join(ROOT, "course.json"), "utf8"));
const LOCK_PATH = path.join(SRC, "excerpts.lock.json");
let lock = {};
try {
  if (fs.existsSync(LOCK_PATH)) lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
} catch {
  console.warn("warn  excerpts.lock.json unreadable; rebuilding it from clones");
}
const usedLock = {};
const warnings = [];
const errors = [];
let refCount = 0;
let excerptCount = 0;

/* ---------------------------------------------------------------------------- */
/* helpers                                                                       */
/* ---------------------------------------------------------------------------- */

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function attrs(s) {
  // values may be double- or single-quoted; &quot; and &#39; are decoded so a
  // symbol containing quotes can still be matched against the source
  const out = {};
  for (const m of s.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1]] = (m[2] ?? m[3])
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return out;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(from, to, filter = () => true) {
  if (!fs.existsSync(from)) return;
  mkdirp(to);
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "__pycache__" || ent.name.startsWith(".")) continue;
      copyDir(a, b, filter);
    } else if (filter(a)) {
      fs.copyFileSync(a, b);
    }
  }
}

function engine(key) {
  const e = course.sources[key];
  if (!e) throw new Error(`unknown source "${key}"`);
  return e;
}

function permalink(key, p, a, b) {
  const e = engine(key);
  const frag = a ? (b && b !== a ? `#L${a}-L${b}` : `#L${a}`) : "";
  if (e.host === "hf") return `https://huggingface.co/${e.repo}/blob/${e.commit}/${p}${a ? `#L${a}` : ""}`;
  return `https://github.com/${e.repo}/blob/${e.commit}/${p}${frag}`;
}

function badge(key) {
  const e = engine(key);
  return `<span class="badge badge--${e.channel || "x"}" aria-hidden="true">${esc(e.letter || "·")}</span>`;
}

const fileCache = new Map();
function sourceLines(key, p) {
  const e = engine(key);
  const id = `${key}:${p}`;
  if (fileCache.has(id)) return fileCache.get(id);
  const abs = path.join(ROOT, ".cache", "src", e.dir || key, p);
  let lines = null;
  if (fs.existsSync(abs)) lines = fs.readFileSync(abs, "utf8").split("\n");
  fileCache.set(id, lines);
  return lines;
}

function clonePresent(key) {
  const e = engine(key);
  return fs.existsSync(path.join(ROOT, ".cache", "src", e.dir || key));
}

function shortPath(p) {
  const parts = p.split("/");
  if (p.length <= 52 || parts.length <= 3) return p;
  return "…/" + parts.slice(-3).join("/");
}

function parseRanges(spec) {
  // "120-140,152-160" -> [[120,140],[152,160]]
  return spec.split(",").map((r) => {
    const [a, b] = r.split("-").map((x) => parseInt(x.trim(), 10));
    return [a, Number.isFinite(b) ? b : a];
  });
}

function parseSet(spec) {
  const set = new Set();
  if (!spec) return set;
  for (const [a, b] of parseRanges(spec)) for (let i = a; i <= b; i++) set.add(i);
  return set;
}

/* ---------------------------------------------------------------------------- */
/* build-time tags                                                               */
/* ---------------------------------------------------------------------------- */

function where(ctx) {
  return ctx ? ` (in ${ctx})` : "";
}

function findSymbol(lines, sym) {
  const re = new RegExp(`^\\s*(?:async\\s+)?(?:def|class|fn|func|struct|impl|type|pub\\s+fn|pub\\s+struct|pub\\s+enum)\\s+${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  const re2 = new RegExp(`^\\s*${sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:=]`);
  for (let i = 0; i < lines.length; i++) if (re2.test(lines[i])) return i + 1;
  return null;
}

function renderRef(a, inner, ctx) {
  refCount++;
  const key = a.e;
  const p = a.p;
  const line = a.l ? parseInt(a.l, 10) : null;
  const e = engine(key);
  const lines = sourceLines(key, p);
  if (clonePresent(key)) {
    if (!lines) {
      errors.push(`ref: ${key}:${p} does not exist at ${e.tag}${where(ctx)}`);
    } else if (line && line > lines.length) {
      errors.push(`ref: ${key}:${p}:${line} is past the end of the file (${lines.length} lines)${where(ctx)}`);
    } else if (line && a.s) {
      const win = lines.slice(Math.max(0, line - 3), line + 2).join("\n");
      if (!win.includes(a.s)) {
        const found = findSymbol(lines, a.s);
        errors.push(
          `ref: "${a.s}" not found near ${key}:${p}:${line}${found ? ` (defined at line ${found})` : ""}${where(ctx)}`,
        );
      }
    }
  } else {
    warnings.push(`ref: ${key}:${p} not verified, no clone${where(ctx)}`);
  }
  const base = p.split("/").pop();
  const label = inner && inner.trim() ? inner.trim() : `${esc(base)}${line ? `<span class="ln">:${line}</span>` : ""}`;
  const title = `${p}${line ? ` line ${line}` : ""} at ${e.name} ${e.tag}`;
  return `<a class="ref ref--${e.channel || "x"}" href="${esc(permalink(key, p, line))}" title="${esc(title)}" target="_blank" rel="noopener">${badge(key)}<span>${label}</span></a>`;
}

function renderExcerpt(a, ctx) {
  excerptCount++;
  const key = a.e;
  const p = a.p;
  const e = engine(key);
  const ranges = parseRanges(a.l);
  const hl = parseSet(a.hl);
  const lockKey = `${key}@${e.commit.slice(0, 12)}:${p}#${a.l}`;
  let chunks = null;
  const lines = sourceLines(key, p);
  if (lines) {
    chunks = ranges.map(([x, y]) => {
      if (y > lines.length) errors.push(`excerpt: ${key}:${p}#${x}-${y} past end of file${where(ctx)}`);
      return lines.slice(x - 1, y);
    });
    if (a.s && !chunks.flat().join("\n").includes(a.s)) {
      const found = findSymbol(lines, a.s);
      errors.push(`excerpt: "${a.s}" not in ${key}:${p}#${a.l}${found ? ` (defined at line ${found})` : ""}${where(ctx)}`);
    }
    usedLock[lockKey] = chunks;
  } else if (lock[lockKey]) {
    chunks = lock[lockKey];
    usedLock[lockKey] = chunks;
    if (clonePresent(key)) errors.push(`excerpt: ${key}:${p} missing from clone at ${e.tag}${where(ctx)}`);
  } else {
    errors.push(`excerpt: ${key}:${p}#${a.l} has no clone and no lock entry${where(ctx)}`);
    chunks = ranges.map(() => ["# (excerpt unavailable)"]);
  }
  const lang = a.lang || langFor(p);
  const body = [];
  chunks.forEach((chunk, ci) => {
    if (ci > 0) body.push(`<span class="line gap" data-n="⋮">    …</span>`);
    const html = highlight(chunk.join("\n"), lang);
    html.split("\n").forEach((ln, i) => {
      const n = ranges[ci][0] + i;
      body.push(`<span class="line${hl.has(n) ? " hl" : ""}" data-n="${n}">${ln || " "}</span>`);
    });
  });
  const [a0] = ranges[0];
  const b1 = ranges[ranges.length - 1][1];
  const head = `<figcaption class="code__head">${badge(key)}<a class="code__path" href="${esc(
    permalink(key, p, a0, b1),
  )}" target="_blank" rel="noopener" title="${esc(p)} at ${esc(e.name)} ${esc(e.tag)}">${esc(shortPath(p))}</a><span class="code__meta"><span>L${a0}–${b1}</span><span>${esc(
    e.tag,
  )}</span></span></figcaption>`;
  const title = a.title ? `<div class="code__title">${a.title}</div>` : "";
  const note = a.note ? `<div class="code__note">${a.note}</div>` : "";
  const cls = a.class ? ` ${a.class}` : "";
  return `<figure class="code${cls}" data-src="${esc(key)}">${head}${title}<pre><code>${body.join("")}</code></pre>${note}</figure>`;
}

function renderSnippet(a, code) {
  const lang = a.lang || "text";
  let src = code.replace(/^\n+|\s+$/g, "");
  // dedent
  const ind = Math.min(...src.split("\n").filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  if (Number.isFinite(ind) && ind > 0) src = src.split("\n").map((l) => l.slice(ind)).join("\n");
  src = src.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const html = highlight(src, lang);
  const body = html
    .split("\n")
    .map((ln) => `<span class="line">${ln || " "}</span>`)
    .join("");
  const head = a.title
    ? `<figcaption class="code__head"><span class="badge badge--x" aria-hidden="true">${esc(a.badge || "$")}</span><span class="code__path">${a.title}</span>${
        a.meta ? `<span class="code__meta">${esc(a.meta)}</span>` : ""
      }</figcaption>`
    : "";
  const cls = a.class ? ` ${a.class}` : "";
  return `<figure class="code code--plain${cls}">${head}<pre><code>${body}</code></pre></figure>`;
}

// attribute values may contain markup (e.g. title="<code>x</code>"), so match
// name="value" pairs instead of "anything up to the next >"
const ATTRS = String.raw`((?:\s+[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*`;
const RE_SNIPPET = new RegExp(String.raw`<snippet${ATTRS}>([\s\S]*?)<\/snippet>`, "g");
const RE_EXCERPT = new RegExp(String.raw`<excerpt${ATTRS}(?:\/>|>\s*<\/excerpt>)`, "g");
const RE_REF = new RegExp(String.raw`<ref${ATTRS}(?:\/>|>([\s\S]*?)<\/ref>)`, "g");

function expandTags(html, ctx) {
  html = html.replace(RE_SNIPPET, (_, at, code) => renderSnippet(attrs(at), code));
  html = html.replace(RE_EXCERPT, (_, at) => renderExcerpt(attrs(at), ctx));
  html = html.replace(RE_REF, (_, at, inner) => renderRef(attrs(at), inner, ctx));
  return html;
}

/* ---------------------------------------------------------------------------- */
/* layout                                                                        */
/* ---------------------------------------------------------------------------- */

const chapters = [];
for (const part of course.parts) {
  for (const ch of part.chapters) chapters.push({ ...ch, part });
}
const ready = (ch) => fs.existsSync(path.join(SRC, "chapters", ch.slug, "index.html"));

const MARK = `<svg viewBox="0 0 30 22" aria-hidden="true"><path d="M1 6h5l2-4h6l2 4h13" fill="none" stroke="var(--a)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M1 16h9l2 4h5l2-4h10" fill="none" stroke="var(--b)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#14181d"/><path d="M4 11h6l2-4h6l2 4h8" fill="none" stroke="#7ea5ff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M4 21h9l2 4h4l2-4h7" fill="none" stroke="#f0a24a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  );

const ICONS = {
  menu: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 5h12M3 9h12M3 13h12"/></svg>',
  theme:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="9" r="6.2"/><path d="M9 2.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor" stroke="none"/></svg>',
  github:
    '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2z"/></svg>',
  search:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8" cy="8" r="5.2"/><path d="m12 12 3.5 3.5"/></svg>',
  tick: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 7.4 2.6 2.4L11 4.4"/></svg>',
};

function revChip() {
  const t = course.sources["hf-transformers"];
  const n = Object.values(course.sources).filter((s) => s.host === "hf").length;
  return `<span class="rev-chip" title="Every reference is pinned to these revisions"><span class="ch">${badge("hf-transformers")}<b>${esc(t.tag)}</b></span><span class="ch"><b>${n} roster configs</b></span></span>`;
}

function rail(rel, currentSlug, sections = []) {
  const parts = course.parts
    .map((part) => {
      const items = part.chapters
        .map((ch) => {
          const isReady = ready(ch);
          const cur = ch.slug === currentSlug ? ' aria-current="page"' : "";
          const href = isReady ? `${rel}ch/${ch.slug}/` : `${rel}#map`;
          // the open chapter lists its sections under its own entry, for navigation while reading
          const secs =
            cur && sections.length
              ? `<ol class="rail__sections" aria-label="Sections of this chapter">${sections
                  .map((s) => `<li><a href="#${s.id}"><span class="n">${s.num}</span><span class="t">${s.title}</span></a></li>`)
                  .join("")}</ol>`
              : "";
          return `<li><a href="${href}" data-slug="${ch.slug}"${cur}${isReady ? "" : ' aria-disabled="true" class="is-soon"'}><span class="n">${String(
            ch.num,
          ).padStart(2, "0")}</span><span class="t">${esc(ch.title)}</span><span class="tick">${ICONS.tick}</span></a>${secs}</li>`;
        })
        .join("");
      return `<section class="rail__part"><div class="rail__part-head"><span class="roman">${esc(part.num)}</span><span class="label">${esc(
        part.title,
      )}</span></div><ol>${items}</ol></section>`;
    })
    .join("");
  return `<nav class="rail" aria-label="Course chapters">${parts}<div class="rail__foot"><a href="${rel}ch/00-model-basics/">Start here</a><a href="${rel}compare/">Every spec sheet at a glance</a><a href="${rel}timeline/">Timeline</a><a href="${rel}zoo/">Attention zoo</a><a href="${rel}glossary/">Glossary</a><a href="${rel}hardware/">Hardware</a><a href="${rel}capstones/">GPU capstones</a><a href="${rel}contribute/">From reader to contributor</a><a href="${rel}method/">How this course is checked</a></div></nav>`;
}

function topbar(rel, crumbs) {
  const gh = course.site.repoUrl
    ? `<a class="icon-btn" href="${esc(course.site.repoUrl)}" target="_blank" rel="noopener" aria-label="Course source on GitHub" title="Course source on GitHub">${ICONS.github}</a>`
    : "";
  const crumbHtml = crumbs?.length
    ? `<div class="crumbs">${crumbs.map((c, i) => `${i ? '<span class="sep">/</span>' : ""}<span>${esc(c)}</span>`).join("")}</div>`
    : "";
  return `<a class="skip" href="#main">Skip to content</a><header class="topbar"><button class="icon-btn menu-btn" type="button" data-menu aria-expanded="false" aria-label="Chapters">${ICONS.menu}</button><a class="wordmark" href="${rel}" aria-label="${esc(
    course.site.title,
  )}, home">${MARK}<span>${esc(course.site.title)}</span></a>${crumbHtml}<div class="topbar__spacer"></div><div class="topbar__tools"><button class="search-btn" type="button" data-search data-root="${rel}" aria-label="Search the course">${ICONS.search}<span>Search</span><kbd>/</kbd></button>${revChip()}<button class="icon-btn" type="button" data-theme-toggle aria-label="Switch theme">${ICONS.theme}</button>${gh}</div></header>`;
}

function head({ title, description, rel, extraHead = "" }) {
  const fullTitle = title ? `${title} · ${course.site.title}` : course.site.title;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || course.site.description)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || course.site.description)}">
<meta property="og:type" content="article">
${course.site.url ? `<meta property="og:image" content="${esc(course.site.url.replace(/\/?$/, "/"))}assets/img/og.png">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<meta name="theme-color" content="#f3f5f6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1114" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${FAVICON}">
<script>try{var t=JSON.parse(localStorage.getItem("te-theme"));if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=JetBrains+Mono:ital,wght@0,400..700;1,400..700&family=Source+Serif+4:ital,opsz,wght@0,8..60,300..800;1,8..60,300..800&display=swap">
<link rel="stylesheet" href="${rel}assets/site.css">
${extraHead}
</head>`;
}

function scriptsFor(html, rel, chapterDir) {
  const s = [`<script type="module" src="${rel}assets/js/site.js"></script>`];
  if (/class="q[\s"]/.test(html)) s.push(`<script type="module" src="${rel}assets/js/quiz.js"></script>`);
  if (/class="lab[\s"]/.test(html)) s.push(`<script type="module" src="${rel}assets/js/lab.js"></script>`);
  if (chapterDir) {
    for (const f of fs.readdirSync(chapterDir).filter((f) => f.endsWith(".js")).sort()) {
      s.push(`<script type="module" src="./${f}"></script>`);
    }
  }
  return s.join("\n");
}

function revBlock() {
  const t = course.sources["hf-transformers"];
  const n = Object.values(course.sources).filter((s) => s.host === "hf").length;
  return `<div class="revblock" role="group" aria-label="Pinned sources"><div><span class="k">Code at</span><a href="https://github.com/${t.repo}/tree/${t.commit}" target="_blank" rel="noopener">Transformers ${esc(
    t.tag,
  )}</a></div><div><span class="k">Commit</span><span>${t.commit.slice(0, 7)}</span></div><div><span class="k">Models</span><span>${n} pinned configs</span></div><div><span class="k">Checked</span><span>${esc(course.site.checked)}</span></div></div>`;
}

function chapterHead(ch, sections) {
  const pills = [`<span class="pill">${ch.minutes || 25} min</span>`];
  if (ch.lab) pills.push(`<span class="pill">Lab</span>`);
  const map = sections.length
    ? `<nav class="ch-map" aria-label="In this chapter">${sections.map((s) => `<a href="#${s.id}">${s.title}</a>`).join("")}</nav>`
    : "";
  return `<header class="ch-head"><div class="ch-head__eyebrow"><span class="label">Part ${esc(ch.part.num)} · ${esc(
    ch.part.title,
  )}</span>${pills.join("")}</div><h1><span class="ch-head__num">Chapter ${String(ch.num).padStart(2, "0")}</span>${esc(
    ch.title,
  )}</h1><p class="ch-head__dek">${ch.dek}</p>${revBlock()}${map}</header>`;
}

function pager(rel, idx) {
  const prev = chapters.slice(0, idx).reverse().find(ready);
  const next = chapters.slice(idx + 1).find(ready);
  const p = prev
    ? `<a class="prev" href="${rel}ch/${prev.slug}/"><span class="label">← Chapter ${String(prev.num).padStart(2, "0")}</span><span class="t">${esc(prev.title)}</span></a>`
    : `<a class="prev" href="${rel}"><span class="label">← Course map</span><span class="t">${esc(course.site.title)}</span></a>`;
  const n = next
    ? `<a class="next" href="${rel}ch/${next.slug}/"><span class="label">Chapter ${String(next.num).padStart(2, "0")} →</span><span class="t">${esc(next.title)}</span></a>`
    : "";
  return `<nav class="pager" aria-label="Chapter navigation">${p}${n}</nav>`;
}

function nextQuestion(rel, idx) {
  const ch = chapters[idx];
  const next = chapters[idx + 1];
  if (!next) return "";
  const q = ch.closing || next.question;
  const link = ready(next)
    ? `<a href="${rel}ch/${next.slug}/">Chapter ${String(next.num).padStart(2, "0")}: ${esc(next.title)} →</a>`
    : `<span class="label">Chapter ${String(next.num).padStart(2, "0")}: ${esc(next.title)} · in progress</span>`;
  return `<aside class="nextq"><span class="label">The next question</span><p class="nextq__q">${q}</p>${link}</aside>`;
}

function footer(rel) {
  const t = course.sources["hf-transformers"];
  const n = Object.values(course.sources).filter((s) => s.host === "hf").length;
  return `<footer class="site-foot"><span>${esc(course.site.title)}: ${esc(course.site.tagline)}</span><span>Pinned to Transformers ${esc(t.tag)} and ${n} roster model configs, checked ${esc(
    course.site.checked,
  )}.</span><span>Not affiliated with any model provider.</span><span>Text <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener license">CC BY 4.0</a> · code Apache-2.0</span><a href="${rel}method/">Method</a></footer>`;
}

function sectionsOf(html) {
  const out = [];
  for (const m of html.matchAll(/<h2\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
    const title = m[2].replace(/<span class="h-num">[\s\S]*?<\/span>/, "").replace(/<[^>]+>/g, "").trim();
    const num = (m[2].match(/<span class="h-num">([\s\S]*?)<\/span>/)?.[1] ?? "").trim();
    out.push({ id: m[1], title, num });
  }
  return out;
}

/* ---------------------------------------------------------------------------- */
/* pages                                                                          */
/* ---------------------------------------------------------------------------- */

function writePage(rel, file, html) {
  const out = path.join(DIST, rel, file);
  mkdirp(path.dirname(out));
  if (ARTIFACT) {
    // explicit index.html on every relative link that ends in a directory
    html = html.replace(/href="((?:\.\.\/|\.\/)*[\w./-]*\/)(#[\w.~-]*)?"/g, (m, p, frag) =>
      /^https?:/.test(p) ? m : `href="${p}index.html${frag || ""}"`,
    );
    html = html.replace(/href="(#[\w.~-]*)?"/g, (m, frag) => (rel === "" && frag === undefined ? 'href="index.html"' : m));
    html = html.replace(/href=""/g, 'href="index.html"');
    html = html.replace(/href="(\.\.\/)+"/g, (m) => m.slice(0, -1) + 'index.html"');
    if (rel === "") {
      // the entry page is wrapped by the host: keep head content, drop the outer tags
      html = html
        .replace(/<!doctype html>\s*<html lang="en">\s*<head>/, "")
        .replace("</head>", "")
        .replace(/<body class="([^"]*)">/, '<div class="$1 artifact-body">')
        .replace(/<\/body>\s*<\/html>\s*$/, "</div>\n");
    }
  }
  fs.writeFileSync(out, html);
}

function fill(body, rel) {
  // {{<source>.tag}}, {{<source>.commit}}, {{<source>.name}} for any pinned source
  body = body.replace(/\{\{([\w-]+)\.(tag|commit|short|name)\}\}/g, (m, key, field) => {
    const src = course.sources[key];
    if (!src) return m;
    return esc(field === "short" ? src.commit.slice(0, 7) : src[field]);
  });
  return body
    .replaceAll("{{vllm.tag}}", esc(course.sources.vllm.tag))
    .replaceAll("{{sglang.tag}}", esc(course.sources.sglang.tag))
    .replaceAll("{{vllm.commit}}", esc(course.sources.vllm.commit))
    .replaceAll("{{sglang.commit}}", esc(course.sources.sglang.commit))
    .replaceAll("{{checked}}", esc(course.site.checked))
    // the course's own repository, so pages can link bench/, scripts/ and research/
    .replaceAll("{{repo}}", esc((course.site.repoUrl || "").replace(/\/+$/, "")))
    .replaceAll("{{first}}", `${rel}ch/${chapters.find(ready)?.slug || ""}/`)
    .replaceAll("{{count}}", String(chapters.length))
    .replaceAll("{{ready}}", String(chapters.filter(ready).length));
}

function buildChapter(ch, idx) {
  const dir = path.join(SRC, "chapters", ch.slug);
  const raw = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const body = fill(expandTags(raw, `chapter ${ch.slug}`), "../../");
  const rel = "../../";
  const sections = sectionsOf(body);
  const extraHead = fs.existsSync(path.join(dir, "style.css")) ? `<link rel="stylesheet" href="./style.css">` : "";
  const html = `${head({ title: ch.title, description: ch.description || ch.dek.replace(/<[^>]+>/g, ""), rel, extraHead })}
<body data-chapter="${ch.slug}">
${topbar(rel, [`Part ${ch.part.num} · ${ch.part.title}`, `${String(ch.num).padStart(2, "0")} ${ch.title}`])}
<div class="scrim"></div>
<div class="shell">
${rail(rel, ch.slug, sections)}
<main class="content" id="main">
<article class="article">
${chapterHead(ch, sections)}
${body}
${nextQuestion(rel, idx)}
${pager(rel, idx)}
${footer(rel)}
</article>
</main>
</div>
${scriptsFor(body, rel, dir)}
</body>
</html>
`;
  writePage(`ch/${ch.slug}`, "index.html", html);
  // chapter-local assets
  for (const f of fs.readdirSync(dir)) {
    if (f === "index.html") continue;
    const a = path.join(dir, f);
    if (fs.statSync(a).isFile()) fs.copyFileSync(a, path.join(DIST, "ch", ch.slug, f));
  }
}

function courseMap(rel) {
  return course.parts
    .map((part) => {
      const cards = part.chapters
        .map((ch) => {
          const isReady = ready(ch);
          const tags = [ch.lab ? `<span class="tag">Lab</span>` : "", isReady ? "" : `<span class="tag tag--soon">In progress</span>`].join("");
          const inner = `<span class="card__n">${String(ch.num).padStart(2, "0")}</span><span class="card__body"><span class="title">${esc(
            ch.title,
          )}</span><span class="card__q">${ch.question}</span></span><span class="card__tags">${tags}</span>`;
          return `<li class="card${isReady ? "" : " is-soon"}" data-card-slug="${ch.slug}">${
            isReady ? `<a href="${rel}ch/${ch.slug}/">${inner}</a>` : `<div>${inner}</div>`
          }</li>`;
        })
        .join("");
      return `<section class="part" id="part-${part.id}"><header class="part__head"><span class="part__num">Part ${esc(part.num)}</span><h3>${esc(
        part.title,
      )}</h3><p>${part.dek}</p></header><ol class="cards">${cards}</ol></section>`;
    })
    .join("");
}

// every chapter's spec sheets, gathered for the comparison page
function sheetsIndex(rel) {
  const parts = [];
  for (const ch of chapters) {
    if (!ready(ch)) continue;
    const raw = fs.readFileSync(path.join(SRC, "chapters", ch.slug, "index.html"), "utf8");
    const sheets = [...raw.matchAll(/<div class="sheet[^"]*">[\s\S]*?<\/table>\s*<\/div>/g)].map((m) => m[0]);
    if (!sheets.length) continue;
    // sheets link relative to their chapter; re-point them from the compare page
    const html = expandTags(sheets.join("\n"), `compare ${ch.slug}`)
      .replace(/href="\.\.\/(\d{2}-[a-z0-9-]+\/)/g, `href="${rel}ch/$1`)
      .replace(/href="#([\w.~-]+)"/g, `href="${rel}ch/${ch.slug}/#$1"`);
    parts.push(
      `<h2 id="ch-${ch.num}"><span class="h-num">${String(ch.num).padStart(2, "0")}</span><a href="${rel}ch/${ch.slug}/">${esc(ch.title)}</a></h2>${html}`,
    );
  }
  return parts.join("\n") || "<p>No spec sheets yet.</p>";
}

function buildPage(name, opts) {
  const file = path.join(SRC, "pages", `${name}.html`);
  const raw = fs.readFileSync(file, "utf8");
  const rel = opts.rel;
  let body = expandTags(raw, `page ${name}`);
  body = body.replace("<course-map></course-map>", courseMap(rel));
  body = body.replace("<rev-block></rev-block>", revBlock());
  if (body.includes("<sheets-index></sheets-index>")) body = body.replace("<sheets-index></sheets-index>", sheetsIndex(rel));
  body = fill(body, rel);
  const pageDir = path.join(SRC, "pages", name);
  // a page may carry its own small stylesheet, as a chapter does
  const extraHead = fs.existsSync(path.join(pageDir, "style.css")) ? `<link rel="stylesheet" href="./style.css">` : "";
  const html = `${head({ title: opts.title, description: opts.description, rel, extraHead })}
<body class="page-${name}">
${topbar(rel, opts.crumbs)}
<div class="scrim"></div>
<div class="shell${opts.rail ? "" : " shell--bare"}">
${opts.rail ? rail(rel, null) : ""}
<main class="content" id="main">
${opts.article === false ? body : `<article class="article">${body}${footer(rel)}</article>`}
</main>
</div>
${scriptsFor(body, rel, fs.existsSync(pageDir) ? pageDir : null)}
</body>
</html>
`;
  writePage(opts.out, "index.html", html);
  if (fs.existsSync(pageDir)) copyDir(pageDir, path.join(DIST, opts.out));
}

/* ---------------------------------------------------------------------------- */
/* run                                                                            */
/* ---------------------------------------------------------------------------- */

rmrf(DIST);
mkdirp(DIST);

// css: concatenate in cascade order
const cssOrder = ["tokens.css", "base.css", "layout.css", "codemirror.css", "components.css", "instrument.css", "pages.css"];
const css = cssOrder
  .filter((f) => fs.existsSync(path.join(SRC, "assets/css", f)))
  .map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(SRC, "assets/css", f), "utf8"))
  .join("\n");
mkdirp(path.join(DIST, "assets"));
fs.writeFileSync(path.join(DIST, "assets/site.css"), css);
copyDir(path.join(SRC, "assets/js"), path.join(DIST, "assets/js"));
copyDir(path.join(SRC, "assets/img"), path.join(DIST, "assets/img"));

// labs (python sources + manifests) for the in-browser runner
copyDir(path.join(ROOT, "labs"), path.join(DIST, "labs"), (f) => /\.(py|json|md)$/.test(f));

chapters.forEach((ch, i) => {
  if (ready(ch) && (!ONLY || ONLY.has(ch.slug))) buildChapter(ch, i);
});

buildPage("index", { rel: "", out: "", rail: false, article: false, title: "", description: course.site.description });
const EXTRA_PAGES = {
  method: ["How this course is checked", "Method"],
  glossary: ["Glossary", "Glossary"],
  hardware: ["Hardware the course covers", "Hardware"],
  compare: ["Every spec sheet at a glance", "At a glance"],
  timeline: ["Every architecture, year by year", "Timeline"],
  zoo: ["The attention zoo", "Zoo"],
  capstones: ["GPU capstones", "Capstones"],
  contribute: ["From reader to contributor", "Contribute"],
};
for (const [extra, [title, crumb]] of Object.entries(EXTRA_PAGES)) {
  if (fs.existsSync(path.join(SRC, "pages", `${extra}.html`))) {
    buildPage(extra, { rel: "../", out: extra, rail: true, title, crumbs: [crumb] });
  }
}
if (fs.existsSync(path.join(SRC, "pages", "404.html"))) {
  const raw = fs.readFileSync(path.join(SRC, "pages", "404.html"), "utf8");
  fs.writeFileSync(path.join(DIST, "404.html"), raw);
}
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
fs.writeFileSync(
  path.join(DIST, "course.json"),
  JSON.stringify({ site: course.site, sources: course.sources, parts: course.parts }, null, 1),
);

// search index: chapter titles, questions and section headings
const searchIndex = [];
for (const ch of chapters) {
  if (!ready(ch)) continue;
  const raw = fs.readFileSync(path.join(SRC, "chapters", ch.slug, "index.html"), "utf8");
  const page = ARTIFACT ? "index.html" : "";
  searchIndex.push({ t: ch.title, s: ch.question.replace(/<[^>]+>/g, ""), u: `ch/${ch.slug}/${page}`, n: ch.num, k: "chapter" });
  for (const m of raw.matchAll(/<h2\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
    const title = m[2].replace(/<span class="h-num">[\s\S]*?<\/span>/, "").replace(/<[^>]+>/g, "").trim();
    searchIndex.push({ t: title, s: ch.title, u: `ch/${ch.slug}/${page}#${m[1]}`, n: ch.num, k: "section" });
  }
}
const glossFile = path.join(SRC, "pages", "glossary.html");
if (fs.existsSync(glossFile)) {
  for (const m of fs.readFileSync(glossFile, "utf8").matchAll(/<dt id="([^"]+)">([\s\S]*?)<\/dt>/g)) {
    searchIndex.push({ t: m[2].replace(/<[^>]+>/g, "").trim(), s: "Glossary", u: `glossary/${ARTIFACT ? "index.html" : ""}#${m[1]}`, k: "term" });
  }
}
fs.writeFileSync(path.join(DIST, "search.json"), JSON.stringify(searchIndex));

// lockfile: keep exactly the excerpts the course uses
const sortedLock = Object.fromEntries(Object.keys(usedLock).sort().map((k) => [k, usedLock[k]]));
const lockText = JSON.stringify(sortedLock, null, 1) + "\n";
if (!ONLY && Object.keys(usedLock).length && (!fs.existsSync(LOCK_PATH) || fs.readFileSync(LOCK_PATH, "utf8") !== lockText)) {
  // merge with entries other concurrent builds may have written, then swap in atomically
  let current = {};
  try {
    current = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  } catch {
    current = {};
  }
  const merged = { ...current, ...sortedLock };
  const keep = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
  const tmp = `${LOCK_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(keep, null, 1) + "\n");
  fs.renameSync(tmp, LOCK_PATH);
}

const built = chapters.filter((ch) => ready(ch) && (!ONLY || ONLY.has(ch.slug))).length;
console.log(`built ${built}/${chapters.length} chapters · ${refCount} refs · ${excerptCount} excerpts → ${path.relative(ROOT, DIST) || DIST}/`);
for (const w of warnings.slice(0, 20)) console.warn("warn  " + w);
if (warnings.length > 20) console.warn(`warn  … ${warnings.length - 20} more`);
for (const e of errors) console.error("ERROR " + e);
if (errors.length && STRICT) process.exit(1);
if (errors.length) console.error(`${errors.length} error(s); run with --strict to fail the build`);
