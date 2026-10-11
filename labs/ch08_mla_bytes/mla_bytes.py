"""Chapter 8 lab: latent bytes against grouped KV bytes.

Price MLA caches from their ranks: latent bytes per token, the equivalent
GQA bytes for the same shape, and the saving ratio. The plain GQA formula
from chapter 6 does not apply to latents — that is the point.

Finish the three TODO functions below.
"""


def latent_bytes_per_token(num_layers, kv_lora_rank, rope_dim, bytes_per_value=2):
    """Bytes of MLA latent cache one token occupies across all layers."""
    # TODO: return num_layers * (kv_lora_rank + rope_dim) * bytes_per_value
    raise NotImplementedError("latent_bytes_per_token: layers times (rank + rotary width) times byte width")


def gqa_bytes_per_token(num_layers, num_kv_heads, head_dim, bytes_per_value=2):
    """Bytes of standard grouped-KV cache (chapter 6's formula, unchanged)."""
    # TODO: return 2 * num_layers * num_kv_heads * head_dim * bytes_per_value
    raise NotImplementedError("gqa_bytes_per_token: keys and values per layer, as in chapter 6")


def saving_ratio(gqa_bytes, latent_bytes):
    """How many times smaller the latent cache is."""
    # TODO: return gqa_bytes / latent_bytes
    raise NotImplementedError("saving_ratio: divide the GQA bytes by the latent bytes")
