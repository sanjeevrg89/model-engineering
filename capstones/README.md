# GPU capstones

Four probes that test the course's predictions on real hardware. Probe 1 runs
anywhere with network access (configs are local, shard headers download in
kilobytes — no weights are fetched). Probes 2–4 need a GPU and refuse to run
without one; their scripts document the exact command and the record format so
anyone with the hardware can publish a run.

## The four probes

1. **Weigh it** (`weigh.py`, runs now). Sums resident checkpoint bytes per roster
   model from the safetensors shard headers at the pinned revisions, and checks
   them against the course's weight tables. No weights downloaded.
2. **Fill it** (GPU). Grows one sequence to the model's max context on the
   reference SKU and records where allocation fails (chapters 20, 23).
3. **Route it** (GPU). Counts distinct experts touched over a fixed workload per
   MoE roster model (chapters 11, 12, 15).
4. **Denoise it** (GPU). Times LLaDA-8B diffusion steps at several mask ratios
   on one GPU (chapter 25).

## Running probe 1

```bash
python3 capstones/weigh.py --out capstones/out/weigh.json
```

The recorder stamps the machine, Python version, pinned revisions and command
with every result, and scrubs local paths. Raw runs live in `capstones/out/`
(local only, git-ignored); published results are recorded with context into
`bench/results/` by hand after review.

## Self-test (no network, no GPU)

```bash
uv run pytest capstones/selftest -q
```

Fixtures stand in for shard headers and configs; the math is what's tested.
