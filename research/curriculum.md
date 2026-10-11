# Curriculum map

Which two designs each chapter runs, and what the reader builds. A = incumbent,
B = challenger. Labs marked with *.

| Ch | A | B | Lab |
|---|---|---|---|
| 01 one block | Qwen2.5-7B dense block | Mistral-7B windowed block | * block shapes + roster sizes |
| 02 vocabs | Mistral-7B 32k | gpt-oss-120B 201,088 | — |
| 03 positions | Mistral-7B theta 10k | Qwen2.5-7B theta 1M | * RoPE frequencies |
| 04 norms/gates | RMSNorm + SwiGLU | Qwen3-8B QK-norm | — |
| 05 scale | Qwen2.5-7B 7B | DeepSeek-V3 671B | * FLOPs + floor |
| 06 GQA | Mistral-7B 8 KV heads | Qwen2.5-7B 4 KV heads | * KV bytes |
| 07 windows | Mistral-7B 4,096 | gpt-oss-120B 128 | — |
| 08 MLA | DeepSeek-V2-Lite | Kimi-K2 | * latent bytes |
| 09 DSA | DeepSeek-V3.2-Exp index_topk 2,048 | GLM-5.3 flagship DSA | * top-k select |
| 10 NoPE/iRoPE | RoPE baselines | KDA-NoPE / iRoPE (cited) | — |
| 10 NoPE/iRoPE | RoPE baselines | KDA-NoPE / iRoPE (cited) | — |
| 11 coarse MoE | Mistral-7B dense | Mixtral-8x7B top-2-of-8 | * router |
| 12 fine MoE | Mixtral-8x7B | DeepSeek-V3 256/top-8 | * active params |
| 13 shared expert | V2-Lite (64) | V3 (256 + shared) | — |
| 14 western MoE | Mixtral-8x7B | gpt-oss-120B 128/top-4 | — |
| 15 scale MoE | DeepSeek-V3 | Kimi-K3 896 experts top-16 | — |
| 16 SSM | Qwen2.5 attention | Mamba-2 block | * scan |
| 17 DeltaNet | full attention | Gated DeltaNet (cited) | — |
| 18 KDA | Gated DeltaNet (cited) | Kimi-K3 KDA + NoPE MLA | — |
| 19 Lightning | 3:1 hybrid (cited) | MiniMax-M2.5 attn list | — |
| 20 state budget | Qwen2.5 pure KV | V3.2-Exp latent+index | * budget |
| 21 MTP | without MTP | V3 / GLM-5.3 / V4.1-Flash MTP + DSpark | — |
| 22 bits | bf16 dense | FP8 MoE / MXFP4 Kimi-K3 | — |
| 23 full context | Qwen2.5-7B 131k | Kimi-K3 1M | — |
| 24 reasoning | base configs | R1-style RL (cited) | — |
| 25 diffusion | Qwen2.5-7B AR | LLaDA-8B denoise | * denoise step |
| 26 AR-init diffusion | LLaDA scratch (cited) | Dream AR-init (cited) | — |
| 27 fusion | text-only | early fusion (cited) + Kimi-K3 / V4.1-Flash towers | — |
| 28 agents | short-context dense | long-context MoE | — |
| 29 serving | dense serving | MoE-hybrid serving | — |
| 30 field guide | — | — | — |

Roofline floors reuse chapter 5's method: floor(step) = max(bytes/bandwidth,
flops/peak). Reference SKU for single-GPU arithmetic: H200 SXM (141 GB HBM3e,
4.8 TB/s, 989.5 TFLOPS dense bf16) — same figures as the sibling courses.
