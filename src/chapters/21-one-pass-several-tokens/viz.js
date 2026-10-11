import { mountScope } from "../../assets/js/scope.js";

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
