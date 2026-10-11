import { mountScope } from "../../assets/js/scope.js";

// One token through a dense MLP (A: Mistral-7B) and a top-2-of-8 MoE block
// (B: Mixtral-8x7B). Expert scores are fixed and tie-free, standing in for the
// router's softmax output; selection mirrors torch.topk(router_probs, top_k)
// in MixtralTopKRouter (modeling_mixtral.py:113). Config: 8 local experts,
// 2 per token (mixtral-8x7b config.json:18,15).
const SCORES = [0.03, 0.11, 0.31, 0.05, 0.09, 0.24, 0.02, 0.15];
const TOP = [2, 5];
const RENORM = [0.31 / 0.55, 0.24 / 0.55];

function build() {
  return [
    {
      caption: "One token vector, width 4,096 on both sides. A runs its single 176M MLP; B scores <b>8 experts</b>.",
      state: { stage: 0, picked: [] },
      notes: { a: "Dense MLP: <b>always on</b>", b: "<b>8</b> router scores" },
      same: "Same input, same width.",
      hold: 3000,
    },
    {
      caption: "The router keeps the top 2: experts <b>2</b> (0.31) and <b>5</b> (0.24). Six experts sit out this token.",
      state: { stage: 1, picked: TOP },
      notes: { a: "No router: <b>176.2M</b> run", b: "Top-2 of <b>8</b>" },
      delta: "B chooses; A has no choice to make.",
      hold: 3000,
    },
    {
      caption: "Weights renormalize to sum to 1: <b>0.564</b> and <b>0.436</b>. Without this the output would shrink.",
      state: { stage: 2, picked: TOP },
      notes: { a: "Weight <b>1.0</b>", b: "Weights <b>0.564 / 0.436</b>" },
      same: "Both sides now hold a convex combination.",
      hold: 3000,
    },
    {
      caption: "Expert 2 runs its full 176M SwiGLU; expert 5 runs its own. The other six stay resident but idle.",
      state: { stage: 3, picked: TOP },
      notes: { a: "<b>176.2M</b> active", b: "<b>2 × 176.2M</b> active, 8 resident" },
      delta: "B spends twice the MLP arithmetic for this token.",
      hold: 3000,
    },
    {
      caption: "Weighted sum, residual add, next block. Active this layer: <b>218M</b> on A, <b>394M</b> on B. Resident: 218M vs <b>1.45B</b>.",
      state: { stage: 4, picked: TOP },
      notes: { a: "Active = resident", b: "Active <b>394M</b> of 1.45B" },
      same: "Both return one vector of width 4,096.",
      hold: 3600,
    },
  ];
}

function expertGrid(r, picked, labels) {
  const cols = 4;
  const cw = 740 / cols;
  for (let i = 0; i < 8; i++) {
    const cx = (i % cols) * cw;
    const cy = 30 + Math.floor(i / cols) * 56;
    const isTop = picked.includes(i);
    const g = r.g("exp" + i, cx + 4, cy);
    g.rect("r", { width: cw - 8, height: 48, rx: 5, class: isTop ? "s-b-solid" : picked.length ? "s-sunk" : "s-panel" });
    g.text("e", { x: (cw - 8) / 2, y: 20, class: "t-mono t-sm t-mid" + (isTop ? " t-inv t-bold" : "") }, `E${i}`);
    g.text("s", { x: (cw - 8) / 2, y: 36, class: "t-mono t-xs t-mid" + (isTop ? " t-inv" : " t-dim") }, labels ? SCORES[i].toFixed(2) : "176M");
  }
}

mountScope("#fig-11-1", {
  label: "Fig 11.1",
  title: "One token through a dense MLP and a top-2-of-8 MoE block",
  width: 760,
  channels: [
    { key: "a", name: "Mistral-7B", sub: "dense MLP, always on", height: 190 },
    { key: "b", name: "Mixtral-8x7B", sub: "8 experts, 2 awake", height: 190 },
  ],
  build,
  draw: {
    a(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "A · one MLP, 176.2M weights");
      const g = r.g("mlp", 170, 40);
      const running = s.stage >= 3;
      g.rect("r", { width: 400, height: 90, rx: 6, class: running ? "s-a-solid" : "s-panel" });
      g.text("t", { x: 200, y: 38, class: "t-mono t-sm t-mid" + (running ? " t-inv t-bold" : "") }, "SwiGLU 4,096 → 14,336 → 4,096");
      g.text("w", { x: 200, y: 60, class: "t-mono t-xs t-mid" + (running ? " t-inv" : " t-dim") }, s.stage >= 1 ? "weight 1.0 · runs unconditionally" : "waiting for the token");
    },
    b(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "B · router scores, top-2 run");
      expertGrid(r, s.stage >= 1 ? TOP : s.picked, s.stage <= 2);
      if (s.stage >= 2) {
        r.text("rn", { x: 0, y: 162, class: "t-mono t-xs" }, `renormalized: E2 ${RENORM[0].toFixed(3)} · E5 ${RENORM[1].toFixed(3)}`);
      } else {
        r.text("rn", { x: 0, y: 162, class: "t-xs t-dim" }, s.stage === 0 ? "scores stand in for the router softmax" : "two winners, six idle residents");
      }
    },
  },
});
