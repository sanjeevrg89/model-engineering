"""Tests for chapter 1: block shapes against the pinned roster configs.

Fixture values are copied from the pinned config.json revisions:
- Qwen2.5-7B @ d149729398750b98c0af14eb82c78cfe92750796
- Mistral-7B-v0.1 @ 27d67f1b5f57dc0953326b2601d68371d40ea8da
- Mixtral-8x7B-v0.1 @ fc7ac94680e38d7348cfa806e51218e6273104b0
"""

import block_shapes as B

QWEN = {"hidden": 3584, "intermediate": 18944, "n_q": 28, "n_kv": 4,
        "head_dim": 128, "layers": 28, "vocab": 152064}
MISTRAL = {"hidden": 4096, "intermediate": 14336, "n_q": 32, "n_kv": 8,
           "head_dim": 128, "layers": 32, "vocab": 32000}
MIXTRAL = {"hidden": 4096, "intermediate": 14336, "n_q": 32, "n_kv": 8,
           "head_dim": 128, "layers": 32, "experts_per_tok": 2}


def test_kv_bytes_qwen():
    """Qwen2.5-7B caches 57,344 bytes per token in bf16."""
    got = B.kv_bytes_per_token(QWEN["layers"], QWEN["n_kv"], QWEN["head_dim"])
    assert got == 57344, f"expected 57344 B (2*28 layers*4 heads*128*2 B), got {got}"


def test_kv_bytes_mistral():
    """Mistral-7B caches 131,072 bytes per token in bf16."""
    got = B.kv_bytes_per_token(MISTRAL["layers"], MISTRAL["n_kv"], MISTRAL["head_dim"])
    assert got == 131072, f"expected 131072 B (2*32 layers*8 heads*128*2 B), got {got}"


def test_block_params_qwen():
    """One Qwen2.5-7B block holds about 233.0M weights outside the norms."""
    got = B.block_params(QWEN["hidden"], QWEN["intermediate"], QWEN["n_q"], QWEN["n_kv"], QWEN["head_dim"])
    assert got == 233046016, f"expected 233046016 (29.4M attention + 203.7M MLP), got {got}"


def test_block_params_mistral():
    """One Mistral-7B block holds about 218.1M weights outside the norms."""
    got = B.block_params(MISTRAL["hidden"], MISTRAL["intermediate"], MISTRAL["n_q"], MISTRAL["n_kv"], MISTRAL["head_dim"])
    assert got == 218103808, f"expected 218103808 (41.9M attention + 176.2M MLP), got {got}"


def test_moe_active_mixtral():
    """One Mixtral token touches attention plus 2 experts: about 394.3M per layer."""
    got = B.moe_active_params(MIXTRAL["hidden"], MIXTRAL["intermediate"], MIXTRAL["n_q"],
                              MIXTRAL["n_kv"], MIXTRAL["head_dim"], MIXTRAL["experts_per_tok"])
    assert got == 394264576, f"expected 394264576 (41.9M attention + 2*176.2M experts), got {got}"


def test_model_total_qwen():
    """28 Qwen blocks plus untied embeddings total about 7.62B weights."""
    per_block = B.block_params(QWEN["hidden"], QWEN["intermediate"], QWEN["n_q"], QWEN["n_kv"], QWEN["head_dim"])
    total = per_block * QWEN["layers"] + 2 * QWEN["vocab"] * QWEN["hidden"]
    assert total == 7615283200, f"expected 7615283200 weights for the 7B class, got {total}"
