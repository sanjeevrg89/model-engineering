# Authoring a chapter

This is the contract every chapter of **Every Model** follows. Read it once before
you write, and use the checklist at the end before you call a chapter done. The
reference chapter is `src/chapters/01-one-block/` (two-channel scope, two excerpts,
a spec sheet, a lab). The landing hero `src/pages/index/hero.js` is the reference
for a compact two-channel figure.

## 1. What the course is

A course that reads **model architectures** side by side, at config and code level,
from ChatGPT (November 2022) to October 2026. Every chapter answers one question,
runs one workload through two landmark designs on a shared clock, lets the reader
build a small version of the mechanism, and points into the real configs and code
at pinned revisions.

- Transformers **v5.9.0** @ `0a2757da521a7a49b8143d9e0c938f08747d682e` → code reference `H`
- Mamba **v2.3.1** @ `c5afbdf3bda1a09d68f65181ae3a43ec71079820` → code reference `M`
- vLLM **v0.30.0** and SGLang **v0.5.21** (same pins as the sibling courses) → serving references `V` / `S`
- Fifteen model configs at pinned Hugging Face revisions, neutral channel: cite them like code:
  `<ref e="dsv3" p="config.json" l="26" s="n_routed_experts"></ref>`.
- Shallow clones at exactly these commits: `.cache/src/<repo>`; model configs in
  `.cache/src/models/<key>/` (never edit them).

**Channels.** Channel **A** is the incumbent: the established design the chapter
starts from. Channel **B** is the challenger: the idea that refined or replaced
it. Both run the same workload on the same clock. Name them per figure
(`{ key: "a", name: "Qwen2.5-7B", sub: "dense GQA" }`); the letters A/B belong to
the figure, not to a fixed vendor.

**Reference setups.** Never use a toy config as the real example. Every example is
a roster config, and every chapter names its two runners:

| Thread | Channel A | Channel B |
|---|---|---|
| decoder recipe | Qwen2.5-7B dense | Mistral-7B-v0.1 (sliding window) |
| attention cost | Mistral-7B GQA | Qwen2.5-7B narrower GQA |
| latent + sparse | DeepSeek-V3 MLA | DeepSeek-V3.2-Exp MLA + DSA |
| MoE | Mistral-7B dense / Mixtral-8x7B | DeepSeek-V3 / Kimi-K2 / gpt-oss-120B |
| linear challengers | full attention | Mamba-2 / Gated DeltaNet lineage / Lightning |
| generation | Qwen2.5-7B autoregressive | LLaDA-8B diffusion |
| frontier (2026) | DeepSeek-V3 / Kimi-K2 | Kimi-K3, GLM-5.3, DeepSeek-V4.1-Flash |

Which chapter uses which setup is in `research/curriculum.md`. Flagships whose
configs stay gated (MiMo-V2.6-Pro, Mistral Large 4) appear only as **cited
deltas**: one paragraph, a benchmark or release-note link, and what changed
relative to the roster. Never state their config values. Benchmark scores from
third parties (Artificial Analysis Intelligence Index and tiers) are cited as
scores with the publisher named, never as architecture facts.

## 2. Accuracy rules (non-negotiable)

1. **Every roster model moved past training data.** Qwen2.5 uses a 131,072-token
   sliding window it mostly disables, gpt-oss attends over 128 tokens, Kimi-K2
   routes 8 of 384 experts, V3.2-Exp indexes 2,048 positions. Treat memory as a
   hypothesis. Every claim about configs, defaults, classes or behaviour must be
   checked in the pinned source.
2. **Start from the source maps** in `research/`: `architectures.md` (timeline
   with links), `models.json` (derived dimensions — re-derive, don't copy),
   `curriculum.md` (chapter setups). Still open the file before you quote it.
3. **Cite with `<ref>`, quote with `<excerpt>`.** The build verifies both against
   the clones and fails `--strict` if a path, line or symbol is wrong. Never paste
   source code by hand. Never invent a key, default, number or class.
4. **No fake benchmark numbers.** A performance number is any time, rate, speedup,
   utilization, or hit/acceptance rate of a running system. Each one must be exactly
   one of: **Measured** (recorded under `bench/results/` with machine, versions and
   command, named as a CPU number if it is one), **Cited** (from a linked vendor,
   engine or paper publication, attributed in the sentence with the hardware), a
   **Floor** (a hard bound from exact byte or FLOP counts and datasheet specs,
   stated as a bound: "no decode step can read less than …"), or a **Parameter**
   (a reader-set slider in an explicit "if … then …"). Anything else goes.
   Exact counts read from configs (bytes per token, experts, heads, layers) and
   capacity arithmetic from a stated budget are not performance numbers: state them
   as facts with a `<ref>`.
5. Prefer **defaults** a reader would actually get, and name the knob that changes them.
6. When the designs behave the same, say so; when they differ, say how and why
   (design reason), not which is "better".

### Depth: code-level walkthroughs and calculators

Readers are engineers who choose, serve or fine-tune models.

- **Walk the hot path in the pinned code.** Every chapter includes a code-level
  walkthrough of its mechanism in Transformers (and Mamba where it applies). Use
  annotated `<excerpt>`s with `hl` lines: data structures, cost per operation,
  what is on the critical path, and the design reason.
- **Calculate it.** Where a chapter makes a size claim, show the arithmetic from
  the config values in a numbers strip or a formula, and mirror it in the lab.
  `research/models.json` is the shared answer key; recompute it from the configs
  whenever the pins move.

## 3. Voice

- Write plainly, the way a senior engineer explains a system to a colleague. Second
  person is fine. Short, direct sentences.
- No hype, no filler, no "let's dive in", no rhetorical questions as transitions.
- Avoid mannered devices: em-dash asides, "not X, but Y" framing, colon-then-reveal
  sentences, scare quotes, "it's worth noting", "honest caveat".
- Name things the way the config and code name them (`num_key_value_heads`,
  `kv_lora_rank`, `MixtralSparseMoeBlock`) and define each term the first time it appears.
- Numbers carry units and thousands separators (131,072 tokens, 512 numbers, 7.62 GB).
- Titles are this course's own. Never reuse another course's chapter, part or section
  title, or a near copy of one, and never repeat a title inside the course.
- Each section earns its place: if a paragraph doesn't move the reader toward the
  chapter's question, cut it.

## 4. Files

```
src/chapters/<NN-slug>/index.html   the chapter body (an HTML fragment)
src/chapters/<NN-slug>/viz.js       its figures (ES module); any other .js is loaded too
src/chapters/<NN-slug>/style.css    optional chapter-only styles (keep tiny)
labs/<chNN_name>/                   the chapter's lab, if it has one (see §9)
```

The chapter header (title, number, dek, revision block, section map), the "next
question" panel and the pager are **generated** from `course.json`. Don't write them.
Don't edit `course.json`, the shared CSS/JS in `src/assets/`, the build scripts, or
another chapter. If you need a change there, describe it in your report.

## 5. Anatomy of a chapter

In this order (headings are `<h2 id="…"><span class="h-num">N.M</span>Title</h2>`;
the ids feed the section map):

1. **Opening** (no heading): 1–2 paragraphs that pick up the previous chapter's closing
   question and say what this chapter shows. No "In this chapter we will".
2. **The main figure** early, usually right after the first section's first paragraph:
   a two-channel scope (§7) running one workload through the incumbent and the challenger.
3. **Explanation sections** (3–6): mechanism first, then each design's version, with
   excerpts, a spec sheet, numbers, smaller figures as needed.
4. **Build it** (`id="lab"`) if the chapter has a lab.
5. **Read the real code** (`id="read"`): a two-column reading list, 3–5 items per side,
   ordered as a reading path, each with one sentence on what to look for.
6. **Check yourself** (`id="check"`): 3–4 multiple-choice questions with explanations.
7. **Takeaways**: 3–5 bullets.

Target length: 2,500–4,500 words of prose, 1 main scope, 1–3 secondary figures,
2–5 excerpts, 1 spec sheet, roughly 6–20 `<ref>`s outside the reading list.

Stub chapters (roadmap) are honest placeholders: the question, one paragraph on
what the chapter will show, a 3-item outline, and a pointer to the timeline. They
carry no `<ref>`s and make no factual claims beyond the question itself.

## 6. Build-time tags and components

**Source reference** (inline chip linking to the pinned line):
```html
<ref e="dsv3" p="config.json" l="26" s="n_routed_experts"></ref>
<ref e="hf-transformers" p="src/transformers/models/mixtral/modeling_mixtral.py" l="104" s="top_k">MixtralSparseMoeBlock.top_k</ref>
```
`e` is any key in `course.json` → `sources`. `s` must appear on line `l` or within two
lines of it. The label defaults to `file.py:line`.

**Verbatim excerpt** (code block with line numbers and a permalink header):
```html
<excerpt e="hf-transformers" p="src/transformers/models/llama/modeling_llama.py" l="187-196" hl="195" s="repeat_kv"
  title="Transformers: grouped-query attention repeats shared heads" note="optional one-line note under the code"></excerpt>
```
`l` may list ranges `"120-140,152-160"` (gaps render as `…`). Keep excerpts ≤ 25 lines.
`hl` highlights lines. Put two excerpts that answer the same question side by side:
```html
<div class="pair"> <excerpt …></excerpt> <excerpt …></excerpt> </div>
```

**Other code** (commands, pseudo-code, our own snippets): `<snippet lang="python" title="…">…</snippet>`.

**Placeholders**: `{{<source>.tag}}`, `{{<source>.commit}}`, `{{<source>.short}}` (7-char
commit) and `{{<source>.name}}` for any key in `course.json` → `sources`.

**Spec sheet** (the side-by-side comparison; one per chapter):
```html
<div class="sheet wide"><table>
  <caption><span class="label">Spec sheet N.1</span>Short title</caption>
  <thead><tr><th></th><th class="cha"><span class="badge badge--a">A</span>Qwen2.5-7B</th>
    <th class="chb"><span class="badge badge--b">B</span>Mistral-7B-v0.1</th></tr></thead>
  <tbody><tr><th>Row label</th><td>… <ref …></ref></td><td>…</td></tr></tbody>
</table></div>
```
When both designs agree, span the two value cells:
`<tr><th>Row label</th><td class="same" colspan="2">…</td></tr>`.

**Other blocks**
- Margin note: `<aside class="side"><span class="label">Label</span><p>…</p></aside>`.
- Callout: `<div class="callout"><span class="label">…</span><p>…</p></div>`;
  `callout--myth` for a common misconception ("Easy to get wrong").
- Numbers strip: `<div class="numbers"><div><span class="v">131,072</span><span class="d">…</span></div>…</div>`
  (3–4 cells; real constants, with their source in the text).
- Formula: `<div class="formula"><math display="block">…MathML…</math><span class="where">…</span></div>`.
- Plain table: `<div class="table"><table>…</table></div>`.
- Quiz: see chapter 1 (`.quiz > .q[data-answer] > .q__stem, ol.q__opts > li[data-k], .q__why`).
- Takeaways: `<div class="takeaways"><span class="label">Takeaways</span><ul>…</ul></div>`.
- Reading list: `<div class="reading"><section class="reading--a">…</section><section class="reading--b">…</section></div>`.
- Static figure: `<figure id="fig-N-M"><figcaption><b>Figure N.M</b> …</figcaption></figure>` +
  `mountFigure("#fig-N-M", { width, height, label, draw(r, ctx) {…} })` in viz.js.
  Author static figures and scopes at width 760.
- Wide content: add class `wide` to break out into the margin column.

## 7. The two-channel scope

The signature of the course: one workload, incumbent on A, challenger on B, one
clock, stepped with ← →. A step is one decision or event, never a decorative frame.
6–12 steps. See the reference chapter and `src/assets/js/scope.js`.

- **States come from a simulation**, not hand-placed pixels: write a small JS model of
  each design's actual rule (head counts, expert picks, cache bytes) and derive steps
  from it. Comment each rule with the source line it mirrors.
- **Keyed renderer.** `r.g(key, x, y)` returns a positioned child group. Use stable keys
  (`"head" + id`, `"exp" + id`), never array indices for things that move.
- **Δ honestly**: mark a step with `delta` only when the two designs really compute
  something different at that point. Steps where they agree may carry `same`.
- Captions narrate what changed and why it matters. Per-channel `notes` explain the
  design-specific detail; use `<b>` for the key number.

## 8. Figures that are charts

Draw to scale with one scale per axis, label the ends, give marks explicit classes,
tabular numbers, a faint grid (`l-rule`), and an emphasized endpoint. Every number on a
chart is either computed in the figure code or read from the source, and the caption
says which.

## 9. Labs

A lab is one Python file the reader completes, plus tests, plus a reference solution.
It runs in the browser (Pyodide, in a worker) and locally (`uv run pytest labs/<dir>`).

```
labs/<chNN_name>/<module>.py           starter file (unique module name across all labs)
labs/<chNN_name>/test_<module>.py      tests (plain asserts with messages)
labs/<chNN_name>/solution/<module>.py  reference solution
labs/<chNN_name>/lab.json              manifest (see labs/ch01_block_shapes/lab.json)
labs/<chNN_name>/fixtures/             pinned config excerpts used by the tests (small JSON)
```

- Build on `labs/toyarch` (read `toyarch/model.py`): same two-layer transformer as the
  sibling courses' `toyserve`, plus fixture configs copied from the pinned revisions.
  Fixtures carry their revision in a `_rev` field. Keep lab-specific helpers inside the
  starter file or the test file; don't add new shared modules.
- The invariant to test whenever it applies: **an equivalent refactor never changes the
  logits**. Compare against the toy model or a plain recomputation.
- Tests: each `test_*` has a one-line docstring (shown in the UI), deterministic, the
  whole file runs in < 2 s in CPython (Pyodide is ~3× slower). Assertion messages say
  what went wrong in the reader's terms.
- The starter file has the scaffolding, docstrings and `# TODO` markers; it must import
  cleanly and fail tests with useful messages. The solution must pass with
  `LAB_SOLUTION=1 uv run pytest labs/<dir>`.
- In the chapter: `<section class="lab" data-lab="../../labs/<dir>/lab.json" id="lab-N">`
  with a `<div class="lab__brief">` of 2–4 sentences.
- The browser runs the lab in Pyodide, which has a much smaller stack than CPython:
  keep data flat or iterative, and check with `node scripts/check-labs-pyodide.mjs`.

## 10. Checking your work

Each author builds into their own folder and serves it on their own port:

```bash
node scripts/build.mjs --strict --only <slug>,<slug> --out /tmp/em-<you>   # no ERROR lines
node scripts/serve.mjs <port> /tmp/em-<you> &               # once
npm --prefix tools/figcheck install                         # once (Playwright)
node tools/figcheck/steps.mjs /ch/<slug>/ "#fig-N-M" <prefix> --port=<port> [--dark] [--w=390]
node tools/figcheck/shoot.mjs /ch/<slug>/ <name> --port=<port> [--w=390] [--dark] \
     [--sel=#fig-N-M --clicks=K] [--scroll=selector] [--full]
node tools/figcheck/labrun.mjs /ch/<slug>/ "#lab-N" solution <port> <dir>   # runs the lab in Pyodide
```

Done means all of these hold:

- [ ] `node scripts/build.mjs --strict --only <your slugs>` prints no `ERROR`.
- [ ] Every claim about configs/code is backed by a `<ref>`/`<excerpt>` or the source maps.
- [ ] The main scope: every step viewed at 1440 px; light and dark; one step at 390 px.
      No overlaps, no clipped labels, no text under 10.5 px.
- [ ] No console errors; no horizontal page scroll at 390 px.
- [ ] Lab: skeleton fails with readable messages; solution passes locally
      (`LAB_SOLUTION=1 uv run pytest labs/<dir>`) and in the browser (`labrun.mjs`).
- [ ] Quiz answers are correct and each explanation teaches something.
- [ ] Prose read once end to end for voice (§3) and for anything unverified.
