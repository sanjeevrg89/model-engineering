"""Reference solution for chapter 1: block shapes."""


def kv_bytes_per_token(num_layers, num_kv_heads, head_dim, bytes_per_value=2):
    return 2 * num_layers * num_kv_heads * head_dim * bytes_per_value


def _attn(hidden, n_q_heads, n_kv_heads, head_dim):
    q = hidden * n_q_heads * head_dim
    k = hidden * n_kv_heads * head_dim
    v = hidden * n_kv_heads * head_dim
    o = n_q_heads * head_dim * hidden
    return q + k + v + o


def _mlp(hidden, intermediate):
    return 3 * hidden * intermediate


def block_params(hidden, intermediate, n_q_heads, n_kv_heads, head_dim):
    return _attn(hidden, n_q_heads, n_kv_heads, head_dim) + _mlp(hidden, intermediate)


def moe_active_params(hidden, intermediate, n_q_heads, n_kv_heads, head_dim, n_active_experts):
    return _attn(hidden, n_q_heads, n_kv_heads, head_dim) + n_active_experts * _mlp(hidden, intermediate)
