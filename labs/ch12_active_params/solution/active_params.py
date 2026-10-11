"""Reference solution for chapter 12: fine-grained MoE arithmetic."""


def moe_layer_active(hidden, moe_intermediate, n_active_routed, n_shared):
    one_expert = 3 * hidden * moe_intermediate
    return (n_active_routed + n_shared) * one_expert


def dense_fraction(first_k_dense, num_layers):
    return first_k_dense / num_layers


def awake_share(n_active, n_routed):
    return n_active / n_routed
