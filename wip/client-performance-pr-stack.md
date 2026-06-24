# Prisma Client Performance PR Stack Plan

Date: 2026-06-24

This document tracks how the large performance branches are being exposed and split for review.

## Open Draft PRs

- Prisma status PR: https://github.com/prisma/prisma/pull/29655
- Engines status PR: https://github.com/prisma/prisma-engines/pull/5820
- Extracted engines PR 1: https://github.com/prisma/prisma-engines/pull/5821
- Extracted engines PR 2: https://github.com/prisma/prisma-engines/pull/5822

The status PRs are intentionally not merge-ready as final review units. They expose the full current state and CI wiring while smaller review branches are extracted.

## CI Link Commands

Prisma PR bodies can use:

```text
/engine-branch <prisma-engines-branch>
```

The Prisma workflow checks out that branch from `prisma/prisma-engines`, builds native engines plus Wasm packages, and blocks merge until the command is removed.

Engines PR bodies can use:

```text
/prisma-branch <prisma-branch>
```

The engines query-compiler test workflow uses that Prisma branch when building Prisma adapters/client code.

Engines integration publishing is separate. It is triggered by an `integration/` branch or a commit message containing `[integration]`.

## Current Split Status

### Extracted: Engines Quaint Insert-Select CTE

Draft PR: https://github.com/prisma/prisma-engines/pull/5821

Branch: `prisma-client-perf-quaint-insert-select`

Commits:

- `d59deb11278` / split commit `9b25ed3bd6c`: `perf(quaint): support postgres insert from selection`
- `29000399a8a` / split commit `f08af3d225e`: `perf(quaint): support insert common table expressions`

Scope:

- `quaint/src/visitor/postgres.rs`
- `quaint/src/ast.rs`
- `quaint/src/ast/cte.rs`
- `quaint/src/visitor.rs`
- related AST cleanup in query/select/union CTE handling

Validation:

- `cargo check -p quaint --no-default-features --features postgresql`: passed
- Focused `cargo test -p quaint ... test_insert_from_selection` and `test_insert_common_table_expression` failed before running tests because this local environment cannot resolve system OpenSSL for `openssl-sys` through Quaint dev/native dependencies.

This PR is safe to review independently. It is SQL-builder groundwork for future insert-select/count M:N connect work, but no current query-compiler commit in the large branch consumes it.

### Extracted: Engines Parser/Request Allocations

Draft PR: https://github.com/prisma/prisma-engines/pull/5822

Branch: `prisma-client-perf-parser-request-allocs`

Original commits:

- `aa0c044176d`: `Reduce query parser argument cloning`
- `8939dc3b333`: `Avoid input object schema map allocation`
- `b135e3d34b9`: `Avoid parsed argument value clone`
- `cc50b6120df`: `Avoid eager argument conversion errors`
- `ba4aa725900`: `Avoid empty exclusion vector allocation`
- `4352448ee00`: `Use mutable query parser paths`
- `a62504a80bd`: `Use SmallVec for parser validation paths`
- `e761557fa45`: `perf(request-handlers): collect selection exclusions inline`
- `a38dbd892f7`: `perf(query-compiler): consume singleton parsed values`

Scope:

- `query-compiler/core/src/query_document/parse_ast.rs`
- `query-compiler/core/src/query_document/parser.rs`
- `query-compiler/request-handlers/src/protocols/json/body.rs`
- `query-compiler/request-handlers/src/protocols/json/protocol_adapter.rs`

Validation:

- `cargo check -p query-core`: passed
- `cargo check -p request-handlers`: passed
- `cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/parser-request-target cargo test -p query-compiler --test queries`: passed

This PR is safe to review independently. It intentionally excludes compact query-plan format changes, raw-nested read plans, and write-graph pruning.

## Proposed Prisma Stack

1. `perf-stack/01-compact-query-plan-format`
   - Areas: `packages/client-engine-runtime/src/query-plan.ts`, interpreter/render/validation/data-mapper fixtures, `deserializeRawParameters`, `packages/query-plan-executor`.
   - Cut rule: squash to the final compact-only internal format. Do not expose temporary "accept compact plus retain legacy" history as a review boundary.

2. `perf-stack/02-clientengine-cache-and-precomputed-results`
   - Areas: `ClientEngine`, query-plan cache, `RequestHandler`, `applyModel`, engine interfaces, batch/precomputed cache-key tests.
   - Depends on the compact plan/runtime shape.

3. `perf-stack/03-raw-nested-runtime-execution`
   - Areas: `QueryInterpreter`, raw-nested data mapper/runtime tests, cache timing rows.
   - Unsafe cut: schedule-marker consumption must land only with the matching engines producer behavior.

4. `perf-stack/04-client-runtime-call-surface-fast-paths`
   - Areas: model/fluent proxies, JSON protocol serialization, `DataLoader`, `PrismaPromise`, callsite handling, edge plain model delegates.
   - Mostly independent of raw-nested execution, but should stay after cache/precomputed changes to reduce conflicts.

5. `perf-stack/05-exact-descriptor-helpers`
   - Areas: both JS/TS generators' exact descriptor registry builders, runtime exact descriptor registry, `applyModel`, generator tests, oracle tests.
   - Unsafe cut: generator emission and runtime registry must land together.

6. `perf-stack/06-generated-prepared-operations-and-evidence`
   - Areas: generated prepared operation registry, `getPrismaClient`, narrowed prepared request path, benchmark rows, final evidence docs.
   - Depends on cache/precomputed results and exact descriptor helpers.

## Proposed Engines Stack

1. `pcperf/00-quaint-insert-select-cte`
   - Extracted as https://github.com/prisma/prisma-engines/pull/5821.

2. `pcperf/01-parser-request-allocs`
   - Areas: query document parser, parse AST, request-handler JSON body/protocol adapter.
   - Mostly local allocation reductions.

3. `pcperf/02-compact-query-plan-format`
   - Areas: query builder serialized plan shapes, query-compiler expression/result/data mapper, `libs/prisma-value`, validation errors.
   - Must be coordinated with the matching Prisma runtime stack. These are lockstep internal formats, not compatibility additions.
   - 2026-06-24 packaging finding: the engines producer side mostly cherry-picks cleanly from fresh `origin/main` when the data-mapper prerequisites `babed274835` and `30a32a2c9f6` are inserted before `21a8db27dfd`. The broader validation-storage optimization `b64c854d6e2` conflicts with graph changes and should move to a later compiler-local/write-graph split unless a reviewer explicitly wants it in this PR.
   - 2026-06-24 packaging blocker: the matching Prisma consumer side is not a clean cherry-pick from `origin/main`. `dc8657d7f` (`Accept compact SQL string fragments`) conflicts in `render-query.ts` because it was authored on top of earlier render-query hot-path commits. The next attempt should either include the minimal render-query prerequisite chain in the compact consumer PR, or manually construct the final compact-only reader shape against current `origin/main` without carrying temporary compatibility history.

4. `pcperf/03-compiler-local-cleanups`
   - Areas: translation, data mapper, query graph, read graph builder, query structure.
   - Keep direct projected placeholder storage with downstream users.

5. `pcperf/04-raw-nested-read-plans`
   - Areas: raw-nested read expression/format/translation and snapshots.
   - Keep raw-nested preflight guarantees with result-map skipping.

6. `pcperf/05-write-graph-pruning`
   - Areas: nested write/update/upsert/set/connect graph-shape optimizations and snapshots.
   - Stack after raw-nested plan work to reduce snapshot conflicts.

7. `pcperf/06-raw-nested-relation-ops-final-owner`
   - Areas: raw-nested relation ops, M:N mapped operation remapping, one-to-many relation ops, final-owner schedule marker.
   - Must land with matching Prisma TS runtime support for relation ops and final-owner marker consumption.

## Packaging Rules

- Internal plan/protocol/runtime/generator formats are version-lockstep. Review and merge final shapes, not temporary old/new compatibility scaffolding.
- Use stacked draft PRs for visibility, but keep merge-ready PRs small enough that tests and review can understand one behavioral boundary at a time.
- Keep the full status PRs open until extracted stacks cover the accepted work and reviewers no longer need the monolithic context.
