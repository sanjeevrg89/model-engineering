import { mountScope, mountFigure } from "../../assets/js/scope.js";
import { tokens, arrow } from "../../assets/js/prims.js";

// One decode step's KV read for 1,024 cached tokens, layer by layer.
//   Qwen3-8B (A): 36 layers, 8 KV heads × 128 × 2 (K/V) × 2 B = 4,096 B per
//     layer per token → 4 MiB per layer for 1,024 tokens; 144 MiB total.
//   gpt-oss-120B (B): 36 layers, 8 KV heads × 64 × 2 × 2 B = 2,048 B per layer
//     per token, but the 128-token window reads only 128 of the 1,024 cached
//     tokens → 0.25 MiB per layer; 9 MiB total.
// qwen3-8b config.json l17-19, gptoss-120b config.json l55-58, l9, l82.
const A = { layers: 36, mibPerLayer: 4, totalMib: 144, perTok: 4096, tokens: 1024 };
const B = { layers: 36, mibPerLayer: 0.25, totalMib: 9, perTok: 2048, tokens: 128 };

function build() {
  const cuts = [0, 12, 24, 36];
  const descs = [
    "1,024 tokens cached on each side. A reads <b>all of them</b>; B's 128-token window reads <b>128</b>. Per-layer widths: <b>4,096 B</b> on A, <b>2,048 B</b> on B.",
    "Layers 1–12: <b>48 MiB</b> on A, <b>3 MiB</b> on B. Narrow heads halve it; the window quarters it again.",
    "Layers 13–24: <b>96 MiB</b> against <b>6 MiB</b>. Same 36 layers each — depth is no longer the difference.",
    "Layers 25–36: A finishes at <b>144 MiB</b>, B at <b>9 MiB</b> — a 16x gap from heads, width and window combined.",
  ];
  return cuts.map((c, i) => {
    const step = {
      caption: descs[i],
      state: { aDone: c, bDone: c },
      notes: {
        a: `<b>${c * A.mibPerLayer} MiB</b> over ${c} layers × 1,024 tokens`,
        b: `<b>${c * B.mibPerLayer} MiB</b> over ${c} layers × 128 tokens`,
      },
      hold: 3000,
    };
    if (i === 0) step.same = "Same cached past, different reads.";
    if (i === 3) step.delta = "16x less traffic: half the heads' width, one eighth of the tokens.";
    return step;
  });
}

function layerDraw(cfg, name) {
  return (r, s, ctx) => {
    const W = 740;
    r.text("head", { x: 0, y: 14, class: "t-label" }, `${name} · ${cfg.perTok.toLocaleString("en-US")} B per layer per token · reads ${cfg.tokens} tokens`);
    const n = cfg.layers;
    const bw = W / n;
    const done = name.startsWith("A") ? s.aDone : s.bDone;
    for (let i = 0; i < n; i++) {
      const g = r.g("lay" + i, i * bw, 26);
      g.rect("r", { width: Math.max(1, bw - 1.5), height: 46, rx: 2, class: i < done ? (name.startsWith("A") ? "s-a-solid" : "s-b-solid") : "s-panel" });
    }
    r.text("tot", { x: 0, y: 100, class: "t-mono t-sm" }, `${done}/${n} layers`);
    const mib = done * cfg.mibPerLayer;
    r.text("mib", { x: W, y: 100, class: "t-mono t-bold t-end" }, `${Number.isInteger(mib) ? mib : mib.toFixed(2)} MiB`);
    const fg = r.g("fill", 0, 110);
    fg.rect("r", { width: W, height: 12, rx: 3, class: "s-sunk" });
    const bg = r.g("bar", 0, 110);
    bg.rect("r", { width: Math.max(2, (W * done) / n), height: 12, rx: 3, class: name.startsWith("A") ? "s-a" : "s-b" });
    r.text("foot", { x: 0, y: 142, class: "t-xs t-dim" }, `${cfg.tokens.toLocaleString("en-US")} tokens read × ${cfg.layers} layers · total ${cfg.totalMib} MiB`);
  };
}

mountScope("#fig-6-1", {
  label: "Fig 6.1",
  title: "One step's KV read: full 1,024 against windowed 128",
  width: 760,
  channels: [
    { key: "a", name: "Qwen3-8B", sub: "8 KV heads, full context", height: 158 },
    { key: "b", name: "gpt-oss-120B", sub: "8 narrow heads, window 128", height: 158 },
  ],
  build,
  draw: { a: layerDraw(A, "A · Qwen3-8B"), b: layerDraw(B, "B · gpt-oss-120B") },
});

/* ---- figure 6.2: grouped-query sharing, drawn --------------------------------
 * One group per model, with the real repeats: Qwen3-8B 4 queries per KV head
 * (32 q / 8 kv, repeat 4); gpt-oss-120B 8 queries per KV head (64 q / 8 kv,
 * repeat 8). Pinned configs: qwen3-8b l12/l11, gptoss-120b head_dim 64.
 * ---------------------------------------------------------------------------- */
function groupDraw(r, ctx, q, id, note) {
  const w = 18, gap = 3;
  const items = [];
  for (let i = 0; i < q; i++) items.push({ t: "Q", c: "s-ink-o", tc: "t-mono t-xs t-inv" });
  tokens(r, "q" + id, { x: 0, y: 0, w, h: 20, gap, items, textCls: "t-mono t-xs t-inv" });
  const lastX = q * (w + gap) - gap + 26;
  arrow(r, "ar" + id, ctx, { x1: q * (w + gap) + 2, y1: 10, x2: lastX + 14, y2: 10, cls: "l-2" });
  tokens(r, "kv" + id, {
    x: lastX + 18, y: 0, w: 54, h: 20, gap: 2,
    items: [{ t: "KV", c: "s-good" }],
    textCls: "t-mono t-xs t-bold",
  });
  r.text("n" + id, { x: lastX + 84, y: 13, class: "t-xs t-2" }, note);
}

mountFigure("#fig-6-2", {
  width: 760,
  height: 150,
  label: "Grouped-query attention: what one group looks like",
  draw(r, ctx) {
    r.text("ha", { x: 0, y: 14, class: "t-label" }, "A · Qwen3-8B — 32 queries share 8 KV heads, ×4");
    groupDraw(r, ctx, 4, "a", "each KV head: 128 numbers wide");
    r.text("hb", { x: 0, y: 76, class: "t-label" }, "B · gpt-oss-120B — 64 queries share 8 KV heads, ×8");
    groupDraw(r, ctx, 8, "b", "each KV head: 64 numbers wide");

    r.text("cap", { x: 0, y: 108, class: "t-xs t-dim" }, "The other groups are the same picture. Only the KV heads are stored, projected and cached —");
    r.text("cap2", { x: 0, y: 124, class: "t-xs t-dim" }, "so a deeper stack of 36 layers with 8 KV heads paying 2 × 8 × head_dim bytes per token per layer.");
  },
});
