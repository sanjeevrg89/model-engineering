import { mountScope, mountFigure } from "../../assets/js/scope.js";
import { box, tokens, arrow } from "../../assets/js/prims.js";

// Generating 3 tokens: three sequential target passes (A) against draft-3
// plus one verify pass (B). Acceptance is a reader-set parameter, not a
// measurement: the figure supposes 2 of 3 drafts verify and says so.
// DSpark's block size is 5 (dsv41-flash config.json:146); the figure uses 3
// drafts to keep the mechanism legible.
const DRAFTS = ["t1", "t2", "t3"];

function build() {
  return [
    {
      caption: "Three tokens wanted. A will run the target <b>3 times</b>. B drafts <b>3 tokens</b> cheaply first.",
      state: { stage: 0, verified: 0 },
      notes: { a: "<b>0</b> of 3 yet", b: "Drafting <b>3</b>" },
      same: "Both start from the same prefix.",
      hold: 3000,
    },
    {
      caption: "A completes pass 1: <b>1 token</b>. B's draft block stands ready — t1, t2, t3 proposed by the tiny MoE.",
      state: { stage: 1, verified: 0 },
      notes: { a: "<b>1</b> of 3 (1 pass)", b: "3 proposed, <b>0</b> verified" },
      delta: "A banks a token; B has proposals, not tokens.",
      hold: 3000,
    },
    {
      caption: "A completes pass 2: <b>2 tokens</b>. B runs <b>one target pass</b> over all 3 drafts at once.",
      state: { stage: 2, verified: 0 },
      notes: { a: "<b>2</b> of 3 (2 passes)", b: "Verifying <b>3</b> in 1 pass" },
      delta: "Parallel scoring is the only step B needs from the target.",
      hold: 3000,
    },
    {
      caption: "Suppose <b>2 of 3 verify</b> (acceptance is yours to set). B banks t1, t2, and the target's correction t3′.",
      state: { stage: 3, verified: 2 },
      notes: { a: "<b>2</b> of 3 (2 passes)", b: "<b>3</b> of 3 (1 target pass)" },
      delta: "Same 3 tokens, one expensive pass instead of three.",
      hold: 3000,
    },
    {
      caption: "A runs pass 3 for its last token. B is done: <b>3 tokens for 1 target pass</b> plus draft cost — a win iff drafts stay cheap and acceptance stays high.",
      state: { stage: 4, verified: 2 },
      notes: { a: "<b>3</b> of 3 (3 passes)", b: "Done: <b>3</b> tokens, 1 pass" },
      same: "The arithmetic holds for any acceptance you plug in.",
      hold: 3600,
    },
  ];
}

function tokenRow(r, prefix, list, accepted, cls, y) {
  list.forEach((t, i) => {
    const g = r.g(prefix + i, 20 + i * 150, y);
    const good = accepted === null || i < accepted;
    g.rect("r", { width: 140, height: 40, rx: 5, class: good ? cls + "-solid" : "s-sunk" });
    g.text("t", { x: 70, y: 25, class: "t-mono t-sm t-mid" + (good ? " t-inv t-bold" : "") }, t);
  });
}

mountScope("#fig-21-1", {
  label: "Fig 21.1",
  title: "Three tokens sequential against draft-3 plus one verify pass",
  width: 760,
  channels: [
    { key: "a", name: "Sequential", sub: "3 target passes", height: 150 },
    { key: "b", name: "Draft-and-verify", sub: "draft 3, verify once", height: 150 },
  ],
  build,
  draw: {
    a(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "A · one token per target pass");
      const n = [0, 1, 2, 2, 3][s.stage];
      tokenRow(r, "a", ["t1", "t2", "t3"], n, "s-a", 34);
      r.text("passes", { x: 0, y: 110, class: "t-mono t-sm" }, `target passes so far: ${[0, 1, 2, 2, 3][s.stage]}`);
    },
    b(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "B · drafts proposed, then verified");
      if (s.stage < 3) {
        tokenRow(r, "b", DRAFTS, null, "s-b", 34);
        r.text("st", { x: 0, y: 110, class: "t-xs t-dim" }, s.stage < 2 ? "drafts: cheap proposals, not tokens yet" : "one target pass scores all 3");
      } else {
        tokenRow(r, "b", ["t1", "t2", "t3′"], 3, "s-b", 34);
        r.text("st", { x: 0, y: 110, class: "t-mono t-sm t-bold" }, "2 verified + 1 correction · 1 target pass");
      }
    },
  },
});

/* ---- figure 21.2: the DSpark block machine -----------------------------------
 * V4.1-Flash pinned config: 3 prediction layers (l145), block 5 with a noise
 * token (l146/l147), verify at target layers 37-39 (l148), drafter is a tiny
 * MoE of 128 experts / 3 active (l154/l155), rank-256 Markov chain (l153).
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-21-2", {
  width: 760,
  height: 250,
  label: "DSpark: draft a 5-token block, verify once",
  draw(r, ctx) {
    box(r, "draft", { x: 0, y: 56, w: 150, h: 46, c: "s-panel", title: "drafter", sub: "3 of 128 experts · rank 256" });
    arrow(r, "a1", ctx, { x1: 150, y1: 79, x2: 186, y2: 79 });

    const items = [
      { t: "d1", c: "s-a-solid", tc: "t-mono t-xs t-inv" },
      { t: "d2", c: "s-a-solid", tc: "t-mono t-xs t-inv" },
      { t: "d3", c: "s-a-solid", tc: "t-mono t-xs t-inv" },
      { t: "d4", c: "s-a-solid", tc: "t-mono t-xs t-inv" },
      { t: "n", c: "s-sunk", tc: "t-mono t-xs t-dim" },
    ];
    chips(r, "block", { x: 190, y: 68, title: null, items, w: 34, h: 22, gap: 3 });
    r.text("bl", { x: 190, y: 104, class: "t-xs t-dim" }, "5-token block; n is the dedicated noise token");

    arrow(r, "a2", ctx, { x1: 398, y1: 79, x2: 434, y2: 79 });
    box(r, "verify", { x: 438, y: 56, w: 170, h: 46, c: "s-b-solid", title: "verify", sub: "target layers 37–39", titleCls: "t-bold" });

    r.text("accept", { x: 438, y: 140, class: "t-label" }, "accept the longest verified prefix");
    tokens(r, "res", { x: 438, y: 152, w: 30, h: 22, items: [
      { t: "d1", c: "s-good", tc: "t-mono t-xs t-bold" },
      { t: "d2", c: "s-good", tc: "t-mono t-xs t-bold" },
      { t: "d3", c: "s-good", tc: "t-mono t-xs t-bold" },
      { t: "d4", c: "s-sunk", tc: "t-mono t-xs t-dim" },
    ], gap: 3 });
    r.text("rej", { x: 588, y: 166, class: "t-xs t-dim" }, "one draft rejected → one target pass still banked 3 tokens (§21.1)");

    r.text("c1", { x: 0, y: 218, class: "t-xs t-dim" }, "Drafting costs a fraction of a target pass (a tiny MoE); the rate that decides is α, measured on your traffic. §21.4's yield formula (1 − α^{k+1}) / (1 − α)");
    r.text("c2", { x: 0, y: 234, class: "t-xs t-dim" }, "gives the expectation for a block of k drafts; the picture above only shows one possible outcome: 3 banked, d4 rejected. Pinned numbers: 3 layers, block 5, targets 37–39.");
  },
});
