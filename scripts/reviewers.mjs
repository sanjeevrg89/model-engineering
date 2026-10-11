#!/usr/bin/env node
// Who owns the code each chapter cites. For every chapter, count the vLLM and
// SGLang files its <ref> and <excerpt> tags point at, resolve each file's owners
// from that engine's CODEOWNERS at the pinned commit (the last matching pattern
// wins, as on GitHub), and print the owners weighted by citations. Use it to
// pick technical reviewers for an edition.
// Usage: node scripts/reviewers.mjs [--top 3] [--json] [--only 06-who-runs,07-prefix-reuse]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const course = JSON.parse(fs.readFileSync(path.join(ROOT, "course.json"), "utf8"));
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const TOP = Number(opt("--top", 3));
const ONLY = opt("--only", "") ? new Set(opt("--only", "").split(",")) : null;
const ENGINES = ["vllm", "sglang"];

// CODEOWNERS patterns follow gitignore rules: a leading or inner slash anchors the
// pattern at the repository root, "*" stays inside one path segment, "**" crosses
// segments, and a pattern that names a directory covers everything below it.
function toRegex(pattern) {
  const anchored = pattern.startsWith("/") || pattern.replace(/\/$/, "").includes("/");
  const body = pattern
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .split(/(\*\*|\*|\?)/)
    .map((part) => (part === "**" ? ".*" : part === "*" ? "[^/]*" : part === "?" ? "[^/]" : part.replace(/[.+^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`^${anchored ? "" : "(?:.*/)?"}${body}(?:/.*)?$`);
}

function codeowners(engine) {
  const file = path.join(ROOT, ".cache/src", course.sources[engine].dir || engine, ".github/CODEOWNERS");
  if (!fs.existsSync(file)) throw new Error(`missing ${path.relative(ROOT, file)}: run node scripts/fetch-sources.mjs --only ${engine}`);
  const rules = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const text = line.replace(/#.*/, "").trim();
    if (!text) continue;
    const [pattern, ...owners] = text.split(/\s+/);
    rules.push({ re: toRegex(pattern), owners: owners.filter((o) => o.startsWith("@")) });
  }
  return (p) => {
    let hit = null;
    for (const r of rules) if (r.re.test(p)) hit = r;
    return hit ? hit.owners : [];
  };
}

const ownersOf = Object.fromEntries(ENGINES.map((e) => [e, codeowners(e)]));
const chapters = course.parts.flatMap((part) => part.chapters).filter((ch) => !ONLY || ONLY.has(ch.slug));
const report = [];
for (const ch of chapters) {
  const file = path.join(ROOT, "src/chapters", ch.slug, "index.html");
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  const row = { slug: ch.slug, title: ch.title };
  for (const e of ENGINES) {
    const files = new Map();
    for (const m of html.matchAll(/<(?:ref|excerpt)\b([^>]*)>/g)) {
      const a = Object.fromEntries([...m[1].matchAll(/(\w+)=("([^"]*)"|'([^']*)')/g)].map((x) => [x[1], x[3] ?? x[4]]));
      if (a.e === e && a.p) files.set(a.p, (files.get(a.p) || 0) + 1);
    }
    const owners = new Map();
    let unowned = 0;
    for (const [p, n] of files) {
      const os = ownersOf[e](p);
      if (!os.length) unowned += n;
      for (const o of os) owners.set(o, (owners.get(o) || 0) + n);
    }
    const cites = [...files.values()].reduce((s, n) => s + n, 0);
    row[e] = {
      cites,
      unowned,
      owners: [...owners].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, TOP),
      files: [...files].sort((x, y) => y[1] - x[1]).slice(0, 2),
    };
  }
  report.push(row);
}

if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 1));
} else {
  const cell = (r) =>
    r.cites
      ? `${r.owners.map(([o, n]) => `${o} (${n})`).join(", ") || "no owner listed"}; ${r.cites} cites${r.unowned ? `, ${r.unowned} unowned` : ""}`
      : "";
  console.log(`| Chapter | vLLM ${course.sources.vllm.tag} owners (cites) | SGLang ${course.sources.sglang.tag} owners (cites) |`);
  console.log("|---|---|---|");
  for (const r of report) console.log(`| ${r.slug} | ${cell(r.vllm)} | ${cell(r.sglang)} |`);
}
