import { mountScope, mountFigure } from "../../assets/js/scope.js";
import { segbar } from "../../assets/js/prims.js";

// Routing one token at two scales: V3 top-8 of 256 in ≤4 groups (A) against
// Kimi-K3 top-16 of 896 flat plus 2 shared (B). A grid: 8 groups of 32 with
// 8 picks in 3 groups. B grid: 28 groups of 32 (896) with 16 picks spread
// flat, plus a 2-cell shared strip always on.
// dsv3 config.json: n_group 8 (l25), 256 experts (l26), top-8 (l30);
// kimi-k3 config.json: 896 experts (l185), top-16 (l186), 2 shared (l191).
const A_PICKS = [3, 4, 66, 70, 71, 130, 131, 200];
const B_PICKS = [10, 45, 80, 120, 160, 205, 250, 300, 350, 400, 470, 540, 610, 700, 800, 880];

function build() {
  return [
    {
      caption: "One token, two expert pools. A scores <b>256</b> experts in 8 groups; B scores <b>896</b> flat.",
      state: { stage: 0 },
      notes: { a: "<b>256</b> experts, 8 groups", b: "<b>896</b> experts, flat" },
      same: "Both score the whole pool first.",
      hold: 3000,
    },
    {
      caption: "A keeps <b>8</b> in 3 groups (within the 4-group cap). B keeps <b>16 anywhere</b> — no groups to obey.",
      state: { stage: 1 },
      notes: { a: "Top-8 in <b>3</b> groups", b: "Top-16, <b>flat</b>" },
      delta: "Constraint against scale: groups vs flat.",
      hold: 3000,
    },
    {
      caption: "Shared experts join: <b>1</b> on A, <b>2</b> on B — always on, every token, no routing.",
      state: { stage: 2 },
      notes: { a: "+ <b>1</b> shared", b: "+ <b>2</b> shared" },
      same: "Both add the always-on path to the picks.",
      hold: 3000,
    },
    {
      caption: "Running: <b>9</b> experts on A, <b>18</b> on B. Awake shares: <b>3.1%</b> vs <b>1.8%</b>. Resident: 257 vs 898 per layer.",
      state: { stage: 3 },
      notes: { a: "<b>9</b> run, 257 resident", b: "<b>18</b> run, 898 resident" },
      same: "Both return one vector; both house the whole pool.",
      hold: 3600,
    },
  ];
}

function poolDraw(total, cols, picks, shared, name, pickCls) {
  return (r, s, ctx) => {
    const W = 740;
    r.text("head", { x: 0, y: 14, class: "t-label" }, name);
    const cw = W / cols;
    const rows = Math.ceil(total / cols);
    const ch = Math.min(10, 150 / rows);
    for (let i = 0; i < total; i++) {
      const cx = (i % cols) * cw;
      const cy = 26 + Math.floor(i / cols) * (ch + 2);
      const g = r.g("e" + i, cx + 1, cy);
      const on = s.stage >= 1 && picks.includes(i);
      g.rect("r", { width: cw - 2, height: ch, rx: 1.5, class: s.stage === 0 ? "s-panel" : on ? pickCls + "-solid" : "s-sunk" });
    }
    const baseY = 26 + rows * (ch + 2) + 8;
    for (let k = 0; k < shared; k++) {
      const g = r.g("sh" + k, k * 120, baseY);
      g.rect("r", { width: 112, height: 16, rx: 3, class: s.stage >= 2 ? pickCls : "s-panel" });
      g.text("t", { x: 56, y: 12, class: "t-mono t-xs t-mid" + (s.stage >= 2 ? " t-inv" : " t-dim") }, `shared ${k}`);
    }
    r.text("tot", { x: 250, y: baseY + 13, class: "t-mono t-xs" }, s.stage >= 3 ? `${picks.length + shared} run · ${total + shared} resident` : s.stage >= 1 ? `${picks.length} picks + ${shared} shared` : `${total} scored`);
  };
}

mountScope("#fig-15-1", {
  label: "Fig 15.1",
  title: "Top-8 of 256 in groups against top-16 of 896 flat",
  width: 760,
  channels: [
    { key: "a", name: "DeepSeek-V3", sub: "256 experts, top-8 in ≤4 groups", height: 250 },
    { key: "b", name: "Kimi-K3", sub: "896 experts, top-16 flat + 2 shared", height: 250 },
  ],
  build,
  draw: { a: poolDraw(256, 32, A_PICKS, 1, "A · 8 groups of 32", "s-a"), b: poolDraw(896, 56, B_PICKS, 2, "B · flat pool of 896", "s-b") },
});

/* ---- figure 15.2: the awake share across generations -------------------------
 * Routed / awake: Mixtral 8 / 2 (25%), V3 256 / 8 (3.1%), K3 896 / 16 (1.8%).
 * Percentages are the chapter's own (§15.1). Same bar width, honest total.
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-15-2", {
  width: 760,
  height: 220,
  label: "Capacity multiplies; the awake sliver shrinks",
  draw(r, ctx) {
    const rows = [
      { name: "Mixtral-8x7B", n: 8, awake: 2, pct: "25%" },
      { name: "DeepSeek-V3", n: 256, awake: 8, pct: "3.1%" },
      { name: "Kimi-K3", n: 896, awake: 16, pct: "1.8%" },
    ];
    rows.forEach((row, i) => {
      const y = 26 + i * 56;
      r.text("n" + i, { x: 0, y: y + 14, class: "t-mono t-sm t-end" }, row.name);
      segbar(r, "b" + i, {
        x: 150, y: y, w: 470, h: 28, total: row.n, scale: false,
        segs: [
          { id: "aw", n: row.awake, c: "s-a-solid" },
          { id: "rest", n: row.n - row.awake, c: "s-sunk" },
        ],
      });
      r.text("p" + i, { x: 632, y: y + 18, class: "t-mono t-sm t-bold" }, row.pct);
      r.text("s" + i, { x: 150, y: y + 42, class: "t-xs t-dim" }, `${row.awake} of ${row.n} routed experts awake per token`);
    });
    r.text("cap", { x: 0, y: 206, class: "t-xs t-dim" }, "All resident, all reachable: any token can pick any expert, so nothing can be offloaded (chapter 15's placement point).");
  },
});
