# Figure and lab checks

Headless browser checks the chapter authors and reviewers run. They are not needed to build the site.

```bash
npm --prefix tools/figcheck install && npx --prefix tools/figcheck playwright install chromium
node scripts/build.mjs --strict --only <slug> --out /tmp/te-<you>
node scripts/serve.mjs <port> /tmp/te-<you> &
node tools/figcheck/steps.mjs /ch/<slug>/ "#fig-N-M" <prefix> --port=<port> [--dark] [--w=390] [--set=param:value]
node tools/figcheck/shoot.mjs /ch/<slug>/ <name> --port=<port> [--w=390] [--dark] [--full]
node tools/figcheck/labrun.mjs /ch/<slug>/ "#lab-N" solution <port> <outdir>
PORT=<port> node tools/figcheck/smoke.mjs <slug> [<slug> ...]
node tools/figcheck/textcheck.mjs [<slug> | /page/ ...] --port=<port> [--params]
```

- `steps.mjs` steps through every step of one scope, screenshots each, and prints the caption, Δ strip and notes. It reports overlapping, clipped or sub-10.5 px SVG text in each channel.
- `shoot.mjs` screenshots a page or element, and prints console errors and the page's scroll width.
- `labrun.mjs` runs a lab in the page's Pyodide worker.
- `textcheck.mjs` checks the text of every figure and every step on the chapters given (all by default) in one browser: clipped, overlapping or under 10.5 px. `--params` also sweeps each figure's controls one at a time (every select option; a range's minimum, middle and maximum).
- `smoke.mjs` steps every scope on each chapter once and reports page errors.
