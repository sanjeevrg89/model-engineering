"""Arithmetic bench: recompute the course's config tables from pinned sources.

No GPU, no weights, no engine code — pure integer arithmetic over
.cache/src/models/*/config.json, checked against research/models.json.

Usage:
    uv run --project bench python -m bench.calc --roster
    uv run --project bench python -m bench.calc --check
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "capstones"))
from record import record  # noqa: E402


def load_configs():
    course = json.loads((ROOT / "course.json").read_text())
    out = {}
    for key, src in course["sources"].items():
        if src.get("host") != "hf":
            continue
        cfg = ROOT / ".cache" / "src" / src["dir"] / "config.json"
        d = json.loads(cfg.read_text())
        out[key] = (src, d.get("text_config", d))
    return out


def head_dim(t):
    if t.get("head_dim"):
        return t["head_dim"]
    if t.get("hidden_size") and t.get("num_attention_heads"):
        return t["hidden_size"] // t["num_attention_heads"]
    return None


def is_standard_attention(t):
    """The plain KV formula only prices standard attention. MLA configs cache
    a latent, hybrids cache only on some layers, diffusion caches nothing,
    and compressed stacks (V4.1-Flash) read source layers."""
    if t.get("kv_lora_rank") is not None:
        return False
    if t.get("attn_type_list") is not None:
        return False
    if t.get("compress_ratios") is not None:
        return False
    if t.get("model_type") in ("llada",):
        return False
    return True


def mla_layers(t, layers):
    """Layers that keep a latent cache: all of them, except hybrids where
    only the full-attention layers do."""
    lin = t.get("linear_attn_config") or {}
    if isinstance(lin.get("full_attn_layers"), list):
        return len(lin["full_attn_layers"])
    return layers


def kv_bytes(t, layers, b=2):
    if not is_standard_attention(t):
        return None
    kv, hd = t.get("num_key_value_heads") or t.get("n_kv_heads"), head_dim(t)
    if not (layers and kv and hd):
        return None
    return 2 * layers * kv * hd * b


def latent_bytes(t, layers, b=2):
    if "kv_lora_rank" not in t:
        return None
    return mla_layers(t, layers) * (t["kv_lora_rank"] + t.get("qk_rope_head_dim", 0)) * b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roster", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    cfgs = load_configs()
    rows = {}
    for key, (src, t) in cfgs.items():
        layers = t.get("num_hidden_layers") or t.get("n_layers")
        rows[key] = {
            "rev": src["commit"][:12],
            "layers": layers,
            "kv_bytes_per_token_bf16": kv_bytes(t, layers),
            "mla_latent_bytes_per_token_bf16": latent_bytes(t, layers),
        }
    if args.roster or not args.check:
        for k, r in rows.items():
            print(f"{k:14s} kv={str(r['kv_bytes_per_token_bf16']):>8s} latent={str(r['mla_latent_bytes_per_token_bf16']):>7s}")
    if args.check or args.out:
        key = json.loads((ROOT / "research" / "models.json").read_text())
        mism = []
        for k, r in rows.items():
            m = key.get(k, {})
            for f in ("kv_bytes_per_token_bf16", "mla_latent_bytes_per_token_bf16"):
                if m.get(f) != r[f]:
                    mism.append((k, f, m.get(f), r[f]))
        if mism:
            for m in mism:
                print("MISMATCH", m)
            sys.exit(1)
        print(f"roster matches research/models.json ({len(rows)} models)")
    if args.out:
        payload = record("uv run --project bench python -m bench.calc --roster",
                         {"models": rows, "method": "integer arithmetic over .cache configs; null where the formula does not apply (MLA/hybrid/diffusion)"})
        p = ROOT / args.out
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(payload, indent=2) + "\n")
        print("wrote", p)


if __name__ == "__main__":
    main()
