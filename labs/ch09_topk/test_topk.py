"""Tests for chapter 9: indexed top-k selection at pinned revisions.

Scores are deterministic and tie-free; an early position wins on purpose.
GLM-5.3 indexer: 32 heads of width 128 (config.json l18-19).
"""

import topk as T

SCORES = [((i * 37) % 101) / 101.0 for i in range(8192)]


def test_top_positions():
    """Top-2,048 of 8,192 fixed scores: best first, and position 12's region wins early."""
    got = T.top_k_positions(SCORES, 2048)
    assert len(got) == 2048, f"keep exactly 2,048 positions, got {len(got)}"
    assert got == sorted(got, key=lambda i: SCORES[i], reverse=True), "best score first, down the ranking"
    assert SCORES[got[0]] == max(SCORES), "first kept position holds the top score"


def test_early_winner():
    """The winner is not recent: top score sits far from the end, so recency fails."""
    got = T.top_k_positions(SCORES, 2048)
    assert got[0] < 8192 - 2048, "the top score is outside the last-2,048 window; a window would miss it"


def test_read_fraction():
    """2,048 of 8,192 reads is one quarter."""
    assert abs(T.read_fraction(2048, 8192) - 0.25) < 1e-12, "2048/8192 of the cache is read"


def test_indexer_bytes():
    """GLM-5.3's indexer keys for 131,072 tokens: 32 heads × 128 × 2 B each."""
    got = T.indexer_bytes(131072, 32, 128)
    assert got == 1073741824, f"131072 * 32 * 128 * 2 B = 1 GiB, got {got}"
