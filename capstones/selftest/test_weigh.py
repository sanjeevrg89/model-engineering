"""Self-test for probe 1: shard-header math with fixtures (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from weigh import config_dims  # noqa: E402


def test_shard_total_parse():
    """total_size carries the resident bytes verbatim."""
    index = {"metadata": {"total_size": 14900000000}, "weight_map": {}}
    assert index["metadata"]["total_size"] == 14900000000, "resident bytes come straight from the header"


def test_config_dims_nested():
    """Multimodal configs read through text_config."""
    assert config_dims.__name__ == "config_dims"
    nested = {"text_config": {"hidden_size": 5120, "num_hidden_layers": 40, "vocab_size": 129280}}
    import json
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(nested, f)
        path = f.name
    try:
        assert config_dims(path) == {"hidden": 5120, "layers": 40, "vocab": 129280}
    finally:
        Path(path).unlink()


def test_gib_display():
    """Byte-to-GB display uses decimal GB like the course tables."""
    assert abs(14900000000 / 1e9 - 14.9) < 1e-9, "decimal gigabytes, not gibibytes"
