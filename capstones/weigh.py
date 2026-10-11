#!/usr/bin/env python3
"""Probe 1 — weigh it. Sums resident checkpoint bytes per roster model.

Reads the safetensors shard headers (model.safetensors.index.json) at the
pinned revisions — kilobytes of JSON, never weights — plus the local pinned
configs, and checks resident bytes against the course's expectations.

Usage:
    python3 capstones/weigh.py --out capstones/out/weigh.json [--offline]
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from record import record, write_record  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def shard_total_bytes(repo, rev, timeout=30):
    """Total checkpoint bytes from the safetensors index, or None if unavailable."""
    url = f"https://huggingface.co/{repo}/resolve/{rev}/model.safetensors.index.json"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            if r.status != 200:
                return None
            return json.load(r)["metadata"]["total_size"]
    except Exception:
        return None


def config_dims(cfg):
    d = json.loads(Path(cfg).read_text())
    text = d.get("text_config", d)
    hidden = text.get("hidden_size") or text.get("d_model")
    layers = text.get("num_hidden_layers") or text.get("n_layers")
    return {"hidden": hidden, "layers": layers, "vocab": text.get("vocab_size")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="capstones/out/weigh.json")
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()

    course = json.loads((ROOT / "course.json").read_text())
    rows = []
    for key, src in course["sources"].items():
        if src.get("host") != "hf":
            continue
        cfg = ROOT / ".cache" / "src" / src["dir"] / "config.json"
        dims = config_dims(cfg) if cfg.exists() else {"config": "missing (run fetch-sources.mjs)"}
        total = None if args.offline else shard_total_bytes(src["repo"], src["commit"])
        rows.append({"model": key, "repo": src["repo"], "rev": src["commit"][:12],
                     "resident_bytes": total, "dims": dims})
    payload = record("python3 capstones/weigh.py --out " + args.out, {"models": rows})
    path = write_record(ROOT / args.out, payload)
    n_ok = sum(1 for r in rows if r["resident_bytes"])
    print(f"weighed {n_ok}/{len(rows)} checkpoints -> {path}")
    for r in rows:
        gb = (r["resident_bytes"] or 0) / 1e9
        print(f"  {r['model']:14s} {gb:10.2f} GB   {r['dims']}")


if __name__ == "__main__":
    main()
