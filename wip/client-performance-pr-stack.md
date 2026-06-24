# Prisma Client Performance PR Stack Plan

Date: 2026-06-24

This document tracks how the large performance branches are being exposed and split for review.

## Open Draft PRs

- Prisma status PR: https://github.com/prisma/prisma/pull/29655
- Engines status PR: https://github.com/prisma/prisma-engines/pull/5820
- Extracted engines PR 1: https://github.com/prisma/prisma-engines/pull/5821
- Extracted engines PR 2: https://github.com/prisma/prisma-engines/pull/5822
- Pushed engines split branches awaiting PR creation:
  - `prisma-client-perf-graph-translation-cleanups`
  - `prisma-client-perf-selection-aggregate-cleanups`
  - `prisma-client-perf-filter-extraction-cleanups`
  - `prisma-client-perf-read-selection-cleanups` stacked on `prisma-client-perf-selection-aggregate-cleanups`
  - `prisma-client-perf-translation-placeholder-cleanups` stacked on `prisma-client-perf-graph-translation-cleanups`
  - `prisma-client-perf-direct-placeholder-storage` stacked on `prisma-client-perf-translation-placeholder-cleanups`

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

Current auth note: `prisma-client-perf-graph-translation-cleanups`, `prisma-client-perf-selection-aggregate-cleanups`, `prisma-client-perf-filter-extraction-cleanups`, `prisma-client-perf-read-selection-cleanups`, `prisma-client-perf-translation-placeholder-cleanups`, and `prisma-client-perf-direct-placeholder-storage` are pushed to `prisma/prisma-engines`, but PR creation is blocked locally because both `gh` and the GitHub connector have expired tokens after the harness restart. Create them from the URLs in this section or rerun `gh auth refresh -h github.com -s repo`, then use the PR body linkage from each status entry.

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

### Ready To Open: Engines Graph/Translation Cleanups

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-graph-translation-cleanups

Branch: `prisma-client-perf-graph-translation-cleanups`

Original commits:

- `c3fe406576f`: `Reuse incoming query graph edges during translation`
- `5d015d902b2`: `Avoid root node vector for single-root translation`
- `af75c51ccd6`: `Avoid redundant single result scope binding`
- `63ac52cb5bf`: `perf(query-compiler): cache result reachability during translation`
- `fd443cdf449`: `perf(query-compiler): avoid synthetic read query names`
- `202f7b09aaa`: `perf(query-compiler): reuse dependency reload candidates`
- `a30ce85177f`: `perf(query-compiler): avoid cloning incoming if edges`
- `ada2906dea3`: `Avoid intermediate dependency node id strings`

Scope:

- `query-compiler/core/src/query_graph/mod.rs`
- `query-compiler/core/src/query_graph_builder/write/utils.rs`
- `query-compiler/query-compiler/src/binding.rs`
- `query-compiler/query-compiler/src/translate.rs`

Validation:

- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/graph-translation-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/graph-translation-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/graph-translation-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is safe to review independently from the compact query-plan stack. It deliberately skips `FieldSelection::into_virtuals_last()` and projected dependency edge-iteration follow-ups that conflicted with other larger graph/data-mapper history and should be extracted in a later compiler-local PR if still desired.

### Ready To Open: Engines Translation/Dependency Cleanups

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-translation-placeholder-cleanups

Branch: `prisma-client-perf-translation-placeholder-cleanups`

Intended base branch: `prisma-client-perf-graph-translation-cleanups`

Original commits:

- `5651e93c3a4`: `Avoid result scope binding name allocations`
- `b2377d67f39`: `Reserve query graph visited capacity`
- `02404611763`: `Skip identity dependency bindings`
- `38e7af1c9ac`: `Avoid dependency union vector allocation`
- `179cdcbbbf1`: `perf(query-compiler): iterate projected dependency edges`

Fresh-base split commits:

- `8af112f14d0`: `Avoid result scope binding name allocations`
- `29b77b127ce`: `Reserve query graph visited capacity`
- `8c5b5520818`: `Skip identity dependency bindings`
- `66bc1808fbf`: `Avoid dependency union vector allocation`
- `23521a518ab`: `perf(query-compiler): iterate projected dependency edges`

Scope relative to `prisma-client-perf-graph-translation-cleanups`:

- `query-compiler/core/src/query_graph/mod.rs`
- `query-compiler/query-compiler/src/translate.rs`
- `query-compiler/query-structure/src/field_selection.rs`

Validation:

- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/translation-placeholder-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/translation-placeholder-target cargo check -p query-structure`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/translation-placeholder-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/translation-placeholder-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is intentionally stacked on the graph/translation branch. It excludes `fd906df5c3d` (`Store projected placeholders directly`) because that commit changes write builders, selection plumbing, and translation together; extract it separately as a broader write/placeholder branch.

### Ready To Open: Engines Direct Placeholder Storage

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-direct-placeholder-storage

Branch: `prisma-client-perf-direct-placeholder-storage`

Intended base branch: `prisma-client-perf-translation-placeholder-cleanups`

Original commits:

- `ffe098e7dbc`: `Avoid singleton parsed input vec allocation`
- `dd196d58292`: `Reuse child link for connect-or-create existence checks`
- `fd906df5c3d`: `Store projected placeholders directly`

Fresh-base split commits:

- `660f6c10d3a`: `Avoid singleton parsed input vec allocation`
- `305bd75a4f8`: `Reuse child link for connect-or-create existence checks`
- `7a4036be871`: `Store projected placeholders directly`

Scope relative to `prisma-client-perf-translation-placeholder-cleanups`:

- `query-compiler/core/src/query_graph/mod.rs`
- `query-compiler/core/src/query_graph_builder/inputs.rs`
- `query-compiler/core/src/query_graph_builder/write/create.rs`
- nested write builder carrier sites under `query-compiler/core/src/query_graph_builder/write/nested/`
- `query-compiler/core/src/query_graph_builder/write/utils.rs`
- `query-compiler/query-compiler/src/selection.rs`
- `query-compiler/query-compiler/src/translate.rs`

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/direct-placeholder-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/direct-placeholder-target cargo check -p query-structure`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/direct-placeholder-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/direct-placeholder-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is intentionally stacked on the translation/dependency cleanup branch. It keeps `fd906df5c3d` focused on storing projected `Placeholder`s directly in `Flow` and `Diff` nodes, while splitting two real prerequisites into explicit review commits. It deliberately excludes separate write-pruning and branch-joining history such as nested-only update/upsert shortcuts, no-op upsert updates, empty nested set specialization, and M:N connect-or-create branch joining.

### Ready To Open: Engines Selection/Aggregate Cleanups

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-selection-aggregate-cleanups

Branch: `prisma-client-perf-selection-aggregate-cleanups`

Original commits:

- `6b97cbc7d5f`: `perf(query-compiler): reduce virtual field selection allocations`
- `37b0b015f9c`: `perf(query-compiler): stream aggregate result mappings`

Fresh-base split commits:

- `a4a408bff94`: `perf(query-compiler): reduce virtual field selection allocations`
- `0e0c93fb233`: `perf(query-compiler): stream aggregate result mappings`

Scope:

- `query-compiler/query-structure/src/field_selection.rs`
- `query-compiler/query-compiler/src/data_mapper.rs`

Validation:

- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/selection-aggregate-target cargo check -p query-structure`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/selection-aggregate-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/selection-aggregate-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is safe to review independently. It deliberately excludes `f84cdb2c3c8` (`perf(query-compiler): avoid compound selector materialization`) because on fresh `origin/main` that commit depends on an earlier unique-filter fast path not present in this split. Extract that compound-selector cleanup separately with the real prerequisite chain.

### Ready To Open: Engines Read Selection Cleanups

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-read-selection-cleanups

Branch: `prisma-client-perf-read-selection-cleanups`

Intended base branch: `prisma-client-perf-selection-aggregate-cleanups`

Original commits:

- `cc32799cdf5`: `Skip empty nested relation selection merge`
- `b7d4eecbca1`: `Avoid extra linking field iterator allocation`
- `176fd2515b8`: `Pre-size selected field extraction`
- `d87e1ef9d8a`: `Avoid read field selection reallocations`
- `677a3d44b68`: `Avoid single filter wrapper in read translation`
- `87c6a6f6df0`: `Fast-path contained field selection merges`

Fresh-base split commits:

- `2b2e92f1b38`: `Skip empty nested relation selection merge`
- `11e7d22fe8a`: `Avoid extra linking field iterator allocation`
- `a7053b8eb09`: `Pre-size selected field extraction`
- `2b01a86b3e2`: `Avoid read field selection reallocations`
- `71675a32c87`: `Avoid single filter wrapper in read translation`
- `6aa2088797c`: `Fast-path contained field selection merges`

Scope relative to `prisma-client-perf-selection-aggregate-cleanups`:

- `query-compiler/core/src/query_graph_builder/read/utils.rs`
- `query-compiler/query-compiler/src/translate/query/read.rs`
- `query-compiler/query-structure/src/field_selection.rs`

Validation:

- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/read-selection-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/read-selection-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/read-selection-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is intentionally stacked on the selection/aggregate branch because both touch `FieldSelection::into_virtuals_last()`. The conflict resolution keeps the newer count-based virtual-field ordering implementation from the base and adds the consuming `into_without_relations()` read-path optimization.

### Ready To Open: Engines Filter Extraction Cleanups

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-filter-extraction-cleanups

Branch: `prisma-client-perf-filter-extraction-cleanups`

Original commits:

- `9b42bd6e3d9`: `Optimize unique filter extraction`
- `395aad1e7d3`: `Pre-size search filter folding output`
- `69faaa96948`: `perf(query-compiler): skip search merge for no-search groups`
- `f84cdb2c3c8`: `perf(query-compiler): avoid compound selector materialization`

Fresh-base split commits:

- `426e0e126ab`: `Optimize unique filter extraction`
- `c595dc05dc4`: `Pre-size search filter folding output`
- `ee55ba2071f`: `perf(query-compiler): skip search merge for no-search groups`
- `ad9dd1158f0`: `perf(query-compiler): avoid compound selector materialization`

Scope:

- `query-compiler/core/src/query_document/mod.rs`
- `query-compiler/core/src/query_graph_builder/extractors/filters/mod.rs`
- `query-compiler/core/src/query_graph_builder/extractors/mod.rs`
- `query-compiler/core/src/query_graph_builder/extractors/utils.rs`
- `query-compiler/core/src/query_graph_builder/write/upsert.rs`
- query-compiler query fixtures/snapshots for the changed filter extraction shape

Validation:

- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/filter-extraction-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/filter-extraction-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/filter-extraction-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is safe to review independently from the parser/request and selection/aggregate splits. It contains the real prerequisite chain for the compound-selector cleanup instead of smuggling `f84cdb2c3c8` into the selection/aggregate PR.

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
   - Current extracted subset: `prisma-client-perf-graph-translation-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current extracted subset: `prisma-client-perf-selection-aggregate-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current extracted subset: `prisma-client-perf-filter-extraction-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-read-selection-cleanups` on `prisma-client-perf-selection-aggregate-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-translation-placeholder-cleanups` on `prisma-client-perf-graph-translation-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-direct-placeholder-storage` on `prisma-client-perf-translation-placeholder-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.

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
