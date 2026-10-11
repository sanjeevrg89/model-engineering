"""Chapter 9 lab: top-k selection over scored positions.

Score 8,192 past positions with fixed tie-free scores, keep the top 2,048,
and price what the selection saves. Selecting by recency instead of by
score is the classic mistake — the tests plant an early winner to catch it.

Finish the three TODO functions below.
"""


def top_k_positions(scores, k):
    """Positions of the k highest scores, best first."""
    # TODO: return positions (indices) of the k largest scores, descending
    raise NotImplementedError("top_k_positions: sort positions by score, best first, keep k")


def read_fraction(n_selected, n_total):
    """Share of the cache the attention kernel reads."""
    # TODO: return n_selected / n_total
    raise NotImplementedError("read_fraction: selected positions over all positions")


def indexer_bytes(n_tokens, n_index_heads, index_head_dim, bytes_per_value=2):
    """Bytes of indexer keys for n_tokens (keys only, no values)."""
    # TODO: return n_tokens * n_index_heads * index_head_dim * bytes_per_value
    raise NotImplementedError("indexer_bytes: tokens times heads times width times byte width")
