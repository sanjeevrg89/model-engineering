"""Tests for chapter 12: fine-grained MoE arithmetic at pinned revisions.

- Mixtral-8x7B-v0.1 @ fc7ac94680e38d7348cfa806e51218e6273104b0
- DeepSeek-V3 @ e815299b0bcbac849fa540c768ef21845365c9eb
- Kimi-K2-Instruct @ fd1984e2b7a3350dbf7305fe73a4ede25c14de50
- DeepSeek-V2-Lite @ 604d5664dddd88a0433dbae533b7fe9472482de0
"""

import active_params as A


def test_v3_active_layer():
    """V3 activates 396,361,728 MLP weights per MoE layer: 8 routed + 1 shared of 44M."""
    got = A.moe_layer_active(7168, 2048, 8, 1)
    assert got == 396361728, f"9 experts * 3*7168*2048 = 396361728, got {got}"


def test_mixtral_active_layer():
    """Mixtral activates 352,321,536 MLP weights per layer: 2 of 176M, no shared expert."""
    got = A.moe_layer_active(4096, 14336, 2, 0)
    assert got == 352321536, f"2 experts * 3*4096*14336 = 352321536, got {got}"


def test_v2_lite_two_shared():
    """V2-Lite's 2 shared experts count as always-on, not routed."""
    got = A.moe_layer_active(2048, 1408, 6, 2)
    assert got == 8 * 3 * 2048 * 1408, f"(6 routed + 2 shared) * 3*2048*1408 = {8 * 3 * 2048 * 1408}, got {got}"


def test_dense_fraction_v3():
    """V3 leaves 3 of 61 layers dense."""
    got = A.dense_fraction(3, 61)
    assert abs(got - 3 / 61) < 1e-12, f"3/61 of layers dense, got {got}"


def test_awake_share():
    """8 of 256 routed experts are awake per V3 token: 3.125%. Mixtral wakes 25%."""
    assert abs(A.awake_share(8, 256) - 0.03125) < 1e-12, "8/256 awake"
    assert abs(A.awake_share(2, 8) - 0.25) < 1e-12, "2/8 awake"
