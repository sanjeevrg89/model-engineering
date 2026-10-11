#!/usr/bin/env node
// Weekly drift check. For every pinned GitHub source with a newer stable
// release, carry the course's refs across with repin.mjs, then run the strict
// build against the new pins and write a Markdown report to drift.md.
// Exits 0 either way; writes "drifted=true|false" to $GITHUB_OUTPUT when set.
// Usage: node scripts/drift.mjs [--sources vllm,sglang]

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const course = JSON.parse(fs.readFileSync(path.join(ROOT, "course.json"), "utf8"));
const argSources = process.argv.indexOf("--sources");
const only = argSources > 0 ? new Set(process.argv[argSources + 1].split(",")) : null;

const node = (script, argv) => execFileSync(process.execPath, [path.join(ROOT, "scripts", script), ...argv], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 30 }).toString();
const semver = (tag) => tag?.match(/^v(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number) ?? null;
const newer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const rows = [];
const flagged = [];
for (const [key, src] of Object.entries(course.sources)) {
  if (only && !only.has(key)) continue;
  if (src.host && src.host !== "github") continue;
  const pinned = semver(src.tag);
  if (!pinned) continue; // branch or rc pins are reviewed by hand
  let latest;
  try {
    latest = node("repin.mjs", ["--latest", key]).trim();
  } catch (e) {
    rows.push(`| ${src.name} | ${src.tag} | lookup failed | | | |`);
    continue;
  }
  const v = semver(latest);
  if (!v || newer(v, pinned) <= 0) continue;
  const reportFile = path.join(os.tmpdir(), `drift-${key}.json`);
  try {
    node("repin.mjs", [key, latest, "--write", "--report", reportFile]);
    const r = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    rows.push(`| ${src.name} | ${src.tag} | ${latest} | ${r.unchanged} | ${r.shifted + r.rescued} | ${r.flagged.length} |`);
    for (const f of r.flagged) flagged.push(`- **${src.name}** \`${f.where}\`: ${f.kind} \`${f.path}:${f.lines}\` (${f.why})`);
  } catch (e) {
    rows.push(`| ${src.name} | ${src.tag} | ${latest} | remap failed: ${String(e.message).split("\n")[0]} | | |`);
  }
}

const drifted = rows.length > 0;
let body = `## Engine drift check, ${new Date().toISOString().slice(0, 10)}\n\n`;
if (!drifted) {
  body += "Every pinned source is on its newest stable release.\n";
} else {
  // Build against the moved pins so the report shows what still breaks.
  const fetch = spawnSync(process.execPath, [path.join(ROOT, "scripts", "fetch-sources.mjs")], { cwd: ROOT, encoding: "utf8" });
  const out = path.join(os.tmpdir(), "drift-site");
  const build = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs"), "--strict", "--out", out], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });
  const errors = `${build.stdout}\n${build.stderr}`.split("\n").filter((l) => l.startsWith("ERROR") && !l.includes("(in compare"));
  body += "| Source | Pinned | Newest | Refs unchanged | Refs moved | Need a read |\n|---|---|---|---|---|---|\n" + rows.join("\n") + "\n\n";
  body += flagged.length ? `### References on rewritten code\n\nRead each one against the new release. If the code changed what a chapter teaches, patch that chapter before the next edition.\n\n${flagged.join("\n")}\n\n` : "";
  body += `### Strict build after the remap\n\n${fetch.status === 0 ? "" : "Fetching the new pins failed, so the build ran against stale clones.\n\n"}`;
  body += errors.length ? `${errors.length} error(s):\n\n\`\`\`\n${errors.slice(0, 80).join("\n")}\n\`\`\`\n\n` : "No errors.\n\n";
  body +=
    "### Apply locally\n\n```sh\n" +
    rows
      .map((r) => r.split("|").map((c) => c.trim()))
      .filter((c) => semver(c[3]))
      .map((c) => `node scripts/repin.mjs ${Object.keys(course.sources).find((k) => course.sources[k].name === c[1])} ${c[3]} --write`)
      .join("\n") +
    "\nnode scripts/fetch-sources.mjs\nnode scripts/build.mjs --strict\n```\n\n" +
    "Editions ship every 8 weeks. Patch sooner when a flagged reference changes a default or behavior the course describes.\n";
}

fs.writeFileSync(path.join(ROOT, "drift.md"), body);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `drifted=${drifted}\n`);
console.log(body);
