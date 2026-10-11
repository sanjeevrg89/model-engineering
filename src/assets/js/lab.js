// In-browser labs. Each lab is a small Python file the reader completes; the
// tests run in Pyodide inside a Web Worker, so a runaway loop can be stopped
// without freezing the page. The same files run locally with pytest.

const PYODIDE = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";
const CM = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/";
const TIMEOUT_MS = 25000;

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* drafts are a convenience; ignore storage failures */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("could not load " + src));
    document.head.append(s);
  });
}

let cmReady = null;
function loadCodeMirror() {
  if (!cmReady) {
    cmReady = loadScript(CM + "codemirror.min.js")
      .then(() => loadScript(CM + "mode/python/python.min.js"))
      .catch(() => null);
  }
  return cmReady;
}

/* ---- the Python side ---------------------------------------------------------- */
const RUNNER = String.raw`
import sys, json, time, traceback, importlib, io, contextlib
if "/lab" not in sys.path:
    sys.path.insert(0, "/lab")
for _name in list(sys.modules):
    _f = getattr(sys.modules[_name], "__file__", "") or ""
    if _f.startswith("/lab/"):
        del sys.modules[_name]
importlib.invalidate_caches()

def _short_tb(exc):
    tb = traceback.extract_tb(exc.__traceback__)
    frames = [f for f in tb if f.filename.startswith("/lab/")]
    lines = [f"  {f.filename[5:]}:{f.lineno} in {f.name}: {f.line}" for f in frames[-3:]]
    return "\n".join(lines)

_results = []
_buf = io.StringIO()
with contextlib.redirect_stdout(_buf):
    try:
        _tm = importlib.import_module(__TEST_MODULE__)
    except Exception as e:
        _results.append({"name": "import", "ok": False,
                         "msg": f"{type(e).__name__}: {e}", "tb": _short_tb(e)})
        _tm = None
    if _tm is not None:
        _tests = [(n, f) for n, f in vars(_tm).items() if n.startswith("test_") and callable(f)]
        _tests.sort(key=lambda kv: kv[1].__code__.co_firstlineno)
        for _n, _f in _tests:
            _t0 = time.perf_counter()
            _doc = (_f.__doc__ or "").strip().splitlines()[0] if _f.__doc__ else ""
            try:
                _f()
                _results.append({"name": _n, "ok": True, "doc": _doc,
                                 "ms": round((time.perf_counter() - _t0) * 1000)})
            except AssertionError as e:
                _results.append({"name": _n, "ok": False, "doc": _doc,
                                 "msg": str(e) or "assertion failed", "tb": _short_tb(e)})
            except Exception as e:
                _results.append({"name": _n, "ok": False, "doc": _doc,
                                 "msg": f"{type(e).__name__}: {e}", "tb": _short_tb(e)})
json.dumps({"results": _results, "stdout": _buf.getvalue()[-6000:]})
`;

// Pyodide 314 ships as an ES module, so the worker is a module worker that
// imports it statically; a failed import surfaces as the worker's onerror.
const WORKER_SRC = `
import { loadPyodide } from "${PYODIDE}pyodide.mjs";
let py = null;
self.onmessage = async (e) => {
  const { files, testModule, runner, indexURL } = e.data;
  try {
    if (!py) {
      py = await loadPyodide({ indexURL });
      self.postMessage({ kind: "ready" });
    }
    const FS = py.FS;
    const mk = (p) => { try { FS.mkdirTree(p); } catch (err) {} };
    mk("/lab");
    for (const [path, text] of Object.entries(files)) {
      const parts = ("/lab/" + path).split("/");
      parts.pop();
      mk(parts.join("/"));
      FS.writeFile("/lab/" + path, text);
    }
    const out = await py.runPythonAsync(runner.replace("__TEST_MODULE__", JSON.stringify(testModule)));
    self.postMessage({ kind: "done", out });
  } catch (err) {
    self.postMessage({ kind: "error", error: String((err && err.message) || err) });
  }
};`;

let worker = null;
let workerUrl = null;
function getWorker() {
  if (!worker) {
    workerUrl = workerUrl || URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    worker = new Worker(workerUrl, { type: "module" });
  }
  return worker;
}

function runInWorker(payload, onReady) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const timer = setTimeout(() => {
      w.terminate();
      worker = null;
      reject(new Error(`Stopped after ${TIMEOUT_MS / 1000} s. Look for a loop that never ends.`));
    }, TIMEOUT_MS);
    w.onmessage = (e) => {
      const m = e.data;
      if (m.kind === "ready") {
        onReady && onReady();
        return;
      }
      clearTimeout(timer);
      if (m.kind === "done") resolve(JSON.parse(m.out));
      else reject(new Error(m.error));
    };
    w.onerror = (e) => {
      clearTimeout(timer);
      w.terminate();
      worker = null;
      reject(new Error(e.message || "The Python worker could not start here."));
    };
    w.postMessage({ ...payload, runner: RUNNER, indexURL: PYODIDE });
  });
}

/* ---- the lab UI ------------------------------------------------------------------- */

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

async function initLab(section) {
  const manifestUrl = section.dataset.lab;
  const base = manifestUrl.replace(/[^/]*$/, "");
  let m;
  try {
    m = JSON.parse(await fetchText(manifestUrl));
  } catch (err) {
    section.append(el("div", "lab__local", `This lab could not load (${esc(err.message)}). Run it locally instead.`));
    return;
  }
  const draftKey = `te-lab-${m.id}`;
  const brief = section.querySelector(".lab__brief");

  const head = el("div", "lab__head");
  const title = el("div", "lab__title");
  title.append(el("span", "label", `Lab · ${esc(m.kicker || "Build it")}`), el("h4", "", esc(m.title)));
  const actions = el("div", "lab__actions");
  const bRun = el("button", "btn btn--primary", "Run tests");
  const bHint = el("button", "btn btn--quiet", "Hint");
  const bReset = el("button", "btn btn--quiet", "Reset");
  const bSol = el("button", "btn btn--quiet", "Show solution");
  // buttons stay disabled until the starter file is loaded and handlers are attached
  for (const b of [bRun, bHint, bReset, bSol]) {
    b.type = "button";
    b.disabled = true;
  }
  actions.append(bRun, bHint, bReset, bSol);
  head.append(title, actions);
  section.prepend(head);
  if (brief) head.after(brief);

  const body = el("div", "lab__body");
  const edWrap = el("div", "lab__editor");
  const ta = document.createElement("textarea");
  ta.id = `lab-editor-${m.id}`;
  ta.spellcheck = false;
  ta.setAttribute("aria-label", `Editor for ${m.file}`);
  edWrap.append(ta);
  const out = el("div", "lab__out");
  const status = el("div", "lab__status", `<span class="dot"></span><span class="msg">Edit <code>${esc(m.file)}</code>, then run the tests.</span>`);
  const log = el("pre", "lab__log");
  log.textContent = m.testsNote || "Run tests from the button above, or press Shift+Enter in the editor.";
  out.append(status, log);
  body.append(edWrap, out);
  (brief || head).after(body);

  const hintBox = el("div", "lab__hint");
  hintBox.hidden = true;
  const confirmBox = el("div", "lab__confirm");
  confirmBox.hidden = true;
  const local = el(
    "div",
    "lab__local",
    `Prefer your own editor? <code>${esc(m.local || "uv run pytest labs/" + m.dir)}</code> from the course repository runs the same tests.`,
  );
  body.after(hintBox, confirmBox, local);

  const skeleton = await fetchText(base + m.file).catch(() => "# could not load the starter file\n");
  ta.value = store.get(draftKey) ?? skeleton;

  let cm = null;
  const getCode = () => (cm ? cm.getValue() : ta.value);
  const setCode = (s) => (cm ? cm.setValue(s) : (ta.value = s));
  const saveDraft = () => store.set(draftKey, getCode());
  ta.addEventListener("input", saveDraft);

  loadCodeMirror().then(() => {
    if (!window.CodeMirror) return;
    cm = window.CodeMirror.fromTextArea(ta, {
      mode: "python",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      viewportMargin: Infinity,
      extraKeys: {
        Tab: (c) => c.replaceSelection("    "),
        "Shift-Enter": () => run(),
        "Cmd-Enter": () => run(),
        "Ctrl-Enter": () => run(),
      },
    });
    cm.on("change", saveDraft);
  });

  let hintIdx = 0;
  bHint.addEventListener("click", () => {
    const hints = m.hints || [];
    if (!hints.length) return;
    hintBox.hidden = false;
    hintBox.innerHTML = hints
      .slice(0, hintIdx + 1)
      .map((hh, i) => `<p><b>Hint ${i + 1}.</b> ${hh}</p>`)
      .join("");
    hintIdx = Math.min(hintIdx + 1, hints.length - 1);
    if (hintIdx === hints.length - 1) bHint.textContent = "All hints shown";
  });

  function ask(text, yes, onYes) {
    confirmBox.hidden = false;
    confirmBox.innerHTML = "";
    const go = el("button", "btn btn--primary", yes);
    const no = el("button", "btn btn--quiet", "Cancel");
    go.type = no.type = "button";
    go.addEventListener("click", () => {
      confirmBox.hidden = true;
      onYes();
    });
    no.addEventListener("click", () => (confirmBox.hidden = true));
    confirmBox.append(el("span", "", text), go, no);
    go.focus();
  }

  bReset.addEventListener("click", () =>
    ask("Discard your edits and restore the starter file?", "Discard edits", () => {
      setCode(skeleton);
      store.del(draftKey);
    }),
  );

  bSol.addEventListener("click", () =>
    ask("Replace your code with the reference solution? Your draft is kept until you edit again.", "Show solution", async () => {
      try {
        const sol = await fetchText(base + m.solution);
        store.set(draftKey + "-backup", getCode());
        setCode(sol);
      } catch (err) {
        setStatus("fail", "Could not load the solution: " + esc(err.message));
      }
    }),
  );

  function setStatus(state, html) {
    status.dataset.state = state;
    status.querySelector(".msg").innerHTML = html;
  }

  let support = null;
  async function run() {
    bRun.disabled = true;
    setStatus("running", worker ? "Running tests…" : "Loading Python in your browser (first run downloads about 10 MB)…");
    log.textContent = "";
    try {
      if (!support) {
        // support modules are named relative to the labs root (e.g. toyserve/model.py);
        // the test file sits next to the reader's file inside this lab's folder
        const labsRoot = base + "../";
        support = {};
        await Promise.all([
          ...(m.support || []).map(async (p) => {
            support[p] = await fetchText(labsRoot + p);
          }),
          (async () => {
            support[m.test] = await fetchText(base + m.test);
          })(),
        ]);
      }
      const files = { ...support, [m.file]: getCode() };
      const res = await runInWorker({ files, testModule: m.test.replace(/\.py$/, "").replace(/\//g, ".") }, () =>
        setStatus("running", "Python is ready. Running tests…"),
      );
      const passed = res.results.filter((x) => x.ok).length;
      const total = res.results.length;
      const allOk = passed === total && total > 0;
      setStatus(allOk ? "pass" : "fail", allOk ? `All ${total} tests pass.` : `${passed} of ${total} tests pass.`);
      const lines = res.results.map((x) => {
        const mark = x.ok ? `<span class="ok">✓</span>` : `<span class="no">✗</span>`;
        let s = `${mark} <b>${esc(x.name)}</b>${x.doc ? "  " + esc(x.doc) : ""}`;
        if (!x.ok) s += `\n    ${esc(x.msg)}${x.tb ? "\n" + esc(x.tb) : ""}`;
        return s;
      });
      if (res.stdout) lines.push(`\n<b>stdout</b>\n${esc(res.stdout)}`);
      log.innerHTML = lines.join("\n");
      if (allOk) section.dispatchEvent(new CustomEvent("lab:pass", { bubbles: true }));
    } catch (err) {
      setStatus("fail", "Tests did not run.");
      log.innerHTML = `${esc(err.message)}\n\nIf Python cannot load on this page, run the lab locally:\n  ${esc(
        m.local || "uv run pytest labs/" + m.dir,
      )}`;
    } finally {
      bRun.disabled = false;
    }
  }
  bRun.addEventListener("click", run);
  for (const b of [bRun, bHint, bReset, bSol]) b.disabled = false;
  section.dataset.ready = "true";
}

const labs = document.querySelectorAll(".lab[data-lab]");
if (labs.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          io.unobserve(e.target);
          initLab(e.target);
        }
      }
    },
    { rootMargin: "600px 0px" },
  );
  labs.forEach((l) => io.observe(l));
}
