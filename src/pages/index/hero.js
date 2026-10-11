import { mountFigure } from "./assets/js/scope.js";

// What one token costs in two landmark blocks, computed from the pinned configs.
// Qwen2.5-7B: 28 layers, 28 Q heads, 4 KV heads, head_dim 128, SwiGLU 18,944.
//   KV bytes/token = 2 * 28 * 4 * 128 * 2 B = 57,344 B.
//   Active MLP+attention params/layer ≈ 3*3584*18944 + (3584*3584 + 2*3584*512 + 3584*3584) ≈ 233M.
// Mixtral-8x7B-v0.1: 32 layers, 32 Q heads, 8 KV heads, head_dim 128, top-2 of 8 experts.
//   KV bytes/token = 2 * 32 * 8 * 128 * 2 B = 131,072 B.
//   Active params/layer ≈ attention 42M + 2 experts * 3*4096*14336 (176M) ≈ 394M.
// research/models.json carries the shared answer key; chapter 1 recomputes it.

const GROUPS = [
  {
    label: "KV bytes per token (bf16)",
    a: 57344, b: 131072,
    fmt: (v) => (v / 1024).toFixed(0) + " KiB",
  },
  {
    label: "Active params per layer per token",
    a: 233e6, b: 394e6,
    fmt: (v) => Math.round(v / 1e6) + "M",
  },
];

mountFigure("#hero-scope", {
  width: 520,
  height: 210,
  label: "One token through a dense block and an MoE block",
  draw(r, ctx) {
    const L = 12;
    const R = 500;
    r.text("t", { x: L, y: 12, class: "t-label" }, "Qwen2.5-7B dense (A) vs Mixtral-8x7B top-2-of-8 (B)");
    GROUPS.forEach((g, gi) => {
      const y = 34 + gi * 84;
      r.text("gl" + gi, { x: L, y: y, class: "t-xs t-dim" }, g.label);
      const max = Math.max(g.a, g.b);
      [["a", g.a, "s-a"], ["b", g.b, "s-b"]].forEach(([k, v, cls], ri) => {
        const by = y + 12 + ri * 24;
        r.text("k" + gi + k, { x: L, y: by + 12, class: "t-mono t-xs t-bold" }, k.toUpperCase());
        const w = (R - 120 - L) * (v / max);
        const bar = r.g("bar" + gi + k, 40, by);
        bar.rect("r", { width: Math.max(2, w), height: 15, rx: 2, class: cls });
        bar.text("v", { x: w + 8, y: 12, class: "t-mono t-xs" }, g.fmt(v));
      });
    });
    r.text("cap", { x: L, y: 206, class: "t-xs t-dim" }, "From the pinned configs; chapter 1 shows the arithmetic.");
  },
});
