import { mountScope, mountFigure } from "../../assets/js/scope.js";

// One token's receipt: Qwen2.5-7B's single-kind KV (A) against V3.2-Exp's
// latent-plus-index (B). Bytes in bf16: A = 57,344 (2*28*4*128*2);
// B = 70,272 latent ((512+64)*2*61) plus indexer keys. research/models.json
// carries the shared answer key.
const A_TOTAL = 57344;
const B_LATENT = 70272;

function build() {
  return [
    {
      caption: "One token finishes its forward pass. A owes <b>57,344 B</b> of KV; B owes <b>70,272 B</b> of latent — before the indexer's keys.",
      state: { stage: 0 },
      notes: { a: "KV: <b>57,344 B</b>", b: "Latent: <b>70,272 B</b>" },
      same: "Both receipts are one multiplication from the configs.",
      hold: 3000,
    },
    {
      caption: "Kind one: standard KV on A, 28 layers × 4 heads × 128 × 2 × 2 B. B has no KV heads to count — its 128 heads never materialize.",
      state: { stage: 1 },
      notes: { a: "2·28·4·128·2 B", b: "No KV cache" },
      delta: "A's formula doesn't parse B's cache.",
      hold: 3000,
    },
    {
      caption: "Kind two: MLA latent on B, 61 layers × (512 + 64) × 2 B. A has no rank to compress — its heads store full width.",
      state: { stage: 2 },
      notes: { a: "No latent", b: "61·576·2 B" },
      delta: "B's formula doesn't parse A's cache.",
      hold: 3000,
    },
    {
      caption: "Kind three: indexer keys on B score every past token (chapter 9). A has no scorer. Fixed recurrent state and diffusion's zero complete the roster's four kinds plus zero.",
      state: { stage: 3 },
      notes: { a: "No scorer", b: "+ indexer keys" },
      delta: "Knowing what to read costs memory too.",
      hold: 3000,
    },
    {
      caption: "Receipts: A <b>57,344 B</b> in one kind; B <b>70,272 B</b> in two. Table 20.1 extends this to all fifteen — one row's kinds, never the columns' sum.",
      state: { stage: 4 },
      notes: { a: "Total <b>57,344 B</b>", b: "Total <b>70,272 B</b> + index" },
      same: "Both totals recompute from two config keys and a byte width.",
      hold: 3600,
    },
  ];
}

function receiptDraw(total, kinds, name, cls) {
  return (r, s, ctx) => {
    const W = 740;
    r.text("head", { x: 0, y: 14, class: "t-label" }, name);
    const lit = Math.min(s.stage + 1, kinds.length + 1);
    kinds.forEach((k, i) => {
      const w = (W * k.frac) - 6;
      const x = kinds.slice(0, i).reduce((a, q) => a + (W * q.frac), 0);
      const g = r.g("k" + i, x, 30);
      const on = s.stage >= 1 && i < lit - 1;
      g.rect("r", { width: Math.max(4, w), height: 54, rx: 4, class: on ? cls + "-solid" : "s-panel" });
      g.text("t", { x: Math.max(4, w) / 2, y: 24, class: "t-mono t-xs t-mid" + (on ? " t-inv t-bold" : "") }, k.label);
      g.text("v", { x: Math.max(4, w) / 2, y: 40, class: "t-mono t-xs t-mid" + (on ? " t-inv" : " t-dim") }, k.bytes);
    });
    r.text("tot", { x: 0, y: 116, class: "t-mono t-sm" }, s.stage >= 4 ? `receipt: ${total}` : "one token's leftovers, by kind");
  };
}

mountScope("#fig-20-1", {
  label: "Fig 20.1",
  title: "One token's receipt: pure KV against latent-plus-index",
  width: 760,
  channels: [
    { key: "a", name: "Qwen2.5-7B", sub: "one kind: KV", height: 136 },
    { key: "b", name: "DeepSeek-V3.2-Exp", sub: "two kinds: latent + index", height: 136 },
  ],
  build,
  draw: {
    a: receiptDraw("57,344 B", [{ label: "KV", bytes: "57,344 B", frac: 1 }], "A · single-kind receipt", "s-a"),
    b: receiptDraw("70,272 B + index", [
      { label: "latent", bytes: "70,272 B", frac: 0.72 },
      { label: "index keys", bytes: "per chapter 9", frac: 0.28 },
    ], "B · two-kind receipt", "s-b"),
  },
});

/* ---- figure 20.2: four receipts, four growth rules ---------------------------
 * State kinds from §20.2: standard KV and indexer keys grow with tokens; MLA
 * latents grow with rank and layers; recurrent state is fixed per layer;
 * diffusion keeps no reusable cache. Glyphs are schematic, not to scale.
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-20-2", {
  width: 760,
  height: 280,
  label: "Four kinds of leftover state, four growth rules",
  draw(r, ctx) {
    const rows = [
      { name: "standard KV", note: "2 × layers × KV heads × head_dim", grow: true, cls: "s-a-solid", formula: "grows with tokens" },
      { name: "MLA latent", note: "layers × (rank + rotary)", grow: true, cls: "s-good", formula: "grows with tokens" },
      { name: "indexer keys", note: "tokens × index heads × index width", grow: true, cls: "s-b-solid", formula: "grows with tokens" },
      { name: "recurrent state", note: "fixed per layer, no token term", grow: false, cls: "s-ink-o", formula: "constant" },
      { name: "diffusion cache", note: "bidirectional attention reuses nothing", grow: null, cls: "s-sunk", formula: "zero" },
    ];
    rows.forEach((row, i) => {
      const y = 20 + i * 50;
      r.text("n" + i, { x: 0, y: y + 16, class: "t-mono t-sm t-end" }, row.name);
      if (row.grow === true) {
        [18, 30, 44].forEach((h, j) => {
          const g = r.g("g" + i + ":" + j, 170 + j * 30, y + 30 - h);
          g.rect("r", { width: 18, height: h, rx: 2, class: row.cls });
        });
      } else if (row.grow === false) {
        [18, 18, 18].forEach((h, j) => {
          const g = r.g("g" + i + ":" + j, 170 + j * 30, y + 30 - h);
          g.rect("r", { width: 18, height: h, rx: 2, class: row.cls });
        });
      } else {
        const g = r.g("g" + i, 170, y + 4);
        g.rect("r", { width: 78, height: 26, rx: 3, class: "s-free" });
        g.text("t", { x: 39, y: 17, class: "t-mono t-xs t-dim" }, "0");
      }
      r.text("f" + i, { x: 268, y: y + 12, class: "t-mono t-xs" }, row.formula);
      r.text("m" + i, { x: 268, y: y + 28, class: "t-xs t-dim" }, row.note);
    });
    r.text("cap", { x: 0, y: 266, class: "t-xs t-dim" }, "Receipts run from 0 B to 376,832 B per token on the roster — price one row's kinds, never the columns' sum (§20.2).");
  },
});
