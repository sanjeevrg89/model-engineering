"""pytest setup for the labs.

Puts labs/ on sys.path so `import toyarch` works from any lab folder.
Set LAB_SOLUTION=1 to run every lab's tests against its reference solution
instead of your own file (that is how CI checks the solutions).

Each lab's file has a unique module name (generate.py, kv_cache.py, ...),
so running every lab in one pytest session never mixes them up.
"""

import importlib.util
import os
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))


def pytest_collect_file(parent, file_path):
    if not os.environ.get("LAB_SOLUTION"):
        return None
    if not (file_path.name.startswith("test_") and file_path.suffix == ".py"):
        return None
    sol = file_path.parent / "solution"
    if sol.is_dir():
        for f in sorted(sol.glob("*.py")):
            spec = importlib.util.spec_from_file_location(f.stem, f)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[f.stem] = mod
            spec.loader.exec_module(mod)
    return None
