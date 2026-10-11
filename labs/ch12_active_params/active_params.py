"""Chapter 12 lab: active weights in fine-grained MoE.

Count what one token touches: active MLP per MoE layer with and without
shared experts, the dense-first fraction, and the awake share of experts.
Expert arithmetic is three matrices (gate, up, down) each.

Finish the three TODO functions below.
"""


def moe_layer_active(hidden, moe_intermediate, n_active_routed, n_shared):
    """Active MLP weights in one MoE layer: routed picks plus shared experts."""
    # TODO: one expert holds 3 * hidden * moe_intermediate; multiply by (n_active_routed + n_shared)
    raise NotImplementedError("moe_layer_active: one SwiGLU expert times routed-plus-shared count")


def dense_fraction(first_k_dense, num_layers):
    """Share of layers left dense."""
    # TODO: return first_k_dense / num_layers
    raise NotImplementedError("dense_fraction: dense-first layers over all layers")


def awake_share(n_active, n_routed):
    """Share of routed experts awake for one token."""
    # TODO: return n_active / n_routed
    raise NotImplementedError("awake_share: active routed experts over all routed experts")
