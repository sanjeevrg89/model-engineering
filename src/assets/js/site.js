// Site chrome: theme, course rail, reading progress, copy buttons.
// Progress lives in this browser only (localStorage) and the page works
// without it.

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage unavailable: progress simply isn't remembered */
    }
  },
};

/* --- theme ------------------------------------------------------------------ */
const root = document.documentElement;
function effectiveTheme() {
  const set = root.getAttribute("data-theme");
  if (set) return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
  const sync = () => {
    const dark = effectiveTheme() === "dark";
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    btn.title = btn.getAttribute("aria-label");
    btn.dataset.mode = dark ? "dark" : "light";
  };
  sync();
  btn.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store.set("te-theme", next);
    sync();
  });
}

/* --- rail drawer (narrow screens) ---------------------------------------------- */
const menuBtn = document.querySelector("[data-menu]");
const scrim = document.querySelector(".scrim");
function setRail(open) {
  document.body.classList.toggle("rail-open", open);
  if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
}
menuBtn?.addEventListener("click", () => setRail(!document.body.classList.contains("rail-open")));
scrim?.addEventListener("click", () => setRail(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setRail(false);
});

// keep the current chapter visible in the rail
const current = document.querySelector('.rail a[aria-current="page"]');
if (current) {
  const rail = current.closest(".rail");
  const top = current.offsetTop - rail.clientHeight / 3;
  if (top > 0) rail.scrollTop = top;
}

/* --- progress ------------------------------------------------------------------- */
const slug = document.body.dataset.chapter;
const progress = store.get("te-progress", {});
if (slug) {
  progress[slug] = { ...(progress[slug] || {}), seen: Date.now() };
  store.set("te-progress", progress);
  store.set("te-last", slug);
  const end = document.querySelector(".nextq, .pager");
  if (end && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        const p = store.get("te-progress", {});
        p[slug] = { ...(p[slug] || {}), done: Date.now() };
        store.set("te-progress", p);
        markRail(p);
        io.disconnect();
      }
    });
    io.observe(end);
  }
}

function markRail(p) {
  for (const a of document.querySelectorAll(".rail a[data-slug]")) {
    a.classList.toggle("is-done", !!(p[a.dataset.slug] && p[a.dataset.slug].done));
  }
  for (const card of document.querySelectorAll("[data-card-slug]")) {
    card.classList.toggle("is-done", !!(p[card.dataset.cardSlug] && p[card.dataset.cardSlug].done));
  }
}
markRail(progress);

// landing page: offer to resume
const resume = document.querySelector("[data-resume]");
if (resume) {
  const last = store.get("te-last", null);
  const link = last && document.querySelector(`.rail a[data-slug="${last}"], [data-card-slug="${last}"] a`);
  if (link) {
    resume.hidden = false;
    const a = resume.querySelector("a");
    a.href = link.getAttribute("href");
    const title = link.querySelector(".t, .title")?.textContent || link.textContent;
    resume.querySelector("[data-resume-title]").textContent = title.trim();
  }
}

/* --- copy buttons on code excerpts ---------------------------------------------- */
for (const fig of document.querySelectorAll(".code")) {
  const head = fig.querySelector(".code__head");
  const code = fig.querySelector("pre code");
  if (!head || !code) continue;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "copy";
  b.textContent = "Copy";
  b.setAttribute("aria-label", "Copy code");
  b.addEventListener("click", async () => {
    const text = [...code.querySelectorAll(".line")].map((l) => l.textContent).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = "Copied";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      b.textContent = "Selected";
    }
    setTimeout(() => (b.textContent = "Copy"), 1600);
  });
  head.append(b);
}

/* --- section index highlight (chapter map in header) ---------------------------- */
const mapLinks = [...document.querySelectorAll(".ch-map a[href^='#'], .rail__sections a[href^='#']")];
// a tapped section closes the rail drawer on phones
for (const a of document.querySelectorAll(".rail__sections a")) a.addEventListener("click", () => setRail(false));
if (mapLinks.length) {
  const targets = [...new Set(mapLinks.map((a) => a.getAttribute("href")))].map((h) => document.querySelector(h)).filter(Boolean);
  let shown = null;
  // the section being read is the last heading above 30% of the viewport; recomputed on
  // scroll, so a jump to an anchor highlights the right entry too
  const update = () => {
    const line = window.innerHeight * 0.3;
    let cur = null;
    for (const t of targets) {
      if (t.getBoundingClientRect().top <= line) cur = t;
      else break;
    }
    if (cur === shown) return;
    shown = cur;
    const id = cur ? "#" + cur.id : null;
    for (const a of mapLinks) {
      const here = a.getAttribute("href") === id;
      a.classList.toggle("is-here", here);
      if (!a.closest(".rail")) continue;
      if (here) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
      // keep the section being read in view inside the rail
      if (here) {
        const rail = a.closest(".rail");
        const r = a.getBoundingClientRect();
        const box = rail.getBoundingClientRect();
        if (box.height && (r.top < box.top + 40 || r.bottom > box.bottom - 40)) rail.scrollTop += r.top - box.top - box.height / 3;
      }
    }
  };
  let queued = false;
  addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
      });
    },
    { passive: true },
  );
  addEventListener("resize", update);
  update();
}

/* --- search: "/" or Cmd/Ctrl+K ---------------------------------------------------- */
const searchBtn = document.querySelector("[data-search]");
if (searchBtn) {
  const rootRel = searchBtn.dataset.root || "";
  let index = null;
  const dlg = document.createElement("dialog");
  dlg.className = "search";
  dlg.setAttribute("aria-label", "Search the course");
  dlg.innerHTML = `<input class="search__input" id="search-input" type="search" placeholder="Search chapters, sections and terms" autocomplete="off" aria-controls="search-list"><ul class="search__list" id="search-list" role="listbox"></ul>`;
  document.body.append(dlg);
  const input = dlg.querySelector("input");
  const list = dlg.querySelector("ul");
  let sel = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const score = (item, q) => {
    const t = item.t.toLowerCase();
    const s = (item.s || "").toLowerCase();
    if (t.startsWith(q)) return 3;
    if (t.includes(q)) return 2;
    if (s.includes(q)) return 1;
    return 0;
  };
  function render() {
    const q = input.value.trim().toLowerCase();
    let items = index || [];
    if (q) {
      items = items
        .map((it) => [score(it, q), it])
        .filter(([sc]) => sc > 0)
        .sort((a, b) => b[0] - a[0] || (a[1].n || 99) - (b[1].n || 99))
        .map(([, it]) => it);
    } else {
      items = items.filter((it) => it.k === "chapter");
    }
    items = items.slice(0, 40);
    sel = Math.min(sel, Math.max(items.length - 1, 0));
    list.innerHTML = items.length
      ? items
          .map(
            (it, i) =>
              `<li><a href="${rootRel}${it.u}" role="option" aria-selected="${i === sel}"><span class="n">${it.n ? String(it.n).padStart(2, "0") : "·"}</span><span class="t">${esc(it.t)}</span><span class="s">${esc(it.s || "")}</span></a></li>`,
          )
          .join("")
      : `<li class="search__empty">No matches. Try a term like “radix”, “CUDA graph” or “budget”.</li>`;
  }
  async function open() {
    if (!index) {
      try {
        index = await (await fetch(rootRel + "search.json")).json();
      } catch {
        index = [];
      }
    }
    sel = 0;
    render();
    dlg.showModal();
    input.select();
  }
  searchBtn.addEventListener("click", open);
  input.addEventListener("input", () => {
    sel = 0;
    render();
  });
  dlg.addEventListener("keydown", (e) => {
    const links = [...list.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % Math.max(links.length, 1);
      links.forEach((a, i) => a.setAttribute("aria-selected", String(i === sel)));
      links[sel]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && links[sel]) {
      e.preventDefault();
      location.href = links[sel].href;
      dlg.close();
    }
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest?.(".CodeMirror"));
    if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      if (!dlg.open) open();
    }
  });
}
