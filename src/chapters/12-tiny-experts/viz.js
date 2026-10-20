import { mountScope, mountFigure } from "../../assets/js/scope.js";
import { box, chips } from "../../assets/js/prims.js";

// One token's expert picks: Mixtral top-2 of 8 flat (A) against DeepSeek-V3
// top-8 of 256 in ≤4 of 8 groups (B). B's grid shows 8 groups of 32 experts;
// the simulated picks respect the group cap: 8 picks across groups 1, 3, 6.
// dsv3 config.json: n_group 8 (l25), n_routed_experts 256 (l26),
// num_experts_per_tok 8 (l30), topk_group 4 (l60).
const B_PICKS = [35, 41, 70, 99, 100, 105, 201, 210];
const B_GROUPS = [1, 1, 2, 3, 3, 3, 6, 6];

function build() {
  return [
    {
      caption: "One token, two routing problems. A chooses <b>2 of 8</b> flat; B chooses <b>8 of 256</b> across at most <b>4 groups</b>.",
      state: { stage: 0 },
      notes: { a: "<b>8</b> experts, flat", b: "<b>256</b> experts, 8 groups" },
      same: "Both score every expert first.",
      hold: 3000,
    },
    {
      caption: "A keeps experts <b>2 and 5</b>. B's 8 winners land in groups <b>1, 2, 3 and 6</b> — four groups, exactly the cap.",
      state: { stage: 1 },
      notes: { a: "Top-2, renormalized", b: "Top-8 in <b>4</b> groups" },
      delta: "B's picks obey the group cap; A's have no groups.",
      hold: 3000,
    },
    {
      caption: "Eight small experts run on B (44M each) plus the <b>shared expert</b> every token visits. A runs its two big ones (176M each).",
      state: { stage: 2 },
      notes: { a: "<b>352M</b> + attention", b: "<b>396M</b> incl. shared + attention" },
      delta: "Near-equal spend per token, 32x the expert count.",
      hold: 3000,
    },
    {
      caption: "Active MLP per layer: <b>352.3M</b> on A, <b>396.4M</b> on B. Resident: 1.45B vs <b>11.5B</b>. Fineness moves capacity, not cost.",
      state: { stage: 3 },
      notes: { a: "Active <b>352M</b> / 1.45B", b: "Active <b>396M</b> / 11.5B" },
      same: "Both return one vector; both paid per-token, housed in full.",
      hold: 3600,
    },
  ];
}

mountScope("#fig-12-1", {
  label: "Fig 12.1",
  title: "Top-2 of 8 flat against top-8 of 256 in four groups",
  width: 760,
  channels: [
    { key: "a", name: "Mixtral-8x7B", sub: "coarse, flat top-2", height: 210 },
    { key: "b", name: "DeepSeek-V3", sub: "fine, top-8 in ≤4 groups", height: 210 },
  ],
  build,
  draw: {
    a(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "A · 8 experts, picks 2 and 5");
      for (let i = 0; i < 8; i++) {
        const g = r.g("aexp" + i, i * 93, 30);
        const on = s.stage >= 1 && (i === 2 || i === 5);
        g.rect("r", { width: 86, height: 60, rx: 5, class: s.stage === 0 ? "s-panel" : on ? "s-a-solid" : "s-sunk" });
        g.text("e", { x: 43, y: 26, class: "t-mono t-sm t-mid" + (on ? " t-inv t-bold" : "") }, `E${i}`);
        g.text("w", { x: 43, y: 44, class: "t-mono t-xs t-mid" + (on ? " t-inv" : " t-dim") }, "176M");
      }
      r.text("sh", { x: 0, y: 118, class: "t-xs t-dim" }, "no shared expert · no groups");
      r.text("tot", { x: 0, y: 140, class: "t-mono t-sm" }, s.stage >= 3 ? "active 352.3M / resident 1.45B per layer" : s.stage >= 2 ? "2 × 176.2M running" : "scoring 8 experts");
    },
    b(r, s, ctx) {
      r.text("head", { x: 0, y: 14, class: "t-label" }, "B · 8 groups of 32, picks in 4 groups + shared");
      for (let grp = 0; grp < 8; grp++) {
        const g = r.g("grp" + grp, grp * 93, 30);
        const used = s.stage >= 1 && [1, 2, 3, 6].includes(grp);
        g.rect("r", { width: 86, height: 60, rx: 5, class: s.stage === 0 ? "s-panel" : used ? "s-b-solid" : "s-sunk" });
        g.text("e", { x: 43, y: 24, class: "t-mono t-xs t-mid" + (used ? " t-inv t-bold" : "") }, `G${grp}`);
        g.text("w", { x: 43, y: 40, class: "t-mono t-xs t-mid" + (used ? " t-inv" : " t-dim") }, used && s.stage >= 1 ? `${B_GROUPS.filter((x) => x === grp).length} picks` : "32 idle");
      }
      r.text("sh", { x: 0, y: 118, class: "t-mono t-xs" + (s.stage >= 2 ? " t-bold" : " t-dim") }, s.stage >= 2 ? "+ shared expert: always on (44M)" : "+ 1 shared expert every token");
      r.text("tot", { x: 0, y: 140, class: "t-mono t-sm" }, s.stage >= 3 ? "active 396.4M / resident 11.5B per layer" : s.stage >= 2 ? "8 × 44M + shared running" : "scoring 256 experts");
    },
  },
});

/* ---- figure 12.2: group-constrained routing ----------------------------------
 * DeepSeek-V3 pinned config: 256 routed experts (l26), 8 in 8 groups (l25),
 * top-8 per token (l30) chosen within at most 4 groups (l60), 1 shared
 * expert (l27). Each expert 44.0M weights (§12.1).
 * ---------------------------------------------------------------------------- */
mountFigure("#fig-12-2", {
  width: 760,
  height: 250,
  label: "256 experts, eight groups, at most four groups consulted",
  draw(r, ctx) {
    r.text("h1", { x: 0, y: 12, class: "t-label" }, "routed experts: 8 groups × 32");
    for (let i = 0; i < 8; i++) {
      const lit = i === 1 || i === 4;
      box(r, "g" + i, {
        x: i * 92, y: 24, w: 80, h: 38,
        c: lit ? "s-a-solid" : "s-panel",
        title: "g" + i, sub: "32", align: "middle",
        titleCls: "t-mono t-sm t-bold" + (lit ? " t-inv" : ""),
        subCls: "t-mono t-xs" + (lit ? " t-inv" : " t-dim"),
      });
    }
    r.text("g1", { x: 0, y: 78, class: "t-xs t-dim" }, "the router picks the top 8 experts, but only inside at most 4 groups — two lit groups shown");

    r.text("h2", { x: 0, y: 116, class: "t-label" }, "what a token actually runs");
    box(r, "routed", { x: 0, y: 128, w: 300, h: 40, c: "s-panel", title: "8 routed experts", sub: "44.0M weights each", align: "middle", subCls: "t-mono t-xs t-dim t-mid" });
    r.text("plus", { x: 312, y: 152, class: "t-mono t-sm" }, "+");
    box(r, "shared", { x: 330, y: 128, w: 210, h: 40, c: "s-good", title: "1 shared expert", sub: "always on", align: "middle", subCls: "t-mono t-xs t-dim t-mid" });
    r.text("eq", { x: 552, y: 152, class: "t-mono t-sm" }, "=");
    r.text("total", { x: 570, y: 146, class: "t-mono t-sm t-bold" }, "396.4M");
    r.text("total2", { x: 570, y: 160, class: "t-xs t-dim" }, "MLP per MoE layer");

    r.text("cap", { x: 0, y: 200, class: "t-xs t-dim" }, "Fine-grained: 32× the expert count of Mixtral against the same per-token spend. The first 3 layers stay dense (§12.3).");
  },
});
