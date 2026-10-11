# Every Model

**Every important model architecture since ChatGPT, side by side, from the source.**
Each chapter runs one workload through two landmark designs on a shared clock
(incumbent on channel A, challenger on channel B), lets you build a small version
of the mechanism in Python, and points into the real configs and code at pinned
revisions.

- 30 chapters in six parts: the recipe everyone inherited, cheaper attention, many
  experts, beyond attention (linear-time challengers), predict more / store less,
  and other ways to generate (diffusion, multimodal, agents, serving)
- fifteen pinned open-weight configs that cover dense, sliding-window, GQA, MLA,
  sparse-attention, fine-grained MoE, trillion-parameter hybrids and diffusion
  designs, from Mistral-7B (2023) to Kimi-K3 (2026)
- step-through figures driven by small simulations of each design's actual rules
- 11 labs that run in the browser (Pyodide) or locally with pytest
- every file path, line number, excerpt and model dimension checked by the build
  against **Transformers v5.9.0** (`0a2757d`) and pinned Hugging Face revisions of
  each roster config
- a year-by-year timeline page from November 2022 to October 2026, and a compare
  page with every chapter's spec sheet in course order

## The roster

Every example is one of fifteen models. Their configs are pinned in `course.json`
and fetched by `scripts/fetch-sources.mjs`; `research/models.json` derives their
dimensions, parameter counts and per-token state bytes.

| Model | Design | Reference setup in the course |
|---|---|---|
| Mistral-7B-v0.1 | dense, GQA + sliding window 4,096 | Parts I–II baseline |
| Mixtral-8x7B-v0.1 | coarse MoE: 8 experts, top-2 | Part III baseline |
| Qwen2.5-7B | dense GQA, 28 layers, 4 KV heads | Parts I–II reference |
| DeepSeek-V2-Lite | MLA debut (kv_lora_rank 512), 64 routed experts | Chapter 8 channel A |
| DeepSeek-V3 | fine-grained MoE (256 experts, top-8) + MLA | Part III reference |
| Qwen3-8B | dense GQA + QK-norm | Parts I, V reference |
| GLM-4.5 | MoE, 160 routed experts, pre-MLA baseline | Part III–IV bridge |
| gpt-oss-120B | MoE, 128 experts top-4, 128-token window | Chapter 14 channel B |
| Kimi-K2-Instruct | MLA MoE, 384 routed experts | Chapters 8, 15 channel B |
| DeepSeek-V3.2-Exp | MLA + sparse attention (index_topk 2,048) | Chapter 9 channel B |
| LLaDA-8B-Base | masked diffusion, no KV cache | Part VI channel B |
| MiniMax-M2.5 | Lightning + MLA hybrid, 62 layers | Chapter 19 channel B |
| Kimi-K3 | KDA + NoPE MLA hybrid, 896 experts top-16, MXFP4 | Chapters 15, 18 channel B |
| GLM-5.3 | MLA + DSA flagship, 256 experts top-8, MTP | Chapters 9, 21 channel B |
| DeepSeek-V4.1-Flash | compressed KV + DSpark, 384 experts top-6, FP8 | Chapters 21, 22 channel B |

Newer flagships that stay gated (MiMo-V2.6-Pro, Mistral Large 4) are covered as
cited deltas in `research/architectures.md` with their published benchmark
scores, never their architectures as fact. They join the pinned roster when
their configs are fetchable without authentication.

## Quick start

Requirements: Node 20+, and [uv](https://docs.astral.sh/uv/) for the labs.

```bash
node scripts/fetch-sources.mjs     # clone pinned code + download pinned configs into .cache/src
node scripts/build.mjs --strict    # build dist/, verifying every ref and excerpt
node scripts/serve.mjs 4173        # http://localhost:4173/
```

The build has no dependencies. Without the clones it still builds, using
`src/excerpts.lock.json` for excerpts, but it can't verify references.

## Labs

```bash
uv run pytest labs/ch01_block_shapes       # run one lab against your code
LAB_SOLUTION=1 uv run pytest labs          # check every reference solution
node scripts/check-labs-pyodide.mjs        # run every solution in Pyodide, as the browser does
```

Each lab builds on `labs/toyarch`, a two-layer transformer in pure Python with
fixed random weights, plus fixture configs copied from the pinned revisions.
Labs that touch scale end with a sizing exercise on a real roster config:
parameter counts, KV bytes per token, active experts per token.

| Lab | Chapter | What you build |
|---|---|---|
| `ch01_block_shapes` | 1 | shapes and params of one decoder block, then real roster sizes |
| `ch03_rope` | 3 | RoPE frequencies and the cost of a bigger theta |
| `ch05_flops` | 5 | FLOPs per token and the roofline floor |
| `ch06_kv_bytes` | 6 | KV bytes per token for GQA vs MHA |
| `ch08_mla_bytes` | 8 | latent cache bytes vs full KV |
| `ch09_topk` | 9 | indexer scoring and top-k selection |
| `ch11_router` | 11 | top-k expert routing and load balance |
| `ch12_active_params` | 12 | active vs resident parameters in fine-grained MoE |
| `ch16_ssm_scan` | 16 | a selective scan with constant state |
| `ch20_state_budget` | 20 | per-token state budgets across the roster |
| `ch25_denoise` | 25 | one masked-diffusion denoising step |

## Layout

```
course.json                 parts, chapters, and every pinned source (code + model configs)
src/chapters/NN-slug/       one chapter: index.html (+ viz.js, optional style.css)
src/pages/                  landing page, timeline, method, glossary, compare, hardware, capstones, contribute, 404
src/assets/                 design tokens, CSS, the scope (step-through figure) engine
labs/                       toyarch + one folder per lab (starter, tests, solution)
research/                   architecture timeline, roster dimensions, curriculum map
scripts/                    build, serve, fetch-sources, repin, drift, reviewers, link and lab checks
AUTHORING.md                the chapter contract: voice, accuracy rules, components
```

## Writing or updating a chapter

Read `AUTHORING.md` first. In short: verify every claim in the pinned source,
cite it with `<ref>`, quote it with `<excerpt>`, build the main figure from a
simulation of the real rules, and run `node scripts/build.mjs --strict` before
you call it done.

## Reporting an error

Every claim links to a pinned revision, so a report can be checked quickly. Use
the "Report an inaccuracy" issue form with the page, the sentence, what is
actually true and the evidence — or email sanjeevrg7@gmail.com with the same.

## Editions and drift

The course describes exact revisions, and every page names them. A new edition
ships every eight weeks. It adds newly released architectures as deltas first,
promotes them to the pinned roster when their configs are publicly fetchable,
and repeats the source review chapter by chapter. Between editions,
`.github/workflows/drift.yml` runs every Monday (add it when the repo moves to
GitHub). A release that changes a default or a behavior a chapter teaches gets a
patch without waiting for the next edition.

## Deploying

The site runs on **Cloudflare Workers** (static assets) and deploys from this
repository on every push to `main`. `wrangler.jsonc` tells Cloudflare to serve
`dist/`, with `/ch/<slug>/` resolving to its `index.html` and unknown paths
getting `404.html`. Build settings in the Cloudflare dashboard:

| Setting | Value |
|---|---|
| Build command | `node scripts/build.mjs` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

The build needs no dependencies and no source clones: excerpts come from the
committed `src/excerpts.lock.json`.

## License

Text and illustrations are licensed under [CC BY 4.0](LICENSE-CONTENT); share,
adapt and translate them with attribution. Code (the build, the figure engine,
every `viz.js`, the labs) is licensed under [Apache-2.0](LICENSE). See [NOTICE](NOTICE)
for exactly which files fall under which license, and for third-party material.

## Sibling courses

- [Two Engines](https://vllm-sglang-course.behindthetoken.workers.dev/): vLLM and
  SGLang side by side, from one token on one H200 to a GB300 rack.
- [Two Orchestrators](https://dynamo-llmd-course.behindthetoken.workers.dev/):
  NVIDIA Dynamo and llm-d serving frontier models across thousands of GPUs.
- [zero-to-sglang](https://datawhalechina.github.io/zero-to-sglang/eng/), the
  official SGLang and Datawhale course. Start there if inference is new to you.

## Independence

This course is independent and not affiliated with any model provider. Model
configs are quoted verbatim with permalinks to the exact revision; open-source
code excerpts remain under their projects' licenses.
