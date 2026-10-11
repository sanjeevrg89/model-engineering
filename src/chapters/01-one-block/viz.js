import { mountScope, mountFigure } from "../../assets/js/scope.js";

// One token vector through one decoder block, twice: Qwen2.5-7B's dimensions on
// channel A, Mistral-7B-v0.1's on channel B. Widths, head counts, repeat factors
// and windows come from the pinned configs:
//   qwen25-7b config.json: hidden 3584 (l9), heads 28 (l15), KV heads 4 (l17),
//     eps 1e-06 (l18), intermediate 18944 (l11), window 131072 off (l20, l26)
//   mistral-7b config.json: hidden 4096 (l8), heads 32 (l13), KV heads 8 (l15),
//     eps 1e-05 (l16), intermediate 14336 (l10), window 4096 (l18)
const STAGES = [
  { short: "embed", a: "embed → 3,584 numbers", b: "embed → 4,096 numbers" },
  { short: "norm", a: "RMSNorm, eps 1e-06", b: "RMSNorm, eps 1e-05" },
  { short: "qkv", a: "QKV: Q 3,584 · K/V 512", b: "QKV: Q 4,096 · K/V 1,024" },
  { short: "repeat", a: "repeat_kv ×7 → 28 heads", b: "repeat_kv ×4 → 32 heads" },
  { short: "attend", a: "attend: full past", b: "attend: last 4,096 tokens" },
  { short: "out", a: "O proj → 3,584", b: "O proj → 4,096" },
  { short: "mlp", a: "SwiGLU → 18,944 → 3,584", b: "SwiGLU → 14,336 → 4,096" },
  { short: "residual", a: "+ residual → block 2 of 28", b: "+ residual → block 2 of 32" },
];

const CAPTIONS = [
  "One token's hidden vector enters the block: <b>3,584</b> numbers on A, <b>4,096</b> on B. Nothing has been computed yet.",
  "RMSNorm scales each vector by its own root-mean-square. The epsilon differs (1e-06 vs 1e-05) but the operation is the same.",
  "Three projections: queries at full width, keys and values at KV width — <b>512</b> numbers per position on A, <b>1,024</b> on B.",
  "The shared heads repeat to the query count: <b>×7</b> on A (4 KV heads serve 28 queries), <b>×4</b> on B (8 serve 32).",
  "Attention mixes the past in. A reads the <b>full past</b>; B reads only the <b>last 4,096</b> tokens through its sliding window.",
  "The output projection returns to block width. Attention's weights are the minority of the block on both sides.",
  "The SwiGLU feed-forward expands and contracts: to <b>18,944</b> on A, <b>14,336</b> on B. This is where most weights live.",
  "Residual adds carry the input around both halves. Same recipe, different measurements — 27 more blocks like this on A, 31 on B.",
];

function build() {
  const steps = [
    { caption: "The block both models share, with real dimensions. Step through one token vector on both channels.", state: { stage: -1 } },
  ];
  STAGES.forEach((s, i) => {
    const step = { caption: CAPTIONS[i], state: { stage: i } };
    if (i === 0) {
      step.notes = { a: "Width <b>3,584</b>, 28 layers", b: "Width <b>4,096</b>, 32 layers" };
      step.same = "Same operation, different width.";
    } else if (i === 3) {
      step.notes = { a: "<b>×7</b>: 28 queries / 4 KV heads", b: "<b>×4</b>: 32 queries / 8 KV heads" };
      step.delta = "Different repeat factors from different head counts.";
    } else if (i === 4) {
      step.notes = { a: "Window <b>off</b>: full 131,072 context", b: "Window <b>4,096</b>: capped attention" };
      step.delta = "A pays full attention; B pays a 4,096-token window.";
    } else if (i === 6) {
      step.notes = { a: "<b>203.7M</b> feed-forward weights", b: "<b>176.2M</b> feed-forward weights" };
      step.same = "Same SwiGLU shape, different width.";
    } else if (i === 7) {
      step.same = "Both add the residual and move to the next block.";
    }
    step.hold = 3000;
    steps.push(step);
  });
  return steps;
}

function stageDraw(which) {
  return (r, s, ctx) => {
    r.text("head", { x: 0, y: 14, class: "t-label" }, which === "a" ? "A · Qwen2.5-7B block" : "B · Mistral-7B block");
    STAGES.forEach((st, i) => {
      const y = 26 + i * 25;
      const cur = i === s.stage;
      const g = r.g("st" + i, 0, y);
      g.rect("r", { width: 740, height: 22, rx: 4, class: cur ? (which === "a" ? "s-a-solid" : "s-b-solid") : i < s.stage ? "s-sunk" : "s-panel" });
      g.text("n", { x: 10, y: 15, class: "t-mono t-xs" + (cur ? " t-inv t-bold" : " t-dim") }, `${i + 1}`);
      g.text("t", { x: 34, y: 15, class: "t-mono t-sm" + (cur ? " t-inv t-bold" : "") }, which === "a" ? st.a : st.b);
    });
  };
}

mountScope("#fig-1-1", {
  label: "Fig 1.1",
  title: "One token vector through a Qwen2.5 block and a Mistral block",
  width: 760,
  channels: [
    { key: "a", name: "Qwen2.5-7B", sub: "dense GQA, window off", height: 236 },
    { key: "b", name: "Mistral-7B", sub: "dense GQA, window 4,096", height: 236 },
  ],
  build,
  draw: { a: stageDraw("a"), b: stageDraw("b") },
});

/* ---- figure 1.2: KV bytes per token across six roster configs ----------------
 * bf16, 2 bytes per number, K and V per layer:
 *   Qwen2.5-7B   2 * 28 * 4 * 128 * 2 = 57,344
 *   Mistral-7B   2 * 32 * 8 * 128 * 2 = 131,072
 *   Mixtral-8x7B 2 * 32 * 8 * 128 * 2 = 131,072
 *   Qwen3-8B     2 * 36 * 8 * 128 * 2 = 147,456
 *   gpt-oss-120B 2 * 36 * 8 * 64 * 2  = 73,728
 *   GLM-4.5      2 * 92 * 8 * 128 * 2 = 376,832
 * research/models.json carries the same numbers with their method.
 * ---------------------------------------------------------------------------- */
const KV_ROWS = [
  ["Qwen2.5-7B", 57344],
  ["gpt-oss-120B", 73728],
  ["Mistral-7B", 131072],
  ["Mixtral-8x7B", 131072],
  ["Qwen3-8B", 147456],
  ["GLM-4.5", 376832],
];

mountFigure("#fig-1-2", {
  width: 760,
  height: 250,
  label: "KV bytes per token in bf16, six roster configs",
  draw(r, ctx) {
    const L = 130;
    const R = 600;
    const max = 376832;
    r.text("t", { x: 0, y: 14, class: "t-label" }, "What one cached token weighs (bf16, from the pinned configs)");
    KV_ROWS.forEach(([name, v], i) => {
      const y = 30 + i * 33;
      r.text("n" + i, { x: L - 10, y: y + 13, class: "t-mono t-sm t-end" }, name);
      const w = Math.max(2, ((R - L) * v) / max);
      const g = r.g("kv" + i, L, y);
      g.rect("r", { width: w, height: 17, rx: 2, class: i === 0 ? "s-good" : "s-sunk" });
      g.text("v", { x: w + 8, y: 13, class: "t-mono t-xs" }, `${v.toLocaleString("en-US")} B`);
    });
    r.text("cap", { x: 0, y: 244, class: "t-xs t-dim" }, "2 × layers × KV heads × head_dim × 2 B. MLA and hybrid models keep latents or fixed states instead (chapters 8, 20).");
  },
});
