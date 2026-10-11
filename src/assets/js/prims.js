// Shared drawing vocabulary for scopes and figures.
// Every primitive takes a keyed renderer `r` (see scope.js) and a key prefix,
// so the same element keeps its identity from one step to the next.

import { arrowUrl } from "./scope.js";

const t = (r, key, x, y, s, cls) => r.text(key, { x, y, class: cls }, s);

/** a row (or wrapped grid) of token cells */
export function tokens(r, key, o) {
  const {
    x = 0,
    y = 0,
    items,
    w = 22,
    h = 22,
    gap = 2,
    wrap = Infinity,
    textCls = "t-mono t-sm t-mid",
  } = o;
  const g = r.g(key, x, y);
  items.forEach((it, i) => {
    const col = i % wrap;
    const row = Math.floor(i / wrap);
    const cell = g.g(it.id ?? i, col * (w + gap), row * (h + gap));
    cell.rect("r", { width: w, height: h, rx: 3, class: it.c || "s-panel" });
    if (it.t != null) cell.text("t", { x: w / 2, y: h / 2 + 3.8, class: it.tc || textCls }, it.t);
    if (it.mark) cell.rect("m", { x: 1.5, y: h - 4, width: w - 3, height: 2.2, rx: 1, class: it.mark });
  });
  const cols = Math.min(items.length, wrap);
  const rows = Math.ceil(items.length / wrap) || 0;
  return { width: cols * (w + gap) - gap, height: rows * (h + gap) - gap, g };
}

/** a labelled box (process, buffer, component) */
export function box(r, key, o) {
  const {
    x = 0,
    y = 0,
    w = 120,
    h = 40,
    c = "s-panel",
    rx = 4,
    title,
    sub,
    titleCls = "t-bold",
    subCls = "t-mono t-xs t-dim",
    align = "left",
    pad = 10,
  } = o;
  const g = r.g(key, x, y);
  g.rect("r", { width: w, height: h, rx, class: c });
  const tx = align === "middle" ? w / 2 : pad;
  const anchor = align === "middle" ? " t-mid" : "";
  if (title != null) {
    const ty = sub ? h / 2 - 2 : h / 2 + 4;
    g.text("t", { x: tx, y: ty, class: titleCls + anchor }, title);
  }
  if (sub != null) g.text("s", { x: tx, y: h / 2 + 12, class: subCls + anchor }, sub);
  return g;
}

/** a grid of KV blocks / pages */
export function blocks(r, key, o) {
  const { x = 0, y = 0, items, cols = 8, w = 40, h = 28, gap = 4, textCls = "t-mono t-xs t-mid" } = o;
  const g = r.g(key, x, y);
  items.forEach((it, i) => {
    const cx = (i % cols) * (w + gap);
    const cy = Math.floor(i / cols) * (h + gap);
    const cell = g.g(it.id ?? i, cx, cy);
    cell.rect("r", { width: w, height: h, rx: 3, class: it.c || "s-free" });
    if (it.t != null) cell.text("t", { x: w / 2, y: it.s != null ? h / 2 : h / 2 + 3.6, class: it.tc || textCls }, it.t);
    if (it.s != null) cell.text("s", { x: w / 2, y: h / 2 + 10, class: "t-mono t-mid t-dim", "font-size": 8 }, it.s);
    if (it.badge) {
      cell.circle("b", { cx: w - 4, cy: 4, r: 3.4, class: it.badge });
    }
  });
  const rows = Math.ceil(items.length / cols);
  return { width: cols * (w + gap) - gap, height: rows * (h + gap) - gap, g };
}

/** a titled run of chips: a queue, a batch, a free list */
export function chips(r, key, o) {
  const {
    x = 0,
    y = 0,
    title,
    items,
    w = 44,
    h = 22,
    gap = 4,
    titleW = 0,
    empty = "empty",
    textCls = "t-mono t-xs t-mid",
  } = o;
  const g = r.g(key, x, y);
  if (title) g.text("title", { x: 0, y: h / 2 + 3.5, class: "t-label" }, title);
  const x0 = titleW;
  if (!items.length && empty) g.text("empty", { x: x0, y: h / 2 + 3.5, class: "t-mono t-xs t-dim" }, empty);
  items.forEach((it, i) => {
    const iw = it.w || w;
    const prevW = items.slice(0, i).reduce((s, p) => s + (p.w || w) + gap, 0);
    const c = g.g(it.id ?? i, x0 + prevW, 0);
    c.rect("r", { width: iw, height: h, rx: 4, class: it.c || "s-ink-o" });
    c.text("t", { x: iw / 2, y: h / 2 + 3.6, class: it.tc || textCls }, it.t);
  });
  return g;
}

/** a segmented capacity bar: a token budget, a memory pool */
export function segbar(r, key, o) {
  const { x = 0, y = 0, w = 600, h = 18, total, segs, label, scale = true, unit = "" } = o;
  const g = r.g(key, x, y);
  g.rect("frame", { width: w, height: h, rx: 3, class: "s-free" });
  let acc = 0;
  for (const s of segs) {
    const sw = (s.n / total) * w;
    const seg = g.g(s.id, (acc / total) * w, 0);
    seg.rect("r", { width: Math.max(0, sw - 1), height: h, rx: 2, class: s.c || "s-ink-o" });
    if (s.t && sw > 26) seg.text("t", { x: sw / 2, y: h / 2 + 3.6, class: s.tc || "t-mono t-xs t-mid" }, s.t);
    acc += s.n;
  }
  if (label) g.text("label", { x: 0, y: -7, class: "t-label" }, label);
  if (scale) {
    g.text("used", { x: w, y: -7, class: "t-mono t-xs t-end t-2" }, `${acc}/${total}${unit}`);
  }
  return { used: acc, g };
}

/** straight or curved arrow */
export function arrow(r, key, ctx, o) {
  const { x1, y1, x2, y2, kind = "ink", cls = "l-ink", bend = 0, dash = false, head = true } = o;
  let d;
  if (bend) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - bend;
    d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
  } else {
    d = `M${x1},${y1} L${x2},${y2}`;
  }
  return r.path(key, {
    d,
    class: cls + (dash ? " l-dash" : ""),
    "marker-end": head ? arrowUrl(ctx, kind) : null,
  });
}

/** elbow connector: horizontal out, vertical, horizontal in */
export function elbow(r, key, ctx, o) {
  const { x1, y1, x2, y2, kind = "ink", cls = "l-ink", head = true, r: rad = 6 } = o;
  const mx = (x1 + x2) / 2;
  const dy = Math.sign(y2 - y1) * Math.min(rad, Math.abs(y2 - y1) / 2);
  const dx = Math.sign(x2 - x1) * Math.min(rad, Math.abs(mx - x1));
  const d =
    Math.abs(y2 - y1) < 1
      ? `M${x1},${y1} L${x2},${y2}`
      : `M${x1},${y1} L${mx - dx},${y1} Q${mx},${y1} ${mx},${y1 + dy} L${mx},${y2 - dy} Q${mx},${y2} ${mx + dx},${y2} L${x2},${y2}`;
  return r.path(key, { d, class: cls, "marker-end": head ? arrowUrl(ctx, kind) : null });
}

/** a span bracket with a label: ⎣___label___⎦ */
export function bracket(r, key, o) {
  const { x1, x2, y, label, up = false, cls = "l-2", textCls = "t-mono t-xs t-mid t-2", tick = 5 } = o;
  const s = up ? -1 : 1;
  const d = `M${x1},${y - s * tick} L${x1},${y} L${x2},${y} L${x2},${y - s * tick}`;
  r.path(key + ":p", { d, class: cls });
  if (label != null) r.text(key + ":t", { x: (x1 + x2) / 2, y: y + s * 13 + (up ? 4 : 0), class: textCls }, label);
}

/** horizontal tidy tree. nodes: [{id, parent, ...}]; drawNode(g, node, w, h) */
export function htree(r, key, ctx, o) {
  const { x = 0, y = 0, nodes, levelW = 150, rowH = 34, nodeW = 120, nodeH = 26, drawNode, edgeCls } = o;
  const byId = new Map(nodes.map((n) => [n.id, { ...n, kids: [] }]));
  let root = null;
  for (const n of byId.values()) {
    if (n.parent == null) root = n;
    else byId.get(n.parent)?.kids.push(n);
  }
  if (!root) return null;
  let slot = 0;
  const place = (n, depth) => {
    n.depth = depth;
    n.w = n.w || nodeW;
    if (!n.kids.length) {
      n.cy = slot * rowH + nodeH / 2;
      slot += 1;
    } else {
      n.kids.forEach((k) => place(k, depth + 1));
      n.cy = (n.kids[0].cy + n.kids[n.kids.length - 1].cy) / 2;
    }
    n.cx = depth * levelW;
  };
  place(root, 0);
  const g = r.g(key, x, y);
  for (const n of byId.values()) {
    if (n.parent == null) continue;
    const p = byId.get(n.parent);
    const x1 = p.cx + p.w;
    const y1 = p.cy;
    const x2 = n.cx;
    const y2 = n.cy;
    const mx = x1 + (x2 - x1) * 0.5;
    g.path("e:" + n.id, {
      d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
      class: (typeof edgeCls === "function" ? edgeCls(n) : edgeCls) || "l-2",
    });
  }
  for (const n of byId.values()) {
    const ng = g.g("n:" + n.id, n.cx, n.cy - nodeH / 2);
    drawNode(ng, n, n.w, nodeH);
  }
  return { height: slot * rowH, g, nodes: byId };
}

/** a time ruler with ticks */
export function ruler(r, key, o) {
  const { x = 0, y = 0, w, from = 0, to = 10, ticks = 10, fmt = (v) => v, label } = o;
  const g = r.g(key, x, y);
  g.line("axis", { x1: 0, y1: 0, x2: w, y2: 0, class: "l-2" });
  for (let i = 0; i <= ticks; i++) {
    const tx = (i / ticks) * w;
    const v = from + ((to - from) * i) / ticks;
    g.line("tk" + i, { x1: tx, y1: 0, x2: tx, y2: 4, class: "l-2" });
    g.text("tl" + i, { x: tx, y: 15, class: "t-mono t-xs t-mid t-dim" }, fmt(v));
  }
  if (label) g.text("label", { x: w, y: -6, class: "t-label t-end" }, label);
  return g;
}

/** stacked lanes of spans on a shared time axis: a profiler track */
export function lanes(r, key, o) {
  const { x = 0, y = 0, w, laneH = 22, gap = 6, labelW = 90, t0 = 0, t1 = 10, lanes: ls } = o;
  const g = r.g(key, x, y);
  const sx = (v) => labelW + ((v - t0) / (t1 - t0)) * (w - labelW);
  ls.forEach((lane, li) => {
    const ly = li * (laneH + gap);
    g.text("ll" + lane.id, { x: 0, y: ly + laneH / 2 + 4, class: lane.lc || "t-label" }, lane.label);
    g.line("lb" + lane.id, { x1: labelW, y1: ly + laneH, x2: w, y2: ly + laneH, class: "l-rule" });
    for (const s of lane.spans) {
      const x1 = sx(s.t0);
      const x2 = sx(s.t1);
      const sg = g.g(lane.id + ":" + s.id, x1, ly);
      sg.rect("r", { width: Math.max(1.5, x2 - x1 - 1), height: laneH, rx: 2, class: s.c || "s-ink-o" });
      if (s.t && x2 - x1 > 22) sg.text("t", { x: (x2 - x1) / 2, y: laneH / 2 + 3.6, class: s.tc || "t-mono t-xs t-mid" }, s.t);
    }
  });
  return { height: ls.length * (laneH + gap) - gap, sx, g };
}

/** small legend: [{c, t}] laid out in a row */
export function legend(r, key, o) {
  const { x = 0, y = 0, items, sw = 12, gap = 16 } = o;
  const g = r.g(key, x, y);
  let cx = 0;
  items.forEach((it, i) => {
    g.rect("s" + i, { x: cx, y: -sw + 2, width: sw, height: sw, rx: 2, class: it.c });
    const label = String(it.t);
    g.text("t" + i, { x: cx + sw + 5, y: 0, class: "t-xs t-2" }, label);
    cx += sw + 5 + label.length * 5.6 + gap;
  });
  return g;
}

/** helper: request colour class by index (r1..r5) */
export const req = (i, solid = false) => `s-r${((i - 1) % 5) + 1}${solid ? "-solid" : ""}`;
