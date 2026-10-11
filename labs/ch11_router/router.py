"""Chapter 11 lab: route tokens to experts.

Implement a top-k router over eight experts in pure Python: pick the best
two scores, renormalize their weights, combine two expert outputs, and
measure balance over a batch. No ties in the test scores, so sorting decides.

Finish the four TODO functions below.
"""


def top_k_indices(scores, k):
    """Indices of the k highest scores, best first."""
    # TODO: return the indices of the k largest values of scores, descending
    raise NotImplementedError("top_k_indices: sort indices by score, best first, keep k")


def renormalize(weights):
    """Rescale weights to sum to 1."""
    # TODO: return [w / sum(weights) for w in weights]
    raise NotImplementedError("renormalize: divide every weight by the total so they sum to 1")


def combine(outputs, weights):
    """Weighted sum of equally-shaped expert output vectors."""
    # TODO: return element-wise sum of w * out over pairs
    raise NotImplementedError("combine: add up weight times output, element by element")


def balance(counts):
    """Share of tokens owned by the busiest expert: max(counts) / sum(counts)."""
    # TODO: return max(counts) / sum(counts)
    raise NotImplementedError("balance: busiest expert count over total tokens")
