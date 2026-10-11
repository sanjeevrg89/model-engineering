"""Reference solution for chapter 6: repeat factors and KV bytes."""


def repeat_factor(n_q_heads, n_kv_heads):
    return n_q_heads // n_kv_heads


def kv_bytes_per_token(num_layers, num_kv_heads, head_dim, bytes_per_value=2):
    return 2 * num_layers * num_kv_heads * head_dim * bytes_per_value


def context_bytes(kv_bytes_per_token, n_tokens):
    return kv_bytes_per_token * n_tokens
