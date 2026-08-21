# Ideas

- Try 75% and 100% CI `maxWorkers`; confirm any win with repeated hosted runs because the current 50% cap was added for Postgres/PGlite stability.
- Inspect Vitest's per-project timing from CI logs to identify heavy projects and whether project-level scheduling leaves cores idle.
- Evaluate splitting package coverage and example tests into concurrent processes inside the same job only if CPU/memory contention does not erase the wall-clock gain; preserve a single job and all checks.
- Explore safe coverage sharding plus Istanbul JSON merge if one Vitest coordinator cannot keep the runner busy, but do not weaken per-package coverage ownership or thresholds.
- Determine whether the cloudflare-worker Postgres startup can overlap dependency linking/build setup without changing readiness or teardown guarantees.
