import { mountScope, mountFigure } from "../../assets/js/scope.js";

// Weighing one billion params and one KV receipt in three precisions.
// Exact arithmetic: bytes = count × width. 1B params → 2 GB bf16, 1 GB FP8,
// 0.5 GB MXFP4. Qwen2.5-7B's 57,344 B/token bf16 receipt → 28,672 B in FP8.
// Configs: qwen25-7b torch_dtype bf16 (l22); glm53 FP8 e4m3 (l224-228);
// dsv41-flash FP8 (l12-16); gpt-oss + Kimi-K3 MXFP4 experts.

function build() {
  return [
    {
      caption: "One billion params in bf16: <b>2 GB</b> on both sides. The 2023–2024 default both channels start from.",
      state: { stage: 0 },
      notes: { a: "<b>2 GB</b> bf16", b: "<b>2 GB</b> bf16" },
      same: "Same count, same width.",
      hold: 3000,
    },
    {
      caption: "FP8 halves B to <b>1 GB</b> — GLM-5.3's and V4.1-Flash's checkpoint width. A stays bf16.",
      state: { stage: 1 },
      notes: { a: "<b>2 GB</b> bf16", b: "<b>1 GB</b> FP8" },
      delta: "Half the bytes per number.",
      hold: 3000,
    },
    {
      caption: "MXFP4 halves again to <b>0.5 GB</b> — gpt-oss and Kimi-K3 expert width. A 120B model floors at 60 GB; headers read 65.25 GB.",
      state: { stage: 2 },
      notes: { a: "<b>2 GB</b> bf16", b: "<b>0.5 GB</b> MXFP4" },
      delta: "A quarter of the baseline per param.",
      hold: 3000,
    },
    {
      caption: "Caches narrow by the same rule: a 57,344 B bf16 receipt is <b>28,672 B</b> in FP8. Whether an engine offers it is serving configuration.",
      state: { stage: 3 },
      notes: { a: "KV <b>57,344 B</b>/token", b: "KV <b>28,672 B</b>/token" },
      delta: "Bytes halve everywhere, cache included.",
      hold: 3000,
    },
    {
      caption: "Totals for the billion params plus one 131,072-token receipt: A ≈ <b>9.5 GB</b>, B ≈ <b>4.25 GB</b>. Precision is the cheapest multiplier in serving.",
      state: { stage: 4 },
      notes: { a: "<b>9.5 GB</b> all bf16", b: "<b>4.25 GB</b> narrow" },
      same: "Both totals are params-times-width plus receipt-times-width.",
      hold: 3600,
    },
  ];
}

function weighDraw(widths, name, cls) {
  return (r, s, ctx) => {
    const W = 740;
    r.text("head", { x: 0, y: 14, class: "t-label" }, name);
    const steps = [2, 1, 0.5];
    const labels = ["bf16", "FP8", "MXFP4"];
    const active = s.stage >= 3 ? 2 : s.stage >= 1 ? (name.startsWith("A") ? 0 : s.stage) : 0;
    const shown = s.stage >= 3 ? (name.startsWith("A") ? [2, 1] : [0.5, 0.25]) : null;
    steps.forEach((gb, i) => {
      const w = (W * gb) / 2.4;
      const y = 30 + i * 30;
      const on = name.startsWith("A") ? i === 0 : i === Math.min(s.stage, 2);
      const dim = name.startsWith("A") && i > 0;
      const g = r.g("w" + i, 0, y);
      g.rect("r", { width: Math.max(2, w), height: 20, rx: 3, class: on && !dim ? cls + "-solid" : "s-panel" });
      g.text("t", { x: 8, y: 14, class: "t-mono t-xs" + (on && !dim ? " t-inv t-bold" : " t-dim") }, `1B params · ${labels[i]}`);
      g.text("v", { x: w + 8, y: 14, class: "t-mono t-xs" + (on && !dim ? " t-bold" : " t-dim") }, `${gb} GB`);
    });
    if (s.stage >= 3) {
      r.text("kv", { x: 0, y: 134, class: "t-mono t-xs t-bold" }, name.startsWith("A") ? "KV receipt bf16: 57,344 B/token" : "KV receipt FP8: 28,672 B/token");
    } else {
      r.text("kv", { x: 0, y: 134, class: "t-xs t-dim" }, "weight bytes first; the cache step comes next");
    }
  };
}

mountScope("#fig-22-1", {
  label: "Fig 22.1",
  title: "One billion params and one receipt across three precisions",
  width: 760,
  channels: [
    { key: "a", name: "bf16 stack", sub: "2 B per number", height: 156 },
    { key: "b", name: "Narrow stack", sub: "FP8, then MXFP4", height: 156 },
  ],
  build,
  draw: { a: weighDraw(null, "A · bf16 throughout", "s-a"), b: weighDraw(null, "B · FP8, then MXFP4", "s-b") },
});

/* ---- figure 22.2: the float layouts, drawn -----------------------------------
 * Widths to bytes at 170 px per byte: the 16-bit rows are 340 px wide, FP8 is
 * 170, the 4-bit formats 85. Bit layouts per ch22 §22.3: fp16 e5m10, bf16 e8m7,
 * FP8 e4m3, INT4 integers, NVFP4/MXFP4 e2m1 with a wider scale beside it.
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-22-2", {
  width: 760,
  height: 250,
  label: "Same four bytes-vs-bits choices, drawn as bit fields",
  draw(r, ctx) {
    const rows = [
      { name: "FP16 · fp16 (e5m10)", bytes: 2, bits: [["s", 1, "s-ink-o"], ["E", 5, "s-good"], ["M", 10, "s-panel"]], note: "2 B per number" },
      { name: "bf16 · bf16 (e8m7)", bytes: 2, bits: [["s", 1, "s-ink-o"], ["E", 8, "s-good"], ["M", 7, "s-panel"]], note: "2 B · same 16 bits, exponent relabeled" },
      { name: "FP8 · e4m3", bytes: 1, bits: [["s", 1, "s-ink-o"], ["E", 4, "s-good"], ["M", 3, "s-panel"]], note: "1 B · narrower, needs block scales" },
      { name: "INT4 · q_4 (gptq)", bytes: 0.5, bits: [["i", 4, "s-sunk"]], note: "0.5 B · an integer grid, not a float" },
      { name: "FP4 · e2m1 (NVFP4 / MXFP4)", bytes: 0.5, bits: [["s", 1, "s-ink-o"], ["E", 2, "s-good"], ["M", 1, "s-panel"]], note: "0.5 B · FP32 scale beside each group of 16" },
    ];
    const BAR = 170; // px per byte
    rows.forEach((row, i) => {
      const y = 28 + i * 42;
      r.text("n" + i, { x: 0, y: y + 14, class: "t-mono t-sm t-end" }, row.name);
      const total = row.bytes * BAR;
      const bits = row.bits.reduce((s, b) => s + b[1], 0);
      let x = 250;
      row.bits.forEach((b, bi) => {
        const bw = (b[1] / bits) * total;
        const g = r.g("f" + i + ":" + bi, x, y);
        g.rect("r", { width: Math.max(6, bw - 2), height: 26, rx: 3, class: b[2] });
        if (bw > 24) g.text("t", { x: bw / 2, y: 17, class: "t-mono t-xs t-mid" + (b[2] === "s-ink-o" ? " t-inv" : "") }, b[0]);
        else g.text("t", { x: -10, y: 17, class: "t-mono t-xs t-dim" }, b[0]);
        x += bw;
      });
      r.text("b" + i, { x: 252, y: y + 38, class: "t-xs t-dim" }, row.note);
    });
    r.text("cap", { x: 250, y: 244, class: "t-xs t-dim" }, "s = sign bit · E = exponent (range) · M = mantissa (precision) · i = integer bits. More exponent buys range; more mantissa buys precision.");
  },
});
