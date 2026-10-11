"""A 64-word vocabulary, so the toy model's output is readable."""

VOCAB = [
    "<eos>", "the", "a", "of", "to", "and", "is", "in",
    "cache", "block", "page", "token", "tokens", "batch", "step", "queue",
    "prefill", "decode", "kernel", "graph", "GPU", "TPU", "memory", "hit",
    "miss", "radix", "tree", "hash", "chain", "prefix", "request", "budget",
    "scheduler", "engine", "worker", "model", "layer", "head", "key", "value",
    "query", "attention", "fast", "slow", "warm", "cold", "free", "full",
    "you", "are", "helpful", "assistant", "system", "user", "answer", "why",
    "how", "what", ",", ".", ":", "?", "!", "\n",
]

EOS = 0
_ID = {w: i for i, w in enumerate(VOCAB)}


def encode(text: str) -> list[int]:
    """Whitespace tokenizer over VOCAB; punctuation must be space-separated."""
    out = []
    for w in text.split():
        if w not in _ID:
            raise KeyError(f"{w!r} is not in the toy vocabulary")
        out.append(_ID[w])
    return out


def decode(ids: list[int]) -> str:
    return " ".join(VOCAB[i] for i in ids)
