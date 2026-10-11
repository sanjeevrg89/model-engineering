"""Shared recorder for capstone runs.

Stamps every result with the machine, Python version, pinned revisions and
command, and scrubs local paths so runs are shareable.
"""

import json
import os
import platform
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def pinned_sources():
    course = json.loads((ROOT / "course.json").read_text())
    return {k: {"repo": v.get("repo"), "tag": v.get("tag"), "commit": v.get("commit")}
            for k, v in course["sources"].items()}


def scrub(text):
    return str(text).replace(str(ROOT), "<repo>").replace(os.path.expanduser("~"), "~")


def record(command, results):
    return {
        "machine": {"system": platform.system(), "release": platform.release(),
                    "machine": platform.machine(), "processor": platform.processor()},
        "python": platform.python_version(),
        "checked": json.loads((ROOT / "course.json").read_text())["site"]["checked"],
        "sources": pinned_sources(),
        "command": scrub(command),
        "results": results,
    }


def write_record(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return path
