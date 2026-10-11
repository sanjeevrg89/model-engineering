"""Reference solution for chapter 9: top-k selection."""


def top_k_positions(scores, k):
    return sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]


def read_fraction(n_selected, n_total):
    return n_selected / n_total


def indexer_bytes(n_tokens, n_index_heads, index_head_dim, bytes_per_value=2):
    return n_tokens * n_index_heads * index_head_dim * bytes_per_value
