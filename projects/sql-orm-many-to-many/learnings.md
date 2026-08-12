# Learnings — sql-orm-many-to-many

Working ledger of patterns surfaced during this run. Reviewed at close-out; cross-cutting lessons migrate to durable docs.

## Harness lacks subagent resume

This harness exposes no `SendMessage`/resume for spawned subagents — the `Agent` tool always spawns fresh. The `drive-build-workflow` § Subagent continuity default (one persistent implementer + reviewer resumed across dispatches) degrades to its documented fallback: **fresh subagent per dispatch/round with a full-context brief**, with the AC scoreboard + findings carried on-disk via `code-review.md` rather than transcript. Acceptable here because dispatches touch disjoint surfaces (D1 contract / D2 sql-orm-client rename / D3 resolver) and prior work is committed, so the "re-does committed work" failure mode doesn't bite. Worth surfacing upstream: the continuity rule should name on-disk-artifact carry as the first-class fallback, not just "long-lived chat."

## Pre-existing `fixtures:check` env failure

`pnpm fixtures:check` fails at `fixtures:emit` in this sandbox (CLI not on PATH / "Failed to load config" for sql-builder + sql-orm-client emit scripts) — pre-existing, not introduced (matches the TML-2729 gotcha). Additivity is verified instead via a direct golden git-diff (`git diff -- ':(glob)**/contract.json' …`); CI runs the real gate. Don't treat the local `fixtures:check` red as a dispatch failure.

**Correction (slice 3):** the canonical CLI emit **does** work in this sandbox — run it **from the repo root**: `node packages/1-framework/3-tooling/cli/dist/cli.js contract emit --config test/integration/test/sql-orm-client/fixtures/prisma-next.config.ts`, then `pnpm --filter @internal/sql-orm-client emit` (package-local copy + pgvector strip). The earlier "config-load failure" was from running with the wrong cwd (`test/integration`). **Prefer the canonical emit from root over a `tsx` bypass** — no golden-stability risk.

## PGlite/WASM JIT flakiness on broad integration runs

Running the whole sql-orm-client integration suite at once (`cd test/integration && pnpm test test/sql-orm-client/`) can crash with V8 `jit_page.has_value()` (WASM JIT) failures — **pre-existing PGlite/Node env flakiness**, reproduces on the parent branch, not introduced by M:N work. Targeted reruns (per-file, or the same suite again) pass cleanly. Verify integration blast radius with targeted per-file runs; don't trust a single broad-run red.

## Dispatch truncation recovery (no subagent resume)

A substantial dispatch can exhaust the implementer's budget mid-work and return a truncated report with **uncommitted WIP** (happened on the slice-1 read path). Recovery: inspect `git status`/`git diff`, then dispatch a fresh continuation implementer pointed at the WIP with a focused completion brief (it commits the WIP + completion as one commit). Keep dispatches tight and tell implementers to implement-then-test-then-gate rather than over-explore (over-exploration is what burned the budget).

**Recurrence (2×):** both the slice-1 read-path dispatch and the slice-2 filter dispatch (the "junction-correlation code + unit tests" judgment dispatches) truncated around 70–135k implementer tokens. The combination of (read corpus) + (design the SQL shape) + (write + iterate tests) reliably exceeds one sonnet budget here. The continue-from-WIP recovery works every time, but for future projects of this shape, consider splitting "implement the builder/accessor branch" and "write its unit tests" into two dispatches, or routing these to a higher-budget tier.
