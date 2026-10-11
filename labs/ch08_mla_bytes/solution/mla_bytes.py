"""Reference solution for chapter 8: latent bytes."""


def latent_bytes_per_token(num_layers, kv_lora_rank, rope_dim, bytes_per_value=2):
    return num_layers * (kv_lora_rank + rope_dim) * bytes_per_value


def gqa_bytes_per_token(num_layers, num_kv_heads, head_dim, bytes_per_value=2):
    return 2 * num_layers * num_kv_heads * head_dim * bytes_per_value


def saving_ratio(gqa_bytes, latent_bytes):
    return gqa_bytes / latent_bytes
