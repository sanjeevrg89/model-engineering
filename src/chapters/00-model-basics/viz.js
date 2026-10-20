import { mountScope, mountFigure } from "../../assets/js/scope.js";
import { tokens, arrow } from "../../assets/js/prims.js";

// One token's lifetime through an entire model, twice: Qwen2.5-7B's dimensions on
// channel A, Mistral-7B-v0.1's on channel B. Numbers from the pinned configs:
//   qwen25-7b config.json: hidden 3584 (l9), layers 28 (l16), vocab 152064 (l27)
//   mistral-7b config.json: hidden 4096 (l8), layers 32 (l14), vocab 32000 (l23)
const STAGES = [
  { short: "ids", a: "text → token ids", b: "text → token ids" },
  { short: "embed", a: "id → 3,584-number vector", b: "id → 4,096-number vector" },
  { short: "blocks", a: "28 blocks × five ideas (6 ops)", b: "32 blocks × five ideas (6 ops)" },
  { short: "final", a: "last block's output: 3,584 numbers", b: "last block's output: 4,096 numbers" },
  { short: "logits", a: "LM head → 152,064 scores", b: "LM head → 32,000 scores" },
  { short: "sample", a: "argmax or sampling → one id", b: "argmax or sampling → one id" },
  { short: "repeat", a: "append id, run again → next token", b: "append id, run again → next token" },
];

const CAPTIONS = [
  "The tokenizer cuts text into fragments and stores each as an integer id. The model's whole world is this list of ids.",
  "Each id picks one row of the embedding table: <b>3,584</b> numbers on A, <b>4,096</b> on B. This vector is the only thing the model ever works with.",
  "The stacks rewrite the vector with the same five ideas — multiply-and-add, lookup, norm, residual — <b>28</b> times on A, <b>32</b> on B. Nothing fancier than multiply-and-add anywhere.",
  "When the last block finishes, the vector still has its width. Every block edited it and added the edit back.",
  "The final table scores every possible next token: <b>152,064</b> logits on A, <b>32,000</b> on B — five times as many choices per token on A.",
  "The id with the top score wins the choice, or sampling picks among the high scorers. Either way the output is one id.",
  "The chosen id joins the input list and the loop runs again. Generation is this figure in a circle, run once per token.",
];

function build() {
  const steps = [
    { caption: "One token, text to next-token choice, across an entire model. Step through its lifetime on both channels.", state: { stage: -1 } },
  ];
  STAGES.forEach((s, i) => {
    const step = { caption: CAPTIONS[i], state: { stage: i } };
    if (i === 1) {
      step.notes = { a: "Width <b>3,584</b> · 28 layers", b: "Width <b>4,096</b> · 32 layers" };
      step.delta = "Same table idea, different row width.";
    } else if (i === 2) {
      step.notes = { a: "<b>28</b> blocks × 3,584 wide", b: "<b>32</b> blocks × 4,096 wide" };
      step.same = "Same five ideas, same order, different stack depth.";
    } else if (i === 4) {
      step.notes = { a: "<b>152,064</b> possible next tokens", b: "<b>32,000</b> possible next tokens" };
      step.delta = "Very different vocabularies; scoring is the same lookup.";
    }
    step.hold = 3000;
    steps.push(step);
  });
  return steps;
}

function stageDraw(which) {
  return (r, s, ctx) => {
    r.text("head", { x: 0, y: 14, class: "t-label" }, which === "a" ? "A · Qwen2.5-7B, whole model" : "B · Mistral-7B, whole model");
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

mountScope("#fig-0-1", {
  label: "Fig 0.1",
  title: "One token through an entire model, twice",
  width: 760,
  channels: [
    { key: "a", name: "Qwen2.5-7B", sub: "vocab 152,064 · width 3,584", height: 210 },
    { key: "b", name: "Mistral-7B", sub: "vocab 32,000 · width 4,096", height: 210 },
  ],
  build,
  draw: { a: stageDraw("a"), b: stageDraw("b") },
});

/* ---- figure 0.2: the worked projection, drawn --------------------------------
 * §0.3's two-number example, no new numbers: input [1.0, 2.0], matrix rows
 * [0.5, 1.0] and [2.0, -0.5], outputs 2.5 and 1.0.
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-0-2", {
  width: 760,
  height: 150,
  label: "The only arithmetic a block does, drawn",
  draw(r, ctx) {
    tokens(r, "vec", {
      x: 0, y: 30, w: 36, h: 24, gap: 2,
      items: [{ t: "1.0", c: "s-a-solid" }, { t: "2.0", c: "s-a-solid" }],
    });
    r.text("vl", { x: 0, y: 62, class: "t-mono t-xs t-dim" }, "token's vector");

    tokens(r, "mat", {
      x: 160, y: 30, w: 36, h: 24, gap: 2, wrap: 2,
      items: [
        { t: "0.5", c: "s-panel" }, { t: "1.0", c: "s-panel" },
        { t: "2.0", c: "s-panel" }, { t: "−0.5", c: "s-panel" },
      ],
    });
    r.text("ml", { x: 160, y: 62, class: "t-mono t-xs t-dim" }, "learned weights");

    tokens(r, "out", {
      x: 320, y: 30, w: 36, h: 24, gap: 2,
      items: [{ t: "2.5", c: "s-good" }, { t: "1.0", c: "s-good" }],
    });
    r.text("ol", { x: 320, y: 62, class: "t-mono t-xs t-dim" }, "projection out");

    arrow(r, "a1", ctx, { x1: 78, y1: 42, x2: 156, y2: 42 });
    arrow(r, "a2", ctx, { x1: 238, y1: 42, x2: 316, y2: 42 });

    r.text("w1", { x: 420, y: 40, class: "t-mono t-sm t-dim" }, "0.5 × 1.0 + 1.0 × 2.0 = 2.5");
    r.text("w2", { x: 420, y: 60, class: "t-mono t-sm t-dim" }, "2.0 × 1.0 + (−0.5) × 2.0 = 1.0");
    r.text("w3", { x: 420, y: 86, class: "t-xs t-dim" }, "one matrix row dotted with the vector, per output");

    r.text("note", { x: 0, y: 92, class: "t-xs t-dim" }, "In the real models n is 3,584 / 4,096 and m up to 18,944 — same rule, just many more rows.");
  },
});

/* ---- figure 0.3: the lookup, drawn ------------------------------------------
 * Schematic only: three past tokens with keys and values, scores that become
 * weights (illustrative numbers, not measurements), a blended output.
 * Mirrors §0.4's three steps: score, squeeze to weights, blend values.
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-0-3", {
  width: 760,
  height: 270,
  label: "The lookup, drawn: a query scores keys, then blends values",
  draw(r, ctx) {
    const past = [
      { tok: "the", k: "K", v: "V", w: 0.6 },
      { tok: "cat", k: "K", v: "V", w: 0.3 },
      { tok: "chased", k: "K", v: "V", w: 0.1 },
    ];
    r.text("ch", { x: 0, y: 12, class: "t-xs t-dim" }, "earlier positions");
    r.text("sc", { x: 300, y: 12, class: "t-xs t-dim" }, "score → weight");
    past.forEach((p, i) => {
      const y = 26 + i * 40;
      tokens(r, "tok" + i, { x: 0, y, w: 72, h: 26, items: [{ t: p.tok, c: "s-panel", tc: "t-mono t-xs" }] });
      tokens(r, "kv" + i, {
        x: 84, y, w: 30, h: 26, gap: 4,
        items: [
          { t: p.k, c: "s-ink-o", tc: "t-mono t-xs t-inv" },
          { t: p.v, c: "s-good", tc: "t-mono t-xs" },
        ],
      });
      const bg = r.g("bar" + i, 300, y + 6);
      bg.rect("r", { width: 220, height: 14, rx: 7, class: "s-sunk" });
      bg.rect("f", { width: Math.max(4, 220 * p.w), height: 14, rx: 7, class: "s-a-solid" });
      r.text("w" + i, { x: 532, y: y + 17, class: "t-mono t-xs" }, p.w.toFixed(1));
    });
    r.text("note", { x: 300, y: 152, class: "t-xs t-dim" }, "weights sum to 1 · illustrative scores, real ones are learned");

    tokens(r, "q", { x: 0, y: 180, w: 72, h: 26, items: [{ t: "it", c: "s-a-solid", tc: "t-mono t-xs t-inv" }] });
    tokens(r, "qq", { x: 84, y: 180, w: 46, h: 26, items: [{ t: "Q", c: "s-ink-o", tc: "t-mono t-xs t-inv" }] });
    r.text("ql", { x: 140, y: 197, class: "t-xs t-dim" }, "what am I looking for?");
    arrow(r, "a1", ctx, { x1: 430, y1: 193, x2: 468, y2: 193 });
    box(r, "blend", { x: 472, y: 176, w: 180, h: 34, c: "s-panel", title: "weighted blend of values", align: "middle", titleCls: "t-xs t-bold" });
    arrow(r, "a2", ctx, { x1: 652, y1: 193, x2: 686, y2: 193 });
    tokens(r, "out", { x: 690, y: 180, w: 46, h: 26, items: [{ t: "→", c: "s-good", tc: "t-mono t-xs" }] });

    r.text("cap", { x: 0, y: 238, class: "t-xs t-dim" }, "Every earlier position offers a key (what it has) and a value (what it hands over). The query's match with each key sets the mix;");
    r.text("cap2", { x: 0, y: 254, class: "t-xs t-dim" }, "the output is mostly 'cat' here, which is how the pronoun gets its meaning (§0.4).");
  },
});
