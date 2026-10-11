"""Tests for chapter 6: repeat factors and KV bytes at pinned revisions.

- Qwen2.5-7B @ d149729398750b98c0af14eb82c78cfe92750796
- Mistral-7B-v0.1 @ 27d67f1b5f57dc0953326b2601d68371d40ea8da
- gpt-oss-120B @ b5c939de8f754692c1647ca79fbf85e8c1e70f8a
- DeepSeek-V4.1-Flash text stack @ 2cba9e42aa026125f3ed06c6d98c1db82f7ca027
"""

import kv_heads as K


def test_repeat_qwen():
    """Qwen2.5-7B repeats ×7: 28 queries over 4 KV heads."""
    assert K.repeat_factor(28, 4) == 7, "28 query heads / 4 KV heads is 7, not MHA"


def test_repeat_mistral():
    """Mistral-7B repeats ×4: 32 queries over 8 KV heads."""
    assert K.repeat_factor(32, 8) == 4, "32 query heads / 8 KV heads is 4"


def test_repeat_v41_flash():
    """V4.1-Flash repeats ×64: 64 queries over 1 KV head (MQA extreme)."""
    assert K.repeat_factor(64, 1) == 64, "64 query heads / 1 KV head is 64"


def test_kv_bytes_gptoss():
    """gpt-oss-120B caches 73,728 bytes per token: narrow heads, 36 layers."""
    got = K.kv_bytes_per_token(36, 8, 64)
    assert got == 73728, f"expected 73728 B (2*36*8*64*2 B), got {got}"


def test_kv_bytes_mistral():
    """Mistral-7B caches 131,072 bytes per token in bf16."""
    got = K.kv_bytes_per_token(32, 8, 128)
    assert got == 131072, f"expected 131072 B, got {got}"


def test_full_context_qwen():
    """Qwen2.5-7B's full 131,072-token context weighs 7.0 GiB beside 15 GB of weights."""
    got = K.context_bytes(57344, 131072)
    assert got == 7516192768, f"expected 7516192768 B (57,344 * 131,072), got {got}"
