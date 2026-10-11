import { mountScope } from "../../assets/js/scope.js";

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
