"""A tiny decoder-only transformer in pure Python.

The weights are random but fixed (seeded), and the model is small enough to
run in a browser. It exists so the labs can check the one property every
serving-engine optimization must keep: the tokens that come out are exactly
the tokens a plain, uncached forward pass would produce.

Shape (deliberately like a real GQA model, just tiny):
    vocab 64 · d_model 16 · 2 layers · 4 query heads · 2 KV heads · head_dim 4
    learned absolute positions · RMSNorm · SwiGLU MLP · tied embeddings
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol

from .vocab import EOS, VOCAB


@dataclass(frozen=True)
class ToyConfig:
    vocab_size: int = len(VOCAB)
    d_model: int = 16
    n_layers: int = 2
    n_heads: int = 4
    n_kv_heads: int = 2
    head_dim: int = 4
    d_ff: int = 32
    max_pos: int = 512
    seed: int = 46

    @property
    def kv_dim(self) -> int:
        return self.n_kv_heads * self.head_dim


class KVStore(Protocol):
    """What the model needs from a KV cache, for one sequence.

    `append` stores the key and value vectors of the token being processed at
    `layer`; `keys`/`values` return every stored vector for that layer in
    position order, including the one just appended.
    """

    def append(self, layer: int, k: list[float], v: list[float]) -> None: ...

    def keys(self, layer: int) -> list[list[float]]: ...

    def values(self, layer: int) -> list[list[float]]: ...


class _Rng:
    """xorshift32: tiny, fast, identical in CPython and Pyodide."""

    def __init__(self, seed: int):
        self.s = (seed * 2654435761) & 0xFFFFFFFF or 1

    def uniform(self) -> float:
        s = self.s
        s ^= (s << 13) & 0xFFFFFFFF
        s ^= s >> 17
        s ^= (s << 5) & 0xFFFFFFFF
        self.s = s
        return s / 0xFFFFFFFF

    def normal(self, std: float) -> float:
        # Irwin-Hall approximation keeps it dependency-free and deterministic
        return (sum(self.uniform() for _ in range(6)) - 3.0) * std * 1.41421356


def _matrix(rng: _Rng, rows: int, cols: int, std: float) -> list[list[float]]:
    return [[rng.normal(std) for _ in range(cols)] for _ in range(rows)]


def _matvec(m: list[list[float]], x: list[float]) -> list[float]:
    return [sum(w * xi for w, xi in zip(row, x)) for row in m]


def _rmsnorm(x: list[float], g: list[float]) -> list[float]:
    inv = 1.0 / math.sqrt(sum(v * v for v in x) / len(x) + 1e-6)
    return [v * inv * gi for v, gi in zip(x, g)]


def _softmax(xs: list[float]) -> list[float]:
    m = max(xs)
    es = [math.exp(x - m) for x in xs]
    s = sum(es)
    return [e / s for e in es]


class ContiguousKV:
    """The simplest KV store: one growing list per layer. Used as the reference."""

    def __init__(self, n_layers: int):
        self._k = [[] for _ in range(n_layers)]
        self._v = [[] for _ in range(n_layers)]

    def append(self, layer, k, v):
        self._k[layer].append(k)
        self._v[layer].append(v)

    def keys(self, layer):
        return self._k[layer]

    def values(self, layer):
        return self._v[layer]

    def __len__(self):
        return len(self._k[0])


class ToyModel:
    def __init__(self, cfg: ToyConfig | None = None):
        self.cfg = cfg = cfg or ToyConfig()
        rng = _Rng(cfg.seed)
        d, hd = cfg.d_model, cfg.head_dim
        self.emb = _matrix(rng, cfg.vocab_size, d, 0.9)
        self.pos = _matrix(rng, cfg.max_pos, d, 0.35)
        self.layers = []
        for _ in range(cfg.n_layers):
            self.layers.append(
                {
                    "g1": [1.0 + rng.normal(0.05) for _ in range(d)],
                    "wq": _matrix(rng, cfg.n_heads * hd, d, 0.45),
                    "wk": _matrix(rng, cfg.kv_dim, d, 0.45),
                    "wv": _matrix(rng, cfg.kv_dim, d, 0.45),
                    "wo": _matrix(rng, d, cfg.n_heads * hd, 0.35),
                    "g2": [1.0 + rng.normal(0.05) for _ in range(d)],
                    "w1": _matrix(rng, cfg.d_ff, d, 0.4),
                    "w3": _matrix(rng, cfg.d_ff, d, 0.4),
                    "w2": _matrix(rng, d, cfg.d_ff, 0.3),
                }
            )
        self.gf = [1.0 for _ in range(d)]
        self.scale = 1.0 / math.sqrt(hd)
        self.forward_calls = 0  # tokens pushed through the model, for cost accounting

    # -- the one primitive every lab builds on ---------------------------------
    def forward_token(self, token: int, pos: int, kv: KVStore) -> list[float]:
        """Run one token at position `pos`, reading and extending `kv`.

        Returns the logits for the *next* token. `kv` must already hold the
        keys and values of positions 0..pos-1 for this sequence.
        """
        cfg = self.cfg
        if not 0 <= token < cfg.vocab_size:
            raise ValueError(f"token id {token} out of range")
        if not 0 <= pos < cfg.max_pos:
            raise ValueError(f"position {pos} out of range")
        self.forward_calls += 1
        hd, group = cfg.head_dim, cfg.n_heads // cfg.n_kv_heads
        x = [a + b for a, b in zip(self.emb[token], self.pos[pos])]
        for li, L in enumerate(self.layers):
            h = _rmsnorm(x, L["g1"])
            q = _matvec(L["wq"], h)
            kv.append(li, _matvec(L["wk"], h), _matvec(L["wv"], h))
            keys, values = kv.keys(li), kv.values(li)
            if len(keys) != pos + 1:
                raise ValueError(
                    f"layer {li}: KV store holds {len(keys)} positions, expected {pos + 1}"
                )
            out: list[float] = []
            for head in range(cfg.n_heads):
                kvh = head // group
                qh = q[head * hd : (head + 1) * hd]
                lo, hi = kvh * hd, (kvh + 1) * hd
                scores = [sum(a * b for a, b in zip(qh, kt[lo:hi])) * self.scale for kt in keys]
                w = _softmax(scores)
                out.extend(sum(wt * vt[lo + d] for wt, vt in zip(w, values)) for d in range(hd))
            x = [a + b for a, b in zip(x, _matvec(L["wo"], out))]
            h2 = _rmsnorm(x, L["g2"])
            gate = _matvec(L["w1"], h2)
            up = _matvec(L["w3"], h2)
            act = [g / (1.0 + math.exp(-g)) * u for g, u in zip(gate, up)]
            x = [a + b for a, b in zip(x, _matvec(L["w2"], act))]
        xf = _rmsnorm(x, self.gf)
        return [sum(a * b for a, b in zip(row, xf)) for row in self.emb]

    # -- conveniences used by tests and reference solutions --------------------
    def new_kv(self) -> ContiguousKV:
        return ContiguousKV(self.cfg.n_layers)

    def logits(self, tokens: list[int]) -> list[float]:
        """Next-token logits for `tokens`, recomputed from scratch (no reuse)."""
        kv = self.new_kv()
        out: list[float] = []
        for p, t in enumerate(tokens):
            out = self.forward_token(t, p, kv)
        return out


def argmax(xs: list[float]) -> int:
    """Greedy pick; ties go to the lowest token id, like torch.argmax."""
    best, best_i = xs[0], 0
    for i, v in enumerate(xs):
        if v > best:
            best, best_i = v, i
    return best_i


def reference_generate(model: ToyModel, prompt: list[int], max_new_tokens: int, eos: int = EOS) -> list[int]:
    """Greedy generation with a plain contiguous cache: the ground truth."""
    kv = model.new_kv()
    logits: list[float] = []
    for p, t in enumerate(prompt):
        logits = model.forward_token(t, p, kv)
    out: list[int] = []
    pos = len(prompt)
    while len(out) < max_new_tokens:
        nxt = argmax(logits)
        out.append(nxt)
        if nxt == eos:
            break
        logits = model.forward_token(nxt, pos, kv)
        pos += 1
    return out
