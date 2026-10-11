#!/usr/bin/env node
// Run every lab's tests against its reference solution inside Pyodide, the same
// Python the browser labs use. CPython can pass code that Pyodide can't run (for
// example very deep recursion), so CI checks both.
// Usage: npm install --no-save pyodide@314.0.7 && node scripts/check-labs-pyodide.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LABS = path.join(ROOT, "labs");
const { loadPyodide } = await import("pyodide");

// reuse the exact runner the browser uses
const labJs = fs.readFileSync(path.join(ROOT, "src/assets/js/lab.js"), "utf8");
const RUNNER = labJs.match(/const RUNNER = String\.raw`([\s\S]*?)`;/)[1];

const py = await loadPyodide();
let failed = 0;
for (const dir of fs.readdirSync(LABS).sort()) {
  const manifestPath = path.join(LABS, dir, "lab.json");
  if (!fs.existsSync(manifestPath)) continue;
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  py.runPython("import shutil, os\nshutil.rmtree('/lab', ignore_errors=True)\nos.makedirs('/lab', exist_ok=True)");
  const files = {};
  for (const p of m.support || []) files[p] = fs.readFileSync(path.join(LABS, p), "utf8");
  files[m.test] = fs.readFileSync(path.join(LABS, dir, m.test), "utf8");
  files[m.file] = fs.readFileSync(path.join(LABS, dir, m.solution), "utf8");
  for (const [p, text] of Object.entries(files)) {
    const full = "/lab/" + p;
    py.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
    py.FS.writeFile(full, text);
  }
  const t0 = Date.now();
  let res;
  try {
    res = JSON.parse(await py.runPythonAsync(RUNNER.replace("__TEST_MODULE__", JSON.stringify(m.test.replace(/\.py$/, "")))));
  } catch (err) {
    failed += 1;
    console.log(`FAIL ${dir}: the runner crashed: ${String(err.message || err).split("\n").slice(-2).join(" ")}`);
    continue;
  }
  const bad = res.results.filter((r) => !r.ok);
  const ms = Date.now() - t0;
  if (bad.length || !res.results.length) {
    failed += 1;
    console.log(`FAIL ${dir}: ${bad.length} of ${res.results.length} tests fail (${ms} ms)`);
    for (const b of bad) console.log(`     ${b.name}: ${b.msg}`);
  } else {
    console.log(`ok   ${dir}: ${res.results.length} tests (${ms} ms)`);
  }
}
if (failed) {
  console.log(`${failed} lab(s) failed in Pyodide`);
  process.exit(1);
}
