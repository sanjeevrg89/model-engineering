"""Tests for chapter 8: latent cache bytes at pinned revisions.

- DeepSeek-V2-Lite @ 604d5664dddd88a0433dbae533b7fe9472482de0
- DeepSeek-V3 @ e815299b0bcbac849fa540c768ef21845365c9eb
- Kimi-K2-Instruct @ fd1984e2b7a3350dbf7305fe73a4ede25c14de50
- Kimi-K3 @ f831ab66814297da540d832a5235f8e904f29d06
"""

import mla_bytes as M


def test_latent_v2_lite():
    """V2-Lite caches 31,104 bytes per token: 27 layers of 512+64."""
    assert M.latent_bytes_per_token(27, 512, 64) == 31104, "27 * (512 + 64) * 2 B"


def test_latent_v3():
    """V3 caches 70,272 bytes per token: 61 layers of the same ranks."""
    assert M.latent_bytes_per_token(61, 512, 64) == 70272, "61 * (512 + 64) * 2 B"


def test_latent_kimi_k3():
    """Kimi-K3 caches 27,648 latent bytes: only 24 of 93 layers are full MLA."""
    assert M.latent_bytes_per_token(24, 512, 64) == 27648, "24 * (512 + 64) * 2 B; KDA layers keep fixed state instead"


def test_gqa_same_shape():
    """The GQA formula on V2-Lite's head counts gives 221,184 B — seven times the latent."""
    gqa = M.gqa_bytes_per_token(27, 16, 128)
    assert gqa == 221184, f"2*27*16*128*2 B = 221184, got {gqa}"
    ratio = M.saving_ratio(gqa, 31104)
    assert abs(ratio - 7.111111111111111) < 1e-9, f"latent is ~7.1x smaller, got {ratio}"


def test_ratio_identity():
    """Equal caches give a ratio of 1."""
    assert M.saving_ratio(100, 100) == 1, "same bytes, ratio 1"
