"""Chapter 6 lab: the repeat factor and KV bytes.

Read a pinned fixture config and compute the repeat factor, KV bytes per
cached token, and cache bytes for a full context. Watch out for latent and
sliding-window rows: the plain formula only prices standard KV caches.

Finish the three TODO functions below.
"""


def repeat_factor(n_q_heads, n_kv_heads):
    """How many times each KV head repeats to serve the query heads."""
    # TODO: return n_q_heads // n_kv_heads
    raise NotImplementedError("repeat_factor: divide query heads by KV heads")


def kv_bytes_per_token(num_layers, num_kv_heads, head_dim, bytes_per_value=2):
    """Bytes of standard KV cache one token occupies across all layers."""
    # TODO: return 2 * num_layers * num_kv_heads * head_dim * bytes_per_value
    raise NotImplementedError("kv_bytes_per_token: count K and V per layer, then multiply by the byte width")


def context_bytes(kv_bytes_per_token, n_tokens):
    """Cache bytes for a full context of n_tokens."""
    # TODO: return kv_bytes_per_token * n_tokens
    raise NotImplementedError("context_bytes: multiply the per-token bytes by the context length")
