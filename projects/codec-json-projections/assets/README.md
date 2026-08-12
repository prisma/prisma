# Project evidence

- [`codec-json-projection-design-checkpoint.md`](./codec-json-projection-design-checkpoint.md) preserves the complete design discussion, evidence, decisions, rejected alternatives, assumptions, and prototype state that preceded the tracked project.
- [`postgres-numeric-prototype.patch.gz`](./postgres-numeric-prototype.patch.gz) preserves the exact five-file uncommitted PostgreSQL numeric prototype. Decompress with `gzip -dc projects/codec-json-projections/assets/postgres-numeric-prototype.patch.gz`; the decompressed patch has SHA-256 `0ed2afae20a3824dad79ebbf27f9dace730b5d729a626a4888414a98be4e3e7a`.

The prototype demonstrates the precision regression and that pre-JSON text projection prevents it. Its hardcoded codec-ID branch and derived-table lineage inference are evidence only, not the selected implementation architecture.
