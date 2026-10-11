"""Reference solution for chapter 11: top-k routing."""


def top_k_indices(scores, k):
    return sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]


def renormalize(weights):
    total = sum(weights)
    return [w / total for w in weights]


def combine(outputs, weights):
    return [sum(w * out[j] for w, out in zip(weights, outputs)) for j in range(len(outputs[0]))]


def balance(counts):
    return max(counts) / sum(counts)
