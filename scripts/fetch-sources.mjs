#!/usr/bin/env node
// Shallow-clone every pinned source in course.json into .cache/src/<dir> at its
// exact commit, so the build can verify refs and copy excerpts verbatim.
// Usage: node scripts/fetch-sources.mjs [--only vllm,sglang]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const course = JSON.parse(fs.readFileSync(path.join(ROOT, "course.json"), "utf8"));
const argOnly = process.argv.indexOf("--only");
const only = argOnly > 0 ? new Set(process.argv[argOnly + 1].split(",")) : null;

const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

// Model repos on the Hugging Face Hub: download the listed small files (configs)
// at the pinned revision instead of cloning, so no weights are fetched.
async function fetchHf(key, src, dir) {
  const stamp = path.join(dir, ".pinned");
  const want = `${src.commit} ${src.files.join(",")}`;
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8").trim() === want) {
    console.log(`ok     ${key.padEnd(12)} ${src.tag}`);
    return;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of src.files) {
    const url = `https://huggingface.co/${src.repo}/resolve/${src.commit}/${f}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${key}: ${url} returned ${res.status}`);
    const out = path.join(dir, f);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  }
  fs.writeFileSync(stamp, want + "\n");
  console.log(`fetched ${key.padEnd(11)} ${src.tag} (${src.files.join(", ")})`);
}

for (const [key, src] of Object.entries(course.sources)) {
  if (only && !only.has(key)) continue;
  const dir = path.join(ROOT, ".cache", "src", src.dir || key);
  if (src.host === "hf") {
    await fetchHf(key, src, dir);
    continue;
  }
  if (fs.existsSync(path.join(dir, ".git"))) {
    const head = git(["rev-parse", "HEAD"], dir);
    if (head === src.commit) {
      console.log(`ok     ${key.padEnd(12)} ${src.tag} ${src.commit.slice(0, 7)}`);
      continue;
    }
    console.log(`update ${key.padEnd(12)} ${head.slice(0, 7)} → ${src.commit.slice(0, 7)}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  git(["init", "-q"], dir);
  git(["remote", "add", "origin", `https://github.com/${src.repo}.git`], dir);
  // fetch exactly the pinned commit (GitHub allows fetching reachable SHAs)
  git(["fetch", "-q", "--depth", "1", "origin", src.commit], dir);
  git(["checkout", "-q", "FETCH_HEAD"], dir);
  console.log(`cloned ${key.padEnd(12)} ${src.tag} ${src.commit.slice(0, 7)}`);
}
