// The two-channel instrument.
//
// A scope runs one workload through channel A (vLLM) and channel B (SGLang)
// on a shared clock. Each step carries a narration caption, an optional
// per-channel note, and an optional "delta": the sentence that explains
// where the two engines made different decisions on this step.
//
// Drawing uses a keyed renderer: draw functions describe the whole picture
// for a step, and elements that keep their key between steps glide to their
// new position instead of being redrawn.

const SVGNS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const DUR = 380;

/* ------------------------------------------------------------------------ */
/* keyed renderer                                                            */
/* ------------------------------------------------------------------------ */

export class R {
  constructor(el, host) {
    this.el = el;
    this.host = host;
    this.kids = new Map();
    this.seen = new Set();
  }

  _begin() {
    this.seen = new Set();
  }

  _end() {
    for (const [key, n] of this.kids) {
      if (this.seen.has(key)) {
        if (n.__r) n.__r._end();
        continue;
      }
      this.kids.delete(key);
      if (this.host.animate) {
        n.classList.add("is-exit");
        n.__exitT = setTimeout(() => n.remove(), DUR);
      } else {
        n.remove();
      }
    }
  }

  _node(key, tag) {
    key = String(key);
    let n = this.kids.get(key);
    if (n && n.tagName !== tag) {
      n.remove();
      n = null;
    }
    if (!n) {
      n = document.createElementNS(SVGNS, tag);
      n.setAttribute("data-k", key);
      if (this.host.animate) {
        n.__enter = true;
        n.classList.add("is-enter");
        this.host.entering.push(n);
      }
      this.el.appendChild(n);
      this.kids.set(key, n);
    }
    this.seen.add(key);
    return n;
  }

  _attrs(n, attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) n.removeAttribute(k);
      else n.setAttribute(k, v);
    }
    // a caller-supplied class must not drop the pending fade-in
    if (n.__enter) n.classList.add("is-enter");
  }

  /** positioned group; returns a child renderer */
  g(key, x = 0, y = 0, attrs = {}) {
    const n = this._node(key, "g");
    n.style.transform = `translate(${round(x)}px, ${round(y)}px)`;
    this._attrs(n, attrs);
    if (!n.__r) n.__r = new R(n, this.host);
    n.__r._begin();
    return n.__r;
  }

  rect(key, attrs) {
    return this._set(key, "rect", attrs);
  }

  circle(key, attrs) {
    return this._set(key, "circle", attrs);
  }

  line(key, attrs) {
    return this._set(key, "line", attrs);
  }

  path(key, attrs) {
    return this._set(key, "path", attrs);
  }

  polygon(key, attrs) {
    return this._set(key, "polygon", attrs);
  }

  text(key, attrs, content) {
    const n = this._set(key, "text", attrs);
    const s = content == null ? "" : String(content);
    if (n.__text !== s) {
      n.textContent = s;
      n.__text = s;
    }
    return n;
  }

  /** multi-run text: runs = [{t, cls}] */
  rich(key, attrs, runs) {
    const n = this._set(key, "text", attrs);
    const sig = JSON.stringify(runs);
    if (n.__sig !== sig) {
      n.textContent = "";
      for (const run of runs) {
        const ts = document.createElementNS(SVGNS, "tspan");
        if (run.cls) ts.setAttribute("class", run.cls);
        if (run.dx != null) ts.setAttribute("dx", run.dx);
        ts.textContent = run.t;
        n.appendChild(ts);
      }
      n.__sig = sig;
    }
    return n;
  }

  _set(key, tag, attrs) {
    const n = this._node(key, tag);
    this._attrs(n, attrs || {});
    return n;
  }
}

function round(v) {
  return Math.round(v * 10) / 10;
}

class Host {
  constructor() {
    this.animate = false;
    this.entering = [];
  }

  flushEnter() {
    const list = this.entering;
    this.entering = [];
    if (!list.length) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const n of list) {
          n.__enter = false;
          n.classList.remove("is-enter");
        }
      }),
    );
  }
}

/* ------------------------------------------------------------------------ */
/* svg scaffolding                                                           */
/* ------------------------------------------------------------------------ */

let defsSeq = 0;

export function svgEl(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/** a fresh <svg> with the shared pattern + marker defs */
export function makeSvg(width, height, label) {
  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": label || "",
    preserveAspectRatio: "xMinYMin meet",
  });
  const id = ++defsSeq;
  const defs = svgEl("defs", {}, svg);
  const hatch = (name, color) => {
    const p = svgEl(
      "pattern",
      {
        id: `${name}-${id}`,
        width: 6,
        height: 6,
        patternUnits: "userSpaceOnUse",
        patternTransform: "rotate(45)",
      },
      defs,
    );
    svgEl("rect", { width: 6, height: 6, style: "fill: var(--panel)" }, p);
    svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 6, style: `stroke: ${color}; stroke-width: 2.2` }, p);
  };
  hatch("hatch-a", "var(--a-tint-2)");
  hatch("hatch-b", "var(--b-tint-2)");
  hatch("hatch-ink", "color-mix(in srgb, var(--ink-3) 45%, transparent)");
  const marker = (name, color) => {
    const m = svgEl(
      "marker",
      {
        id: `${name}-${id}`,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: "auto-start-reverse",
      },
      defs,
    );
    svgEl("path", { d: "M0,0 L10,5 L0,10 z", style: `fill: ${color}` }, m);
  };
  marker("arr-ink", "var(--ink)");
  marker("arr-2", "var(--ink-3)");
  marker("arr-a", "var(--a)");
  marker("arr-b", "var(--b)");
  marker("arr-good", "var(--good)");
  marker("arr-bad", "var(--bad)");
  // hatched fills point at this svg's own patterns. The rules are scoped to the
  // svg's class: a <style> inside an svg is global, and the scoped selector also
  // outranks any generic fill set on the same element.
  svg.classList.add(`sv-${id}`);
  const style = svgEl("style", {}, svg);
  style.textContent =
    `.sv-${id} .s-hatch-a{fill:url(#hatch-a-${id})}` +
    `.sv-${id} .s-hatch-b{fill:url(#hatch-b-${id})}` +
    `.sv-${id} .s-hatch{fill:url(#hatch-ink-${id})}`;
  const root = svgEl("g", { class: "root" }, svg);
  return { svg, root, id };
}

/** marker url for arrows drawn inside a given svg */
export function arrowUrl(ctx, kind = "ink") {
  return `url(#arr-${kind}-${ctx.svgId})`;
}

/* ------------------------------------------------------------------------ */
/* the scope                                                                 */
/* ------------------------------------------------------------------------ */

const ICON = {
  reset:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4"/><path d="M2.5 2.5v3h3"/></svg>',
  prev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>',
  next: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 5 5-5 5"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8v10.4L13 8z"/></svg>',
  pause:
    '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.8" width="3.2" height="10.4" rx=".6"/><rect x="9.3" y="2.8" width="3.2" height="10.4" rx=".6"/></svg>',
};

const scopes = new Set();
let activeScope = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function h(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/**
 * Mount a scope.
 * spec = {
 *   label: "Fig 7.1", title: "…",
 *   width: 760,
 *   channels: [{ key: "a", name: "vLLM", sub: "…", height: 200 }, { key: "b", … }],
 *   steps: [...] | build(params) -> steps,
 *   params: [{ id, label, type: "range"|"select", min, max, step, value, options, fmt }],
 *   draw: { a(r, state, ctx), b(r, state, ctx) },
 *   autoplay: false, loop: false, hold: 2600,
 * }
 * step = { caption, delta, same, notes: { a, b }, a: state, b: state, hold }
 */
export function mountScope(el, spec) {
  if (typeof el === "string") el = document.querySelector(el);
  if (!el) return null;
  const s = new Scope(el, spec);
  scopes.add(s);
  return s;
}

class Scope {
  constructor(el, spec) {
    this.el = el;
    this.spec = spec;
    this.i = 0;
    this.timer = null;
    this.params = {};
    for (const p of spec.params || []) this.params[p.id] = p.value;
    this.steps = this._build();
    this.host = new Host();
    this._dom();
    this.render(true);
    this._observe();
  }

  _build() {
    const sp = this.spec;
    const steps = typeof sp.build === "function" ? sp.build({ ...this.params }) : sp.steps;
    return steps && steps.length ? steps : [{ caption: "" }];
  }

  _dom() {
    const { el, spec } = this;
    el.classList.add("scope");
    if (!el.classList.contains("wide") && !el.classList.contains("full")) el.classList.add("wide");
    el.tabIndex = -1;
    el.setAttribute("role", "group");
    el.setAttribute("aria-roledescription", "step-through figure");
    el.setAttribute("aria-label", `${spec.label || "Figure"}: ${spec.title || ""}`);
    el.innerHTML = "";

    const head = h("div", "scope__head");
    head.append(
      h("div", "scope__id label", spec.label || "Figure"),
      h("div", "scope__title", spec.title || ""),
    );
    this.counter = h("div", "scope__counter");
    head.append(this.counter);
    el.append(head);

    if (spec.params && spec.params.length) {
      const row = h("div", "scope__params");
      for (const p of spec.params) row.append(this._param(p));
      el.append(row);
    }

    const body = h("div", "scope__body");
    this.ch = [];
    const chans = spec.channels || [{ key: "x", name: "Both engines" }];
    chans.forEach((c, idx) => {
      if (idx === 1 && chans.length === 2 && spec.delta !== false) {
        this.delta = h("div", "delta");
        this.deltaMark = h("div", "delta__mark");
        this.deltaText = h("div", "delta__text");
        this.delta.append(this.deltaMark, this.deltaText);
        body.append(this.delta);
      }
      const row = h("div", `ch ch--${c.key}`);
      const lab = h("div", "ch__label");
      const letter = c.letter || (c.key === "a" ? "A" : c.key === "b" ? "B" : "·");
      lab.append(
        h("span", "ch__letter", letter),
        h("span", "ch__name", c.name || ""),
        h("span", "ch__sub", c.sub || ""),
      );
      const plot = h("div", "ch__plot");
      const canvas = h("div", "ch__canvas");
      const height = c.height || spec.height || 200;
      const width = c.width || spec.width || 760;
      const { svg, root, id } = makeSvg(width, height, `${c.name || ""} channel`);
      svg.style.minWidth = (spec.minWidth || Math.round(width * 0.9)) + "px";
      canvas.append(svg);
      const note = h("div", "ch__note");
      plot.append(canvas, note);
      row.append(lab, plot);
      body.append(row);
      const r = new R(root, this.host);
      this.ch.push({ spec: c, svg, root, r, note, width, height, svgId: id });
    });
    el.append(body);

    this.caption = h("figcaption", "scope__caption");
    this.caption.setAttribute("aria-live", "polite");
    el.append(this.caption);

    const ctl = h("div", "scope__controls");
    this.bReset = this._btn("reset", "Restart", ICON.reset);
    this.bPrev = this._btn("prev", "Previous step", ICON.prev);
    this.track = h("div", "sc-track");
    this.bNext = h("button", "sc-btn sc-btn--next");
    this.bNext.type = "button";
    this.bNext.innerHTML = `<span>Next</span>${ICON.next}`;
    this.bNext.addEventListener("click", () => {
      this.stop();
      this.go(this.i + 1);
    });
    this.bPlay = this._btn("play", "Play", ICON.play);
    const keys = h("span", "sc-keys", "<kbd>←</kbd> <kbd>→</kbd>");
    ctl.append(this.bReset, this.bPrev, this.track, this.bNext, this.bPlay, keys);
    el.append(ctl);
    this._dots();

    el.addEventListener("pointerdown", () => (activeScope = this));
    el.addEventListener("focusin", () => (activeScope = this));
  }

  _param(p) {
    const lab = document.createElement("label");
    const id = `${this.el.id || "scope"}-${p.id}`;
    lab.htmlFor = id;
    lab.append(document.createTextNode(p.label));
    let input;
    const out = document.createElement("output");
    const fmt = p.fmt || ((v) => v);
    if (p.type === "select") {
      input = document.createElement("select");
      for (const o of p.options) {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label;
        if (String(o.value) === String(p.value)) opt.selected = true;
        input.append(opt);
      }
    } else {
      input = document.createElement("input");
      input.type = "range";
      input.min = p.min;
      input.max = p.max;
      input.step = p.step || 1;
      input.value = p.value;
      out.textContent = fmt(p.value);
    }
    input.id = id;
    input.addEventListener("input", () => {
      const v = p.type === "select" ? input.value : Number(input.value);
      this.params[p.id] = v;
      if (p.type !== "select") out.textContent = fmt(v);
      this.stop();
      this.steps = this._build();
      this._dots();
      this.go(Math.min(this.i, this.steps.length - 1), true);
    });
    lab.append(input);
    if (p.type !== "select") lab.append(out);
    return lab;
  }

  _btn(act, label, icon) {
    const b = h("button", "sc-btn", icon);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.addEventListener("click", () => {
      if (act === "reset") {
        this.stop();
        this.go(0);
      } else if (act === "prev") {
        this.stop();
        this.go(this.i - 1);
      } else if (act === "play") {
        this.timer ? this.stop() : this.play();
      }
    });
    return b;
  }

  _dots() {
    this.track.innerHTML = "";
    this.dots = this.steps.map((st, i) => {
      const d = h("button", "sc-dot");
      d.type = "button";
      d.setAttribute("aria-label", `Step ${i + 1}`);
      if (st.delta) d.classList.add("is-diff");
      d.addEventListener("click", () => {
        this.stop();
        this.go(i);
      });
      this.track.append(d);
      return d;
    });
  }

  go(i, force = false) {
    const n = this.steps.length;
    const j = Math.max(0, Math.min(n - 1, i));
    if (j === this.i && !force) return;
    this.i = j;
    this.render(false);
  }

  next() {
    this.go(this.i + 1);
  }

  prev() {
    this.go(this.i - 1);
  }

  play() {
    if (this.i >= this.steps.length - 1) this.go(0);
    this.bPlay.innerHTML = ICON.pause;
    this.bPlay.setAttribute("aria-label", "Pause");
    const tick = () => {
      if (this.i >= this.steps.length - 1) {
        if (this.spec.loop) {
          this.go(0);
        } else {
          this.stop();
          return;
        }
      } else {
        this.go(this.i + 1);
      }
      this.timer = setTimeout(tick, this.steps[this.i].hold || this.spec.hold || 2600);
    };
    this.timer = setTimeout(tick, this.steps[this.i].hold || this.spec.hold || 2600);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.bPlay.innerHTML = ICON.play;
    this.bPlay.setAttribute("aria-label", "Play");
  }

  render(first) {
    const st = this.steps[this.i];
    const prev = this.i > 0 ? this.steps[this.i - 1] : null;
    this.host.animate = !first && !reduced.matches;
    this.el.classList.toggle("no-anim", !this.host.animate);

    for (const c of this.ch) {
      const key = c.spec.key;
      const draw = this.spec.draw && (this.spec.draw[key] || this.spec.draw.all);
      c.r._begin();
      if (draw) {
        draw(c.r, st[key] !== undefined ? st[key] : st.state, {
          i: this.i,
          n: this.steps.length,
          step: st,
          prev: prev ? (prev[key] !== undefined ? prev[key] : prev.state) : null,
          width: c.width,
          height: c.height,
          params: this.params,
          svgId: c.svgId,
          key,
        });
      }
      c.r._end();
      const note = st.notes && st.notes[key];
      c.note.innerHTML = note || "";
    }
    this.host.flushEnter();

    if (this.delta) {
      const diff = !!st.delta;
      this.delta.classList.toggle("is-diff", diff);
      this.deltaMark.innerHTML = diff ? "<i>Δ</i> Differ" : "<i>=</i> Same";
      this.deltaText.innerHTML = diff ? st.delta : st.same || "Both engines make the same decision here.";
    }

    this.caption.innerHTML = st.caption || "";
    const n = this.steps.length;
    this.counter.innerHTML = `STEP <b>${pad2(this.i + 1)}</b>/${pad2(n)}`;
    this.dots.forEach((d, k) => {
      d.classList.toggle("is-now", k === this.i);
      d.classList.toggle("is-past", k < this.i);
      d.setAttribute("aria-current", k === this.i ? "step" : "false");
    });
    this.bPrev.disabled = this.i === 0;
    this.bNext.disabled = this.i === n - 1;
    // a single-step scope is a parameterized figure: no stepping controls
    this.el.classList.toggle("is-single", n === 1);
    if (this.i === n - 1 && this.spec.onEnd) this.spec.onEnd(this);
  }

  _observe() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) this.visible = e.intersectionRatio;
        let best = null;
        let ratio = 0.25;
        for (const s of scopes) {
          if ((s.visible || 0) > ratio) {
            ratio = s.visible;
            best = s;
          }
        }
        if (best) activeScope = best;
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(this.el);
    if (this.spec.autoplay && !reduced.matches) {
      // autoplay only while on screen; the first frame is already complete
      const auto = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !this.timer && !this.userTouched) this.play();
          if (!e.isIntersecting && this.timer) this.stop();
        }
      });
      auto.observe(this.el);
      this.el.addEventListener("pointerdown", () => (this.userTouched = true), { once: true });
    }
  }
}

function typingTarget(t) {
  if (!t) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable ||
    (t.closest && t.closest(".CodeMirror, .lab__editor"))
  );
}

document.addEventListener("keydown", (e) => {
  if (!activeScope || e.altKey || e.ctrlKey || e.metaKey) return;
  if (typingTarget(e.target)) return;
  if (e.key === "ArrowRight") {
    activeScope.stop();
    activeScope.userTouched = true;
    activeScope.next();
    e.preventDefault();
  } else if (e.key === "ArrowLeft") {
    activeScope.stop();
    activeScope.userTouched = true;
    activeScope.prev();
    e.preventDefault();
  }
});

/* ------------------------------------------------------------------------ */
/* static (or lightly interactive) svg figures                               */
/* ------------------------------------------------------------------------ */

/**
 * mountFigure(el, { width, height, label, caption, draw(r, ctx) })
 * Returns { redraw(state) } so prose controls can drive it.
 */
export function mountFigure(el, spec) {
  if (typeof el === "string") el = document.querySelector(el);
  if (!el) return null;
  el.classList.add("svgfig");
  const frame = h("div", "svgfig__frame");
  const { svg, root, id } = makeSvg(spec.width, spec.height, spec.label || "");
  svg.style.minWidth = (spec.minWidth || Math.round(spec.width * 0.9)) + "px";
  svg.style.maxWidth = Math.round(spec.width * 1.25) + "px";
  svg.style.marginInline = "auto";
  frame.append(svg);
  const cap = el.querySelector("figcaption");
  el.prepend(frame);
  if (!cap && spec.caption) el.append(h("figcaption", "", spec.caption));
  const host = new Host();
  const r = new R(root, host);
  let first = true;
  const redraw = (state) => {
    host.animate = !first && !reduced.matches;
    el.classList.toggle("no-anim", !host.animate);
    r._begin();
    spec.draw(r, { width: spec.width, height: spec.height, svgId: id, state });
    r._end();
    host.flushEnter();
    first = false;
  };
  redraw(spec.state);
  return { redraw, svg };
}
