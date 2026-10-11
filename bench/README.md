# Arithmetic bench

No GPU, no weights, no engine code. `bench/calc.py` recomputes the course's
per-token byte tables from the pinned configs in `.cache/src/models/` and
checks them against `research/models.json`, the shared answer key.

```bash
uv run --project bench python -m bench.calc --roster     # print the table
uv run --project bench python -m bench.calc --check      # fail on any drift from models.json
uv run --project bench python -m bench.calc --out bench/results/roster.json
```

Results go to `bench/results/roster.json` with the pinned revisions, method
and command. The numbers are exact integer arithmetic, identical on every
machine; the record exists so a wrong table fails loudly instead of drifting.

Measured checkpoint bytes (resident weights from shard headers) belong to
capstone probe 1: raw runs in `capstones/out/`, reviewed copies in
`capstones/results/`.
