"""Chapter 1 lab: shapes and weights of one decoder block.

Read a pinned fixture config and compute what one block costs:
KV bytes per cached token, weights per block, and active weights per token
for a top-k MoE block. All arithmetic is integers; sizes are in elements
unless a byte width is given.

Finish the three TODO functions below. The tests check your answers against
Qwen2.5-7B, Mistral-7B-v0.1 and Mixtral-8x7B-v0.1 at their pinned revisions.
"""


def kv_bytes_per_token(num_layers, num_kv_heads, head_dim, bytes_per_value=2):
    """Bytes of KV cache one token occupies across all layers.

    Every layer stores one key and one value vector per KV head.
    """
    # TODO: return 2 * num_layers * num_kv_heads * head_dim * bytes_per_value
    raise NotImplementedError("kv_bytes_per_token: count K and V per layer, then multiply by the byte width")


def block_params(hidden, intermediate, n_q_heads, n_kv_heads, head_dim):
    """Weights in one dense decoder block, excluding norms.

    Attention holds Q, K, V and O projections; the SwiGLU feed-forward
    holds gate, up and down projections.
    """
    # TODO: Q is hidden x (n_q_heads * head_dim), K/V are hidden x (n_kv_heads * head_dim),
    # TODO: O is (n_q_heads * head_dim) x hidden; gate/up are hidden x intermediate,
    # TODO: down is intermediate x hidden. Return the sum.
    raise NotImplementedError("block_params: add the four attention projections and the three MLP matrices")


def moe_active_params(hidden, intermediate, n_q_heads, n_kv_heads, head_dim, n_active_experts):
    """Weights one token touches in one MoE block: full attention plus its experts.

    Each expert is a full SwiGLU feed-forward of the same shape.
    """
    # TODO: attention part equals the attention half of block_params;
    # TODO: add n_active_experts times the three MLP matrices.
    raise NotImplementedError("moe_active_params: attention plus the active experts' gate/up/down matrices")
