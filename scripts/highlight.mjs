// Build-time syntax highlighting. Produces HTML whose newlines match the
// source newlines one to one, so callers can split it into numbered lines:
// every token that spans a newline is closed and reopened around it.

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const PY_KW = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(
    " ",
  ),
);
const PY_BUILTIN = new Set(
  "abs all any bool bytes callable dict dir divmod enumerate filter float frozenset getattr hasattr hash id int isinstance issubclass iter len list map max min next object print property range repr reversed round set setattr slice sorted staticmethod classmethod str sum super tuple type zip dataclass field Optional Union Any NotImplementedError ValueError RuntimeError AssertionError Exception KeyError TypeError IndexError".split(
    " ",
  ),
);

const C_KW = {
  rust: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while Option Some None Ok Err Vec String Arc",
  go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false",
  cpp: "auto bool break case char class const constexpr continue default delete do double else enum explicit extern false float for if inline int long namespace new nullptr private protected public return short signed sizeof static struct switch template this true typedef typename union unsigned using virtual void volatile while __global__ __device__ __shared__ __syncthreads",
  bash: "if then else elif fi for in do done while case esac function export local return set unset uv pip python python3 vllm sglang",
  js: "const let var function return if else for while of in new class extends import export from default true false null undefined await async",
};

function tokPython(src) {
  const rules = [
    ["c", /#[^\n]*/y],
    ["s", /(?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/y],
    ["d", /@[A-Za-z_][\w.]*/y],
    ["n", /(?:0[xXoObB][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?j?|\.\d[\d_]*)/y],
    ["id", /[A-Za-z_]\w*/y],
    ["ws", /\s+/y],
    ["o", /[^\sA-Za-z_\d#'"@]+/y],
  ];
  const out = [];
  let i = 0;
  let prevSig = "";
  while (i < src.length) {
    let matched = false;
    for (const [type, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m[0].length) {
        let ty = type;
        const text = m[0];
        if (type === "id") {
          if (PY_KW.has(text)) ty = "k";
          else if (prevSig === "def" || prevSig === "class") ty = "f";
          else if (text === "self" || text === "cls") ty = "sf";
          else if (PY_BUILTIN.has(text)) ty = "b";
          else ty = "";
        }
        if (type === "o") ty = "o";
        if (type !== "ws") prevSig = text;
        out.push([ty === "ws" ? "" : ty, text]);
        i += text.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push(["", src[i]]);
      i += 1;
    }
  }
  return out;
}

function tokCLike(src, lang) {
  const kw = new Set((C_KW[lang] || "").split(" "));
  const hashComment = lang === "bash" || lang === "yaml" || lang === "toml";
  const rules = [
    ["c", hashComment ? /#[^\n]*/y : /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
    ["s", /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`[^`]*`?/y],
    ["n", /\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?[a-zA-Z]*\b/y],
    ["id", /[A-Za-z_][\w-]*/y],
    ["ws", /\s+/y],
    ["o", /[^\sA-Za-z_\d"'`#/]+|\//y],
  ];
  const out = [];
  let i = 0;
  let prev = "";
  while (i < src.length) {
    let matched = false;
    for (const [type, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m[0].length) {
        let ty = type;
        const text = m[0];
        if (type === "id") {
          if (kw.has(text)) ty = "k";
          else if (prev === "fn" || prev === "func" || prev === "struct" || prev === "class" || prev === "function") ty = "f";
          else if (lang === "yaml" && /^\s*:/.test(src.slice(i + text.length, i + text.length + 2))) ty = "f";
          else ty = "";
        }
        if (type === "ws") ty = "";
        if (type !== "ws") prev = text;
        out.push([ty, text]);
        i += text.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push(["", src[i]]);
      i += 1;
    }
  }
  return out;
}

function render(tokens) {
  let html = "";
  for (const [ty, text] of tokens) {
    if (!ty) {
      html += esc(text);
      continue;
    }
    // split across newlines so every line stays self-contained
    html += text
      .split("\n")
      .map((part) => (part ? `<span class="tk-${ty}">${esc(part)}</span>` : ""))
      .join("\n");
  }
  return html;
}

export function langFor(p) {
  const ext = (p.split(".").pop() || "").toLowerCase();
  return (
    {
      py: "python",
      pyi: "python",
      rs: "rust",
      go: "go",
      cu: "cpp",
      cuh: "cpp",
      cc: "cpp",
      cpp: "cpp",
      h: "cpp",
      hpp: "cpp",
      sh: "bash",
      yaml: "yaml",
      yml: "yaml",
      toml: "toml",
      json: "json",
      js: "js",
      mjs: "js",
      ts: "js",
    }[ext] || "text"
  );
}

export function highlight(src, lang) {
  if (lang === "python") return render(tokPython(src));
  if (lang === "text" || !lang) return esc(src);
  if (lang === "json") return render(tokCLike(src, "js"));
  return render(tokCLike(src, lang));
}
