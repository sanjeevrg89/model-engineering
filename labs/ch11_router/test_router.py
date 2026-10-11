"""Tests for chapter 11: top-k routing over eight experts."""

import router as R

SCORES = [0.03, 0.11, 0.31, 0.05, 0.09, 0.24, 0.02, 0.15]


def test_top_two():
    """Top-2 of the fixed scores are experts 2 and 5, best first."""
    assert R.top_k_indices(SCORES, 2) == [2, 5], "0.31 beats 0.24; no ties, sorting decides"


def test_top_one():
    """Top-1 is expert 2 alone."""
    assert R.top_k_indices(SCORES, 1) == [2], "the single best score is index 2"


def test_renormalize():
    """Kept weights rescale to sum to 1: 0.31 and 0.24 become 0.564 and 0.436."""
    got = R.renormalize([0.31, 0.24])
    assert abs(sum(got) - 1.0) < 1e-9, f"renormalized weights must sum to 1, got {sum(got)}"
    assert abs(got[0] - 0.31 / 0.55) < 1e-9, f"first weight should be 0.31/0.55, got {got[0]}"


def test_combine():
    """Weighted sum of two expert vectors, by hand."""
    got = R.combine([[1.0, 2.0], [3.0, 4.0]], [0.5, 0.5])
    assert got == [2.0, 3.0], f"half of [1,2] plus half of [3,4] is [2,3], got {got}"


def test_balance():
    """Six of ten tokens on one expert is a 0.6 imbalance."""
    got = R.balance([6, 2, 1, 1, 0, 0, 0, 0])
    assert abs(got - 0.6) < 1e-9, f"busiest expert owns 6/10 tokens, got {got}"
