import { mountScope } from "../../assets/js/scope.js";

// Attending over 8,192 past tokens: dense MLA reads all 8,192 latents (A:
// DeepSeek-V3.2-Exp without selection), indexed top-k reads 2,048 winners
// (B: with index_topk 2,048). Each grid cell stands for 128 tokens: 64 cells
// hold the past, 16 lit cells are the winners. Selection is per query;
// dsv32-exp config.json: index_topk 2,048 (l15), norm_topk_prob true (l26).
const CELLS = 64;
const PER_CELL = 128;
const WINNERS = [3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63];

function build() {
  return [
    {
      caption: "<b>8,192</b> past tokens cached on each side (64 cells of 128). Nothing scored, nothing read yet.",
      state: { stage: 0 },
      notes: { a: "<b>8,192</b> latents stored", b: "<b>8,192</b> latents stored" },
      same: "Storage is identical and stays that way.",
      hold: 3000,
    },
    {
      caption: "B's indexer scores all 8,192 positions with lightweight dot-product heads. A has no scorer and skips this step.",
      state: { stage: 1 },
      notes: { a: "No scorer: proceeds to attend", b: "<b>8,192</b> scores, no values" },
      delta: "The indexer is B's extra pass — small heads, no value traffic.",
      hold: 3000,
    },
    {
      caption: "Top-<b>2,048</b> positions kept (16 cells), renormalized. Winners scatter across the whole past — including cell 3 near the start.",
      state: { stage: 2 },
      notes: { a: "Still whole: no selection", b: "<b>16</b> cells kept of 64" },
      delta: "Relevance, not recency: early cells can win.",
      hold: 3000,
    },
    {
      caption: "Full MLA runs: over <b>8,192</b> latents on A, over <b>2,048</b> winners on B. Reads fall to one quarter; storage never moved.",
      state: { stage: 3 },
      notes: { a: "Reads <b>8,192</b> latents", b: "Reads <b>2,048</b> latents" },
      delta: "One quarter of the HBM traffic for the attention kernel.",
      hold: 3600,
    },
  ];
}

function grid(r, s, winners, cls) {
  const cols = 8;
  const cw = 740 / cols;
  for (let i = 0; i < CELLS; i++) {
    const cx = (i % cols) * cw;
    const cy = 30 + Math.floor(i / cols) * 22;
    const g = r.g("cell" + i, cx + 2, cy);
    let c = "s-panel";
    if (s.stage >= 1 && winners) c = "s-sunk";
    if (s.stage >= 2 && winners && winners.includes(i)) c = cls + "-solid";
    if (s.stage >= 3 && !winners) c = cls;
    if (s.stage >= 1 && !winners && s.stage < 3) c = "s-sunk";
    g.rect("r", { width: cw - 4, height: 18, rx: 2, class: c });
  }
}

mountScope("#fig-9-1", {
  label: "Fig 9.1",
  title: "8,192 cached tokens: dense read against indexed top-2,048",
  width: 760,
  channels: [
    { key: "a", name: "Dense MLA", sub: "reads all 8,192", height: 252 },
    { key: "b", name: "Indexed top-k", sub: "scores 8,192, reads 2,048", height: 252 },
  ],
  build,
  draw: {
    a(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "A · no indexer, full MLA");
      grid(r, s, null, "s-a");
      const label =
        s.stage === 0 ? "8,192 latents stored (64 cells × 128)" :
        s.stage <= 2 ? "no scorer — waiting to attend over everything" :
        "attending over all 8,192 latents";
      r.text("st", { x: 0, y: 232, class: s.stage >= 3 ? "t-mono t-sm t-bold" : "t-xs t-dim" }, label);
    },
    b(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "B · indexer + top-2,048 MLA");
      grid(r, s, WINNERS, "s-b");
      const label =
        s.stage === 0 ? "8,192 latents stored (64 cells × 128)" :
        s.stage === 1 ? "indexer scoring: 8,192 dot products, no values" :
        s.stage === 2 ? "16 winner cells kept, renormalized" :
        "attending over 2,048 winners · 1/4 of the reads";
      r.text("st", { x: 0, y: 232, class: s.stage >= 2 ? "t-mono t-sm t-bold" : "t-xs t-dim" }, label);
    },
  },
});
