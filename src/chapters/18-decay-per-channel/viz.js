import { mountScope } from "../../assets/js/scope.js";

// Updating one memory row of 8 features. A (Gated DeltaNet): one scalar gate
// g = 0.7 decays the whole row. B (Kimi Delta Attention): a per-channel decay
// vector keeps syntax channels and drops stale ones. Values are fixed and
// illustrate the resolution difference, not a real model state.
const OLD = [0.8, 0.7, 0.9, 0.4, 0.6, 0.75, 0.5, 0.65];
const NEW = [0.2, 0.9, 0.1, 0.8, 0.3, 0.1, 0.7, 0.2];
const G_SCALAR = 0.7;
const G_CHAN = [0.9, 0.3, 0.95, 0.2, 0.85, 0.25, 0.9, 0.35];
const BETA = 0.8;

function build() {
  const updA = OLD.map((o, i) => G_SCALAR * o + BETA * NEW[i]);
  const updB = OLD.map((o, i) => G_CHAN[i] * o + BETA * NEW[i]);
  return [
    {
      caption: "One memory row, 8 features, holding the past: identical on both sides before the update.",
      state: { stage: 0, a: OLD, b: OLD, gates: null },
      notes: { a: "State: <b>8</b> features", b: "State: <b>8</b> features" },
      same: "Same state, same incoming token.",
      hold: 3000,
    },
    {
      caption: "A new token arrives with update strength <b>0.8</b> on both sides. Nothing forgotten yet.",
      state: { stage: 1, a: OLD, b: OLD, gates: null },
      notes: { a: "Update β = <b>0.8</b>", b: "Update β = <b>0.8</b>" },
      same: "Same write pressure on both sides.",
      hold: 3000,
    },
    {
      caption: "Gates computed. A: one scalar <b>0.7</b> for the whole row. B: <b>8 independent decays</b> — 0.9 keeps, 0.2 drops.",
      state: { stage: 2, a: OLD, b: OLD, gates: true },
      notes: { a: "<b>1</b> gate value", b: "<b>8</b> gate values" },
      delta: "Resolution is the whole difference: row-wise vs channel-wise forgetting.",
      hold: 3000,
    },
    {
      caption: "Updated rows. A decayed everything uniformly; B kept features <b>0, 2, 4, 6</b> and dropped <b>1, 3, 5, 7</b>.",
      state: { stage: 3, a: updA, b: updB, gates: null },
      notes: { a: "Uniform decay ×<b>0.7</b>", b: "Selective decay per channel" },
      delta: "Same write, different memory: B's row keeps what mattered.",
      hold: 3000,
    },
    {
      caption: "The next query reads the rows. A's stale features linger at 0.7 strength; B's were forgotten on purpose. Finer gates, longer useful memory.",
      state: { stage: 4, a: updA, b: updB, gates: null },
      notes: { a: "Read: uniform past", b: "Read: curated past" },
      same: "Both rows are fixed-size; only the forgetting differed.",
      hold: 3600,
    },
  ];
}

function rowDraw(values, gates, name, gateFmt) {
  return (r, s, ctx) => {
    const W = 740;
    r.text("head", { x: 0, y: 14, class: "t-label" }, name);
    const vals = s.stage >= 3 ? (name.startsWith("A") ? s.a : s.b) : values;
    vals.forEach((v, i) => {
      const g = r.g("f" + i, i * 93, 26);
      const h = Math.max(3, v * 70);
      g.rect("r", { width: 84, height: h, rx: 3, class: s.stage === 0 ? "s-panel" : name.startsWith("A") ? "s-a" : "s-b" });
      g.text("v", { x: 42, y: h + 15, class: "t-mono t-xs t-mid t-dim" }, v.toFixed(2));
    });
    if (s.gates) {
      r.text("g", { x: 0, y: 140, class: "t-mono t-xs t-bold" }, gateFmt);
    } else {
      r.text("g", { x: 0, y: 140, class: "t-xs t-dim" }, s.stage < 2 ? "gates not yet computed" : s.stage >= 3 ? "memory updated: old × gate + 0.8 × new" : "incoming update, strength 0.8");
    }
  };
}

mountScope("#fig-18-1", {
  label: "Fig 18.1",
  title: "One memory row updated with a scalar gate and with channel-wise decay",
  width: 760,
  channels: [
    { key: "a", name: "Gated DeltaNet", sub: "one gate per head", height: 162 },
    { key: "b", name: "Kimi Delta Attention", sub: "one decay per channel", height: 162 },
  ],
  build,
  draw: {
    a: rowDraw(OLD, null, "A · scalar gate g = 0.7", "gates: [0.7] — one value for all 8 features"),
    b: rowDraw(OLD, null, "B · per-channel decays", "gates: [0.9 0.3 0.95 0.2 0.85 0.25 0.9 0.35]"),
  },
});
