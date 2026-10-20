import { mountScope, mountFigure } from "../../assets/js/scope.js";
import { segbar } from "../../assets/js/prims.js";

// Caching one token: Qwen2.5-7B's grouped KV (A) against DeepSeek-V2-Lite's
// latent (B). Per-layer cached numbers: A = 4 heads × 128 × 2 (K/V) = 1,024;
// B = 512 latent + 64 rotary = 576. Totals in bf16: A = 57,344 B over
// 28 layers, B = 31,104 B over 27 layers.
// qwen25-7b config.json l15-17; dsv2-lite config.json l20, l35-36.
const A_NUMS = 1024;
const B_NUMS = 576;

function build() {
  return [
    {
      caption: "One token's attention state, fresh from projection: <b>1,024</b> KV numbers on A, a <b>512</b>-number latent plus <b>64</b> rotary numbers on B.",
      state: { stage: 0 },
      notes: { a: "<b>1,024</b> numbers/layer", b: "<b>576</b> numbers/layer" },
      same: "Same token, same layer depth class.",
      hold: 3000,
    },
    {
      caption: "A splits into 4 key heads and 4 value heads of width 128. B splits into <b>128</b> content dims and <b>64</b> rotary dims.",
      state: { stage: 1 },
      notes: { a: "4 × 128 K, 4 × 128 V", b: "128 nope + 64 rope" },
      same: "Both split before storing.",
      hold: 3000,
    },
    {
      caption: "Write to cache. A stores all <b>1,024</b> numbers; B stores the <b>576</b> and discards the per-head layout.",
      state: { stage: 2 },
      notes: { a: "Cache: <b>2,048 B</b>/layer", b: "Cache: <b>1,152 B</b>/layer" },
      delta: "B stores 44% fewer numbers per layer.",
      hold: 3000,
    },
    {
      caption: "Read back for the next query. A streams its KV heads; B expands the latent per head with <b>kv_b_proj</b>.",
      state: { stage: 3 },
      notes: { a: "Stream <b>1,024</b> numbers", b: "Expand <b>576</b> numbers" },
      delta: "Compute against a small latent beats streaming full KV.",
      hold: 3000,
    },
    {
      caption: "Per-token totals in bf16: <b>57,344 B</b> over 28 layers on A, <b>31,104 B</b> over 27 layers on B. Kimi-K2 scales B's ranks to 61 layers: 70,272 B.",
      state: { stage: 4 },
      notes: { a: "<b>57,344 B</b>/token", b: "<b>31,104 B</b>/token" },
      same: "Both totals are one multiplication from the configs.",
      hold: 3600,
    },
  ];
}

function cacheDraw(total, perLayer, name, stages) {
  return (r, s, ctx) => {
    const W = 740;
    r.text("head", { x: 0, y: 14, class: "t-label" }, `${name} · ${perLayer.toLocaleString("en-US")} cached numbers/layer`);
    const shown = Math.min(s.stage + 1, 5);
    for (let i = 0; i < 5; i++) {
      const on = i < shown && s.stage >= 0;
      const g = r.g("cell" + i, (i * W) / 5, 26);
      const frac = [0.35, 0.55, 1, 0.7, 1][i];
      g.rect("r", {
        width: (W / 5) * frac - 6, height: 52, rx: 4,
        class: on ? (name.startsWith("A") ? "s-a-solid" : "s-b-solid") : "s-panel",
      });
      g.text("t", { x: ((W / 5) * frac - 6) / 2, y: 30, class: "t-mono t-xs t-mid" + (on ? " t-inv" : " t-dim") }, stages[i]);
    }
    r.text("tot", { x: 0, y: 110, class: "t-mono t-sm" }, s.stage >= 4 ? "per-token total (bf16)" : s.stage >= 2 ? "cached so far grows by the layer width" : "project → split → cache → read");
    r.text("num", { x: W, y: 110, class: "t-mono t-bold t-end" }, s.stage >= 4 ? `${total.toLocaleString("en-US")} B` : `${perLayer.toLocaleString("en-US")} / layer`);
  };
}

mountScope("#fig-8-1", {
  label: "Fig 8.1",
  title: "Caching one token: grouped KV against a compressed latent",
  width: 760,
  channels: [
    { key: "a", name: "Qwen2.5-7B", sub: "GQA, 1,024 numbers/layer", height: 132 },
    { key: "b", name: "DeepSeek-V2-Lite", sub: "MLA, 576 numbers/layer", height: 132 },
  ],
  build,
  draw: {
    a: cacheDraw(57344, 1024, "A · Qwen2.5-7B", ["Q", "K", "V", "cache", "read"]),
    b: cacheDraw(31104, 576, "B · DeepSeek-V2-Lite", ["latent", "nope", "rope", "cache", "expand"]),
  },
});

/* ---- figure 8.2: MLA's storage ledger, one shared scale ----------------------
 * Per layer per token: GQA (Qwen2.5-7B) stores 4 KV heads × (128 K + 128 V)
 * = 1,024 numbers; MLA (V2-Lite) stores 512 latent + 64 rotary = 576 (+ 448
 * empty to show the gap on the same 1,024 scale). Numbers from §8.1.
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-8-2", {
  width: 760,
  height: 190,
  label: "What one cached token stores per layer, at one shared scale (1,024 numbers)",
  draw(r, ctx) {
    r.text("la", { x: 0, y: 12, class: "t-label" }, "A · grouped KV — stored per head");
    segbar(r, "sba", {
      x: 0, y: 24, w: 340, h: 30, total: 1024, unit: "", scale: false,
      segs: [
        { id: "k", n: 512, c: "s-ink-o", t: "K: 4 × 128", tc: "t-mono t-xs t-inv" },
        { id: "v", n: 512, c: "s-good", t: "V: 4 × 128" },
      ],
    });
    r.text("va", { x: 360, y: 42, class: "t-mono t-sm t-dim" }, "1,024 numbers · 4 heads only serve");

    r.text("lb", { x: 0, y: 104, class: "t-label" }, "B · MLA — stored once");
    segbar(r, "sbb", {
      x: 0, y: 116, w: 340, h: 30, total: 1024, unit: "", scale: false,
      segs: [
        { id: "lat", n: 512, c: "s-a-solid", t: "latent 512", tc: "t-mono t-xs t-inv" },
        { id: "rot", n: 64, c: "s-good", t: "64", tc: "t-mono t-xs" },
        { id: "none", n: 448, c: "s-sunk", t: "—", tc: "t-mono t-xs t-dim" },
      ],
    });
    r.text("vb", { x: 360, y: 134, class: "t-mono t-sm t-dim" }, "576 numbers · 16 heads served");

    r.text("c1", { x: 0, y: 176, class: "t-xs t-dim" }, "Read time, kv_b_proj: the latent expands back per head — compute against a small cache beats streaming a big one. Gap widens vs wider GQA (§8.1).");
  },
});
