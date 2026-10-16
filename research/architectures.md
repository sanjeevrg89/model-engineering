# Architecture timeline: November 2022 – October 2026

Source map for the course. Each entry is a design the course teaches or a cited
delta. Links are to papers, repos, release notes and explainers checked during
research in October 2026. Config values in chapters come only from the pinned
revisions in `course.json`; paper claims stay attributed in the sentence.

## 2022

- **Nov 30, ChatGPT launches** on GPT-3.5 with RLHF. Fastest-growing consumer app
  ever; the moment LLMs go mainstream. Course starts here.
  (https://lmtimeline.com/llm-timeline.html)
- LLaMA recipe forms in open: RMSNorm + SwiGLU + RoPE in one decoder block.
  `huggyllama/llama-7b` (Feb 2023) ships the trio in open weights and becomes the
  ancestor of nearly every open model since.
  (https://hfviewer.com/timeline/)

## 2023

- **May, GQA.** Several query heads share one KV head; the KV cache shrinks
  several-fold. Ainslie et al., "GQA: Training Generalized Multi-Query Transformer
  Models from Multi-Head Checkpoints". (https://hfviewer.com/timeline/)
- **Jul, LLaMA-2.** 70B uses GQA; 7B/13B stay MHA. The recipe splits by scale.
- **Aug, YaRN.** Rescaled RoPE frequencies stretch short-trained contexts to
  hundreds of thousands of tokens. (https://hfviewer.com/timeline/)
- **Sep, Mistral-7B-v0.1.** GQA plus sliding-window attention (4,096) in a 7B that
  punches above its size. Pinned roster config.
- **Nov, Grok-1.** 314B MoE open weights (86B active). Cited delta for MoE history.
- **Dec, Mixtral-8x7B-v0.1.** Eight experts per layer, two active per token. The
  2017 MoE idea lands in an open flagship. Pinned roster config.
- **Dec, Mamba.** Selective state-space model: input-dependent parameters, linear
  time, 5x throughput claims over Transformers. Gu & Dao.
  (https://www.ai21.com/blog/rise-of-hybrid-llms/)
- **Dec, Gemini 1.0.** Multimodal flagship in three sizes.
  (https://en.wikipedia.org/wiki/List_of_large_language_models)

## 2024

- **Jan, DeepSeekMoE.** Fine-grained experts plus one always-on shared expert.
  Dai et al. Cited delta for chapter 13. (https://hfviewer.com/timeline/)
- **Feb–Apr, open-weights wave.** Gemma, LLaMA-3 (GQA everywhere), DBRX (enterprise
  MoE), Jamba (first large hybrid Transformer–Mamba–MoE, 1:7 attention:Mamba ratio,
  MoE every two blocks). (https://www.ai21.com/blog/rise-of-hybrid-llms/)
- **Apr, Jamba / Samba / Zamba.** Inter-layer hybrids: interleave standard
  Transformer and Mamba blocks; ratio sets the quality–throughput trade.
  (https://arxiv.org/html/2510.04800v1)
- **May, DeepSeek-V2.** MLA: keys and values compress into one small latent per
  token; cache shrinks an order of magnitude. Paper and model ship together.
  (https://hfviewer.com/timeline/)
- **Jun, Nemotron-H.** Hybrid Mamba–Transformer (8B/47B/56B), 92% of attention
  replaced, up to 3x throughput claims. (https://www.ai21.com/blog/rise-of-hybrid-llms/)
- **Jul, LLaMA-3.1-405B.** Dense at the largest open scale; settles the MoE-vs-dense
  question for a season. Qwen2.5 follows in Sep (pinned Qwen2.5-7B config).
- **Sep, o1.** Test-time compute goes mainstream: reasoning as RL + thinking tokens.
  Cited delta for chapter 24.
- **Dec, DeepSeek-V3.** Fine-grained MoE (256 experts), multi-token prediction,
  grouped routing that stays friendly to hardware. Pinned roster config.
  (https://hfviewer.com/timeline/)
- **Dec, Falcon Mamba 7B / Bamba-9B / Codestral Mamba.** Pure and hybrid Mamba
  models match 7–9B Transformers with constant memory.
  (https://www.ai21.com/blog/rise-of-hybrid-llms/)

## 2025

- **Jan, DeepSeek-R1.** RL reasoning on the V3 architecture; training recipe, not a
  new base design. Cited delta for chapter 24.
- **Feb, LLaDA.** First diffusion LM trained from scratch at 8B: masked diffusion,
  bidirectional attention, no KV cache, competitive with LLaMA-3-8B. Pinned
  LLaDA-8B-Base config. Paper: Nie et al. arXiv:2502.09992; repo ML-GSAI/LLaDA
  (repo id on the Hub: GSAI-ML/LLaDA-8B-Base).
- **Apr, Llama 4 Scout & Maverick.** First Meta MoE (17B active, 16 / 128 experts),
  early fusion multimodality, iRoPE interleaved attention, 10M-token context on
  Scout. Cited delta for chapters 10, 27. (https://ai.meta.com/blog/llama-4-multimodal-intelligence/)
- **Apr, Dream-7B.** Diffusion initialized from Qwen2.5-7B weights plus
  context-adaptive noise; 0.6T tokens, matches AR baselines, stronger planning.
  Cited delta for chapter 26. (https://hkunlp.github.io/blog/2025/dream/)
- **Apr, Qwen3.** QK-norm dense family (pinned Qwen3-8B config), hybrid Next
  lineage begins.
- **May, Mercury Coder / Gemini Diffusion.** Commercial diffusion LMs: ~1,100–1,479
  tok/s claims, 5–10x AR speed. Cited deltas for chapter 26.
- **Jul, GLM-4.5 / Kimi-K2 / Qwen3-Next.** MLA MoE flagships; Qwen3-Next sets the
  3:1 Gated DeltaNet / gated-attention hybrid. Pinned GLM-4.5 and Kimi-K2 configs.
- **Aug, GPT-5 + gpt-oss.** Closed flagship plus the main Western open MoE
  (120B, 128 experts, 4 active, 128-token window). Pinned gpt-oss-120B config.
- **Sep, DeepSeek-V3.2-Exp.** DSA: lightning indexer + top-k selection over MLA.
  Pinned V3.2-Exp config (`index_topk` 2,048). (https://github.com/rasbt/LLMs-from-scratch/blob/main/ch04/09_dsa/README.md)
- **Sep, Qwen3-Next / MiniMax / Hunyuan-TurboS.** Hybrid season: Gated DeltaNet,
  Lightning attention, Mamba-2 mixes; 1:7 and 3:1 ratios.
- **Oct, Kimi Linear paper.** KDA: channel-wise gating over Gated DeltaNet, 3:1
  with NoPE MLA, claims first hybrid to beat full attention paired-scale.
  arXiv:2510.26692. Cited delta for chapter 18.
- **Oct, hybrid survey.** Inter- vs intra-layer hybridization, MoE compatibility,
  scaling guidance. arXiv:2510.04800.

## 2026 (Jan – Oct 11)

- **Feb, Qwen3.5-397B-A17B.** Production validation of the 3:1 Gated DeltaNet
  hybrid at 397B. Cited delta for chapters 17, 19.
  (https://huggingface.co/blog/mlabonne/qwen35)
- **Feb–Apr, GLM-5 / Kimi-K2.5 / Kimi-K2.6.** MLA + DSA flagships at ~744B–1T.
  Cited deltas for chapters 8, 9, 15.
- **Apr, DeepSeek-V4-Pro / Jul, V4-Flash.** ~1.6T MoE (49B active) and 284B Flash
  (13B active). Cited deltas for chapters 12, 22.
- **Jun, MiniMax-M2.5 / M3.** Lightning + MLA hybrids, sparse attention, 1M
  context. Pinned M2.5 config; M3 as cited delta.
- **Jul, Kimi-K3 (2.8T, 104B active) / Qwen3.8 (2.4T-A95B).** Trillion-parameter
  open MoEs with KDA / Gated DeltaNet hybrids. Cited deltas; join the roster when
  configs are publicly fetchable.
- **Aug, GLM-5.3 / DeepSeek-V4-Pro-0813.** Latest MLA+DSA and MQA-MoE flagships.
  Cited deltas.
- **Sep, DeepSeek-V4.1-Flash.** 8B-prefill / 16B-decode active. Cited delta.
- Closed flagships (GPT-5.x/6, Claude 4.x/5.x, Gemini 3.x Flash/Pro, Grok 4.x,
  Muse Spark) stay proprietary with undisclosed sizes; the course cites their
  documented behaviors (context lengths, prices, modalities) only, never their
  architectures as fact.

## October 2026 scoreboard (Artificial Analysis, attributed)

Independent scores the course cites as scores, never as architecture facts.
Pinned roster members are marked (*). Gated models (MiMo-V2.6-Pro, Mistral Large 4)
stay cited deltas: scores only, no config claims.

**Intelligence Index (higher is better):** MiMo-V2.6-Pro 46; GLM-5.3 (max) 45 (*);
Kimi K3 (max) 44 (*); GLM-5.3-Flash 42; DeepSeek V4.1 Flash (max) 39 (*);
Qwen3.8 27B (high) 34; K2 Horizon 375B (max) 31; MiniMax-M3 29; Inking (high) 25;
Nemotron 3 Ultra 23; Muse Glimmer (high) 17.

**Total parameters, billions (trainable):** Kimi K3 (max) 2800 (*); MiMo-V2.6-Pro
1020; Inking (high) 975; GLM-5.3 (max) 753 (*); DeepSeek V4.1 Flash (max) 552 (*);
Nemotron 3 Ultra 550; MiniMax-M3 428; K2 Horizon 375B (max) 375; GLM-5.3-Flash 320;
Muse Glimmer (high) 30; Qwen3.8 27B (high) 27.

**Openness Index (0–100, higher is more open):** Nemotron 3 Ultra 83;
MiMo-V2.6-Pro 53; GLM-5.3-Flash 44; DeepSeek V4.1 Flash (max) 44 (*);
Muse Glimmer (high) 44; Kimi K3 (max) 39 (*); Qwen3.8 27B (high) 39;
Inking (high) 39; GLM-5.3 (max) 33 (*); MiniMax-M3 33.

**Overall tiers:** S — Kimi K3 2.8T (*), GLM-5.2 753B, DeepSeek-V4-Pro 1.6T,
Kimi K2.6 1T. A — MiniMax M3 428B, DeepSeek-V4-Flash 284B, Hunyuan Hy3 295B,
Step-3.7-Flash 198B, Qwen3.6-27B, Qwen3.6-35B-A3B, Nemotron 3 Ultra 550B,
GLM-4.7 355B, MiMo-V2-Flash 309B, DeepSeek R1 671B. B — MiniMax M2.7 230B,
Gemma 4 31B, Mistral Medium 3.5 128B, Command A+ 218B, Ling-2.6-1T,
Nemotron 3 Super 120B, MiMo-V2.5-Pro 1.02T, Mistral Small 4 119B, GPT-oss 120B (*),
Nemotron Ultra 253B, Nemotron Super 49B, Step3 316B. C — Llama 4 Maverick 400B,
Gemma 3 27B, Nemotron Nano 30B.

**Pinned October 2026 roster additions (configs fetched without authentication):**

- **Kimi-K3** (`moonshotai/Kimi-K3`, rev `f831ab6`): text stack is `kimi_linear`
  (line 175), 93 layers (187), hidden 7,168 (50), 96 heads / 96 KV heads
  (181, 188), MLA with rank 512 and NoPE (59, 173), 896 experts with 16 active
  plus 2 shared (185, 186, 191), 24 full-attention layers every fourth layer
  (full_attn_layers list at 67), 1M context (171), MXFP4 experts. The Kimi Linear
  paper architecture at 2.8T scale.
- **GLM-5.3** (`zai-org/GLM-5.3`, rev `aca966e`): `GlmMoeDsaForCausalLM, 78 layers
  (200), hidden 6,144 (17), MLA ranks 512/2048 (108) with head dims 192+64
  (207, 208), DSA index_topk 2,048 with 32 index heads (22), 256 routed + 1 shared
  experts top-8 (195, 196, 199), first 3 layers dense (14), one MTP layer (202),
  1M context (109), FP8 weights. The V3.2-Exp experiment productized.
- **DeepSeek-V4.1-Flash** (`deepseek-ai/DeepSeek-V4.1-Flash`, rev `2cba9e4`):
  multimodal text+vision stack (architectures line 2); text side is 40 layers (27)
  with 64 query heads over 1 KV head (28, 29), latent query/output ranks
  (32, 33), 384 routed + 1 shared experts top-6 (52–54), 128-token window (59),
  4 full-context source layers (kv_source_layer_ids at 106), index_topk 512 (124),
  3 MTP layers (145), DSpark speculative block of 5 (146), FP8 (13), 1M context (43).

## Attention papers behind the zoo

- NSA (DeepSeek, Feb 2025): https://arxiv.org/abs/2502.11089 — compressed coarse,
  selected fine, sliding window; natively trainable; Triton kernels.
- Medusa: https://arxiv.org/abs/2401.10774 — extra decoding heads + tree
  attention; 2.2–2.8x claimed.
- EAGLE: https://arxiv.org/abs/2401.15077 — feature autoregression with sampled
  token fed back; ~0.8 draft accuracy claimed. EAGLE-2 (dynamic trees):
  https://arxiv.org/abs/2406.16858.
- RetNet: https://arxiv.org/abs/2307.08621 — multi-scale retention, parallel /
  recurrent / chunkwise forms.
- GLA: https://arxiv.org/abs/2312.06635 — data-dependent forget gates,
  chunkwise for tensor cores.
- YaRN: https://arxiv.org/abs/2309.00071 — NTK-by-parts RoPE extension to 128k.
- ALiBi: https://arxiv.org/abs/2108.12409 — per-head linear distance penalty,
  no embeddings.
- StreamingLLM + sinks: https://github.com/mit-han-lab/streaming-llm —
  window plus pinned initial tokens to 4M.
- Hyena: https://arxiv.org/abs/2302.10866 — long implicit convolutions.
- Kimi Linear: https://arxiv.org/abs/2510.26692 — KDA + NoPE MLA, 3:1 hybrid.
- RWKV history: project wiki (V1–V8, DeepEmbed, ROSA).

## Explainers the course leans on

- Raschka, "LLM Architecture Gallery" + "Hybrid Attention" + "Visual Guide to
  Attention Variants" + "Gated DeltaNet for Linear Attention" (LLMs-from-scratch).
  Layer ratios, KV math, KDA vs GDN, MLA vs GQA.
- Tensor Economics, "DeepSeek Sparse Attention from First Principles" (Apr 2026).
  MLA MHA/MQA modes, indexer cost model, DSA decode walkthrough.
- Daily Dose of DS, "Diffusion LLMs from the Ground Up" (Apr 2026). LLaDA 2.0
  block-WSD, Dream AR-init, block KV caching, confidence-aware parallel decoding.
- RWKV wiki, architecture history (V1–V8 incl. DeepEmbed, ROSA).
- ACM LLM Timeline paper (Gathara 2026): teaching lineage as a graph.
