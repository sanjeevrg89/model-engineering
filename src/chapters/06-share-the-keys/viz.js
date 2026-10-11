import { mountScope } from "../../assets/js/scope.js";

// One decode step's KV read for 1,024 cached tokens, layer by layer.
//   Mistral-7B (A): 32 layers, 8 KV heads × 128 × 2 (K/V) × 2 B = 4,096 B per
//     layer per token → 4 MiB per layer for 1,024 tokens; 128 MiB total.
//   Qwen2.5-7B (B): 28 layers, 4 KV heads × 128 × 2 × 2 B = 2,048 B per layer
//     per token → 2 MiB per layer for 1,024 tokens; 56 MiB total.
// qwen25-7b config.json l15-17, mistral-7b config.json l13-15.
const TOKENS = 1024;
const A = { layers: 32, mibPerLayer: 4, totalMib: 128, perTok: 4096 };
const B = { layers: 28, mibPerLayer: 2, totalMib: 56, perTok: 2048 };

function build() {
  const cuts = [0, 8, 16, 24, 28, 32];
  const descs = [
    "1,024 tokens cached on each side. Nothing read yet; per-layer widths differ: <b>4,096 B</b> on A, <b>2,048 B</b> on B.",
    "Layers 1–8 read on both sides: <b>32 MiB</b> on A, <b>16 MiB</b> on B. Same operation, half the width.",
    "Layers 9–16: <b>64 MiB</b> against <b>32 MiB</b>. The gap is the head count, 8 vs 4, times identical depth so far.",
    "Layers 17–24: <b>96 MiB</b> against <b>48 MiB</b>. B has 4 layers left; A has 8.",
    "Layers 25–28: B reads its last layer and finishes at <b>56 MiB</b>. A stands at 112 MiB with 4 layers to go.",
    "Layers 29–32 run on A alone: 16 MiB more, <b>128 MiB</b> total. Depth is a second knob beside width.",
    "Totals for one step over 1,024 tokens: <b>128 MiB</b> on A, <b>56 MiB</b> on B. Chapter 6.3 multiplies this to full context.",
  ];
  const steps = cuts.map((c, i) => {
    const aDone = Math.min(c, A.layers);
    const bDone = Math.min(c, B.layers);
    const step = {
      caption: descs[i],
      state: { aDone, bDone },
      notes: {
        a: `<b>${aDone * A.mibPerLayer} MiB</b> over ${aDone} layers`,
        b: `<b>${bDone * B.mibPerLayer} MiB</b> over ${bDone} layers`,
      },
      hold: 3000,
    };
    if (i === 0) step.same = "Same workload, different widths.";
    if (i === 4) step.delta = "B finishes at 28 layers; A keeps reading.";
    if (i === 5) step.delta = "A's extra depth reads alone.";
    if (i === 6) step.same = "Both totals are one formula: layers × heads × width.";
    return step;
  });
  return steps;
}

function layerDraw(cfg, name) {
  return (r, s, ctx) => {
    const W = 740;
    r.text("head", { x: 0, y: 14, class: "t-label" }, `${name} · ${cfg.perTok.toLocaleString("en-US")} B per layer per token`);
    const n = cfg.layers;
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const done = i < (name.startsWith("A") ? s.aDone : s.bDone);
      const g = r.g("lay" + i, i * bw, 26);
      g.rect("r", { width: Math.max(1, bw - 1.5), height: 46, rx: 2, class: done ? (name.startsWith("A") ? "s-a-solid" : "s-b-solid") : "s-panel" });
    }
    const done = name.startsWith("A") ? s.aDone : s.bDone;
    r.text("tot", { x: 0, y: 100, class: "t-mono t-sm" }, `${done}/${n} layers`);
    r.text("mib", { x: W, y: 100, class: "t-mono t-bold t-end" }, `${done * cfg.mibPerLayer} MiB`);
    const frac = done / n;
    const bg = r.g("bar", 0, 110);
    bg.rect("r", { width: W, height: 12, rx: 3, class: "s-sunk" });
    if (frac > 0) {
      const fg = r.g("fill", 0, 110);
      fg.rect("r", { width: Math.max(2, W * frac), height: 12, rx: 3, class: name.startsWith("A") ? "s-a" : "s-b" });
    }
    r.text("foot", { x: 0, y: 142, class: "t-xs t-dim" }, `1,024 tokens × ${cfg.layers} layers · total ${cfg.totalMib} MiB`);
  };
}

mountScope("#fig-6-1", {
  label: "Fig 6.1",
  title: "One step's KV read for 1,024 cached tokens, layer by layer",
  width: 760,
  channels: [
    { key: "a", name: "Mistral-7B", sub: "8 KV heads, 32 layers", height: 158 },
    { key: "b", name: "Qwen2.5-7B", sub: "4 KV heads, 28 layers", height: 158 },
  ],
  build,
  draw: { a: layerDraw(A, "A · Mistral-7B"), b: layerDraw(B, "B · Qwen2.5-7B") },
});
