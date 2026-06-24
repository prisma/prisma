# Prisma Client Performance PR Stack Plan

Date: 2026-06-24

This document tracks how the large performance branches are being exposed and split for review.

## Open Draft PRs

- Prisma status PR: https://github.com/prisma/prisma/pull/29655
- Engines status PR: https://github.com/prisma/prisma-engines/pull/5820
- Extracted engines PR 1: https://github.com/prisma/prisma-engines/pull/5821
- Extracted engines PR 2: https://github.com/prisma/prisma-engines/pull/5822
- Pushed Prisma split branches awaiting PR creation:
  - `prisma-client-perf-render-datamapper-prereqs`
- Pushed engines split branches awaiting PR creation:
  - `prisma-client-perf-compact-plan-format-engines`
  - `prisma-client-perf-graph-translation-cleanups`
  - `prisma-client-perf-selection-aggregate-cleanups`
  - `prisma-client-perf-filter-extraction-cleanups`
  - `prisma-client-perf-read-selection-cleanups` stacked on `prisma-client-perf-selection-aggregate-cleanups`
  - `prisma-client-perf-translation-placeholder-cleanups` stacked on `prisma-client-perf-graph-translation-cleanups`
  - `prisma-client-perf-direct-placeholder-storage` stacked on `prisma-client-perf-translation-placeholder-cleanups`
  - `prisma-client-perf-m2m-set-disconnect-pruning` stacked on `prisma-client-perf-direct-placeholder-storage`
  - `prisma-client-perf-required-set-pruning` stacked on `prisma-client-perf-m2m-set-disconnect-pruning`
  - `prisma-client-perf-empty-required-set-pruning` stacked on `prisma-client-perf-required-set-pruning`
  - `prisma-client-perf-coc-branch-pruning` stacked on `prisma-client-perf-empty-required-set-pruning`
  - `prisma-client-perf-update-upsert-pruning` stacked on `prisma-client-perf-coc-branch-pruning`
  - `prisma-client-perf-upsert-result-sharing` stacked on `prisma-client-perf-update-upsert-pruning`

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

Workflow sources checked:

- `prisma/.github/workflows/build-engine-branch.yml` parses `/engine-branch` and checks out `prisma/prisma-engines`.
- `prisma/.github/workflows/test.yml` blocks merge while a custom engine branch is present.
- `prisma-engines/.github/workflows/select-prisma-branch.yml` parses `/prisma-branch`.
- `prisma-engines/.github/workflows/test-query-compiler-template.yml` consumes the selected Prisma branch for query-compiler Wasm tests.
- `prisma-engines/.github/workflows/build-engines.yml` gates integration publishing on `integration/*` branches or `[integration]` commit messages.

Current auth note: `prisma-client-perf-graph-translation-cleanups`, `prisma-client-perf-selection-aggregate-cleanups`, `prisma-client-perf-filter-extraction-cleanups`, `prisma-client-perf-read-selection-cleanups`, `prisma-client-perf-translation-placeholder-cleanups`, `prisma-client-perf-direct-placeholder-storage`, `prisma-client-perf-m2m-set-disconnect-pruning`, `prisma-client-perf-required-set-pruning`, `prisma-client-perf-empty-required-set-pruning`, `prisma-client-perf-coc-branch-pruning`, `prisma-client-perf-update-upsert-pruning`, and `prisma-client-perf-upsert-result-sharing` are pushed to `prisma/prisma-engines`, but PR creation is blocked locally because both `gh` and the GitHub connector have expired tokens after the harness restart. Create them from the URLs in this section or rerun `gh auth refresh -h github.com -s repo`, then use the PR body linkage from each status entry.

Fresh auth check after pushing `prisma-client-perf-upsert-result-sharing`: `gh auth status` still reports the local token as invalid. The latest GitHub connector `create_pull_request` attempt, for `prisma-client-perf-update-upsert-pruning`, failed with HTTP 401 `token_expired`.

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

### Ready To Open: Engines Compact Query-Plan Producer Format

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-compact-plan-format-engines

Branch: `prisma-client-perf-compact-plan-format-engines`

Base branch: `main`

Original commit families:

- compact query arg/result field omissions: `78dfd45e838`, `1fe6a7c341b`, `af7c591f3c6`, `04fdc54214a`
- compact query-plan producer shapes: `dd03ee258c9`, `95d2ee44e6c`, `6fcc107bb5c`, `ccaea7b4735`, `fe2a4796eaf`, `8da0a53dd83`, `16f5dc6901d`, `96eac0718c7`, `b021a14b2c4`, `4dc9111d4cd`, `4debcd05b97`, `9c98a943d71`, `da6c7014b90`, `ba182dbb290`, `ed7f1d14680`, `1725c633cab`, `432c9db6c0b`, `13276664d8e`, `580547bbd28`
- result object vector-storage prerequisites/final shape: `babed274835`, `30a32a2c9f6`, `21a8db27dfd`

Scope:

- `libs/prisma-value/src/lib.rs`
- `query-compiler/query-builders/query-builder/src/lib.rs`
- `query-compiler/query-compiler/src/expression.rs`
- `query-compiler/query-compiler/src/result_node.rs`
- `query-compiler/query-compiler/src/data_mapper.rs`
- `query-compiler/core/src/query_graph/mod.rs`
- `query-compiler/query-structure/src/field_selection.rs`

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/compact-plan-engines-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/compact-plan-engines-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/compact-plan-engines-target cargo test -p query-compiler --test queries`: passed

Suggested temporary PR body linkage, until the matching compact Prisma consumer split exists:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is the producer half of the lockstep compact internal format. It should not be merged without a matching Prisma consumer PR that reads the same compact-only shape. It deliberately excludes `b64c854d6e2` (`perf(query-compiler): compact validation expectations`), because that is a broader validation-storage rewrite and is not required for the serialized compact plan producer shape.

### Ready To Open: Prisma Render/Data-Mapper Prerequisites

PR creation URL: https://github.com/prisma/prisma/pull/new/prisma-client-perf-render-datamapper-prereqs

Branch: `prisma-client-perf-render-datamapper-prereqs`

Base branch: `main`

Original commits:

- `912149063`: fast path static template SQL rendering, adapted with only the needed `evaluateArgs()` helper instead of broad `cc5452bb4`.
- `c6b31b6a8`: cache flat template SQL rendering.
- `783ee5b2b`: render tuple placeholders without map joins.
- `fefa8a47b`: inline non-flat SQL template rendering; old `AGENTS.md` note dropped from the split branch.
- `cc7f692dd`: inline SQL template chunk planning.
- `48e0b6fbd`: skip chunk rebuild within parameter limit.
- `e95ad9753`: map simple query results directly, adapted to current main's `cloneObject()` semantics instead of the later no-clone `asMutable()` helper.
- `ec3857e9d`: reuse direct mapper field entries.
- `157c537fc`: cache direct result field mappings.
- `035eb8685`: cache result mappings by column shape.

Scope:

- `packages/client-engine-runtime/src/interpreter/render-query.ts`
- `packages/client-engine-runtime/src/interpreter/data-mapper.ts`
- `packages/client-engine-runtime/src/interpreter/query-interpreter.ts`
- `packages/client-engine-runtime/src/interpreter/data-mapper.test.ts`
- `AGENTS.md`

Validation:

- `pnpm install --offline --ignore-scripts`: passed after plain `pnpm install --offline` failed on local `better-sqlite3` rebuild because the container lacks `g++`.
- `pnpm --filter @prisma/client-engine-runtime... build`: passed under unsandboxed execution; sandboxed run failed because `tsx` could not create IPC pipes under `/tmp`.
- `pnpm --filter @prisma/client-engine-runtime exec vitest run src/interpreter/data-mapper.test.ts src/interpreter/render-query.test.ts`: passed, 17 tests.
- `pnpm --filter @prisma/client-engine-runtime test`: passed, 205 tests.

PR body linkage:

- No `/engine-branch` command required. This branch is Prisma-only and is intended as the base for the compact consumer split.

This branch should be reviewed before the compact Prisma consumer branch. It isolates render-query and direct result-set data-mapper prerequisites so the compact-format PR does not hide unrelated runtime scaffolding inside conflict resolutions.

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

### Ready To Open: Engines M:N Set/Disconnect Pruning

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-m2m-set-disconnect-pruning

Branch: `prisma-client-perf-m2m-set-disconnect-pruning`

Intended base branch: `prisma-client-perf-direct-placeholder-storage`

Original commits:

- `d2fa2a3bf53`: `perf(query-compiler): skip m2m disconnect child read`
- `45947adb1f5`: `perf(query-compiler): skip m2m set empty child read`
- `6a92e4ddeeb`: `perf(query-compiler): skip m2m set child read`

Fresh-base split commits:

- `0216f7e0e96`: `perf(query-compiler): skip m2m disconnect child read`
- `dfcf320477d`: `perf(query-compiler): skip m2m set empty child read`
- `be5b268b039`: `perf(query-compiler): skip m2m set child read`
- `096a111c583`: `perf(query-compiler): add m2m pruning support helpers`
- `745b8606b50`: `test(query-compiler): refresh m2m set pruning snapshots`

Scope relative to `prisma-client-perf-direct-placeholder-storage`:

- `query-compiler/core/src/query_ast/write.rs`
- `query-compiler/core/src/query_graph_builder/inputs.rs`
- `query-compiler/core/src/query_graph_builder/write/disconnect.rs`
- `query-compiler/core/src/query_graph_builder/write/nested/disconnect_nested.rs`
- `query-compiler/core/src/query_graph_builder/write/nested/set_nested.rs`
- `query-compiler/query-builders/query-builder/src/lib.rs`
- `query-compiler/query-builders/sql-query-builder/src/lib.rs`
- `query-compiler/query-builders/sql-query-builder/src/write.rs`
- `query-compiler/query-structure/src/model.rs`
- `query-compiler/query-compiler/src/data_mapper.rs`
- `query-compiler/query-compiler/src/translate/query/write.rs`
- query fixtures/snapshots for `update-m2m-disconnect`, `update-m2m-set-empty`, and `update-m2m-set`

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/m2m-set-disconnect-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/m2m-set-disconnect-target cargo check -p query-structure`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/m2m-set-disconnect-target cargo check -p query-builder`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/m2m-set-disconnect-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/m2m-set-disconnect-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch removes child-read phases for narrow M:N disconnect and set shapes, using direct relation-table deletes plus existing connect validation for non-empty set. It is intentionally stacked before the raw-nested read-plan split, so the new `update-m2m-set*` snapshots use the current join-based final read shape rather than the monolithic branch's later raw-nested final read.

### Ready To Open: Engines Required Set Pruning

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-required-set-pruning

Branch: `prisma-client-perf-required-set-pruning`

Intended base branch: `prisma-client-perf-m2m-set-disconnect-pruning`

Original commit:

- `102c8fb35ae`: `perf(query-compiler): own required nested set phase`

Fresh-base split commit:

- `335dbb0b181`: `perf(query-compiler): own required nested set phase`

Scope relative to `prisma-client-perf-m2m-set-disconnect-pruning`:

- `query-compiler/core/src/query_graph/formatters.rs`
- `query-compiler/core/src/query_graph/mod.rs`
- `query-compiler/core/src/query_graph_builder/inputs.rs`
- `query-compiler/core/src/query_graph_builder/write/nested/set_nested.rs`
- `query-compiler/query-compiler/src/translate.rs`
- `query-compiler/query-compiler/tests/snapshots/queries__queries@update-set-nested.json.snap`

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/required-set-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/required-set-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/required-set-target cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch adds the specialized required one-to-many set computation for the non-empty narrow scalar-link shape. It deliberately excludes the older empty one-to-many `set` specialization from `d3d45546416` and the later required-set empty-disconnect validation branch from `a87f6ccff37`; those should be extracted separately if still desired.

### Ready To Open: Engines Empty/Required Set Pruning

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-empty-required-set-pruning

Branch: `prisma-client-perf-empty-required-set-pruning`

Intended base branch: `prisma-client-perf-required-set-pruning`

Original commits:

- `d3d45546416`: `perf(query-compiler): specialize empty nested set`
- `a87f6ccff37`: `perf(query-compiler): skip required set disconnect updates`

Fresh-base split commits:

- `8e8b898b9c0`: `perf(query-compiler): specialize empty nested set`
- `cb760e921b8`: `perf(query-compiler): skip required set disconnect updates`

Scope relative to `prisma-client-perf-required-set-pruning`:

- `query-compiler/core/src/query_graph_builder/write/nested/set_nested.rs`
- `query-compiler/query-compiler/tests/data/update-set-nested-empty.json`
- `query-compiler/query-compiler/tests/snapshots/queries__queries@update-set-nested-empty.json.snap`
- `query-compiler/query-compiler/tests/snapshots/queries__queries@update-set-nested.json.snap`

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/empty-required-set-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/empty-required-set-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/empty-required-set-target INSTA_UPDATE=always cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch adds the empty one-to-many `set` fast path and skips pointless disconnect updates for required child sides by validating the would-be disconnected rows instead. The snapshot refresh is intentionally based on the current stacked branch before raw-nested read-plan work, so `update-set-nested-empty` uses the join-shaped final read rather than the monolithic branch's later raw-nested final read.

### Ready To Open: Engines Connect-Or-Create Branch Pruning

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-coc-branch-pruning

Branch: `prisma-client-perf-coc-branch-pruning`

Intended base branch: `prisma-client-perf-empty-required-set-pruning`

Original commits:

- `9b870cf327e`: `perf(query-compiler): join m2m connect-or-create branches`
- `0f03048514c`: `perf(query-compiler): skip create branch return forwarding`
- `e14835e605e`: `perf(query-compiler): return if condition rows directly`

Fresh-base split commits:

- `15b27b88668`: `perf(query-compiler): join m2m connect-or-create branches`
- `fd3c93d0ede`: `perf(query-compiler): skip create branch return forwarding`
- `9a426d2ac1e`: `perf(query-compiler): return if condition rows directly`

Scope relative to `prisma-client-perf-empty-required-set-pruning`:

- `query-compiler/core/src/query_graph/mod.rs`
- `query-compiler/core/src/query_graph_builder/write/nested/connect_or_create_nested.rs`
- `query-compiler/query-compiler/src/translate.rs`
- `query-compiler/query-compiler/tests/snapshots/queries__queries@create-nested-connectOrCreate-mixed.json.snap`
- `query-compiler/query-compiler/tests/snapshots/queries__queries@create-nested-connectOrCreate-one2m.json.snap`

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/coc-branch-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/coc-branch-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/coc-branch-target INSTA_UPDATE=always cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch collapses the duplicated M:N connect-or-create connect branches and removes intermediate return-forwarding nodes where the condition result can be returned directly. During fresh-base adaptation, the first commit was updated to the current direct-placeholder internal format (`Flow::Return(None)` plus `RowSink::ProjectedPlaceholder`) rather than reintroducing the older vector-return shape.

### Ready To Open: Engines Update/Upsert Pruning

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-update-upsert-pruning

Branch: `prisma-client-perf-update-upsert-pruning`

Intended base branch: `prisma-client-perf-coc-branch-pruning`

Original commits:

- `6f256b26dfd`: `perf(query-compiler): skip nested-only update nodes`
- `34bde27cfb5`: `perf(query-compiler): skip nested-only upsert update nodes`
- `a3ee45d7d44`: `perf(query-compiler): skip noop upsert updates`

Fresh-base split commits:

- `23d89d56c15`: `perf(query-compiler): skip nested-only update nodes`
- `b99ebaa5bbd`: `perf(query-compiler): skip nested-only upsert update nodes`
- `50ba2fd334f`: `perf(query-compiler): skip noop upsert updates`
- `768be77a38e`: `test(query-compiler): refresh update upsert pruning snapshots`

Scope relative to `prisma-client-perf-coc-branch-pruning`:

- `query-compiler/core/src/query_graph_builder/write/nested/update_nested.rs`
- `query-compiler/core/src/query_graph_builder/write/nested/upsert_nested.rs`
- `query-compiler/core/src/query_graph_builder/write/update.rs`
- `query-compiler/core/src/query_graph_builder/write/upsert.rs`
- `query-compiler/query-compiler/tests/data/nested-upsert-nested-only.json`
- `query-compiler/query-compiler/tests/data/upsert-empty-update.json`
- `query-compiler/query-compiler/tests/data/upsert-nested-only-update.json`
- snapshots for the new update/upsert fixtures and `update-set-nested-prisma#27650`

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/update-upsert-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/update-upsert-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/update-upsert-target INSTA_UPDATE=always cargo test -p query-compiler --test queries`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch removes connector update nodes when the update payload only exists to drive nested writes, for nested update, nested upsert, and top-level upsert. The extra refresh commit adapts the original commits to the current direct-placeholder `Flow::Return(None)` representation and refreshes the new fixture snapshots against this stack's pre-raw-nested final-read shape.

### Ready To Open: Engines Upsert Result Sharing

PR creation URL: https://github.com/prisma/prisma-engines/pull/new/prisma-client-perf-upsert-result-sharing

Branch: `prisma-client-perf-upsert-result-sharing`

Intended base branch: `prisma-client-perf-update-upsert-pruning`

Original commits:

- `6ad7f3a9b1c`: `perf(query-compiler): narrow empty update carrier projection`
- `09374a92e87`: `perf(query-compiler): join shared nested upsert m2m connect`
- `bd002ef8ac0`: `perf(query-compiler): return nested upsert shared connect condition`
- `d49c30d27b1`: `perf(query-compiler): share empty upsert result read`
- `d89ebbdb461`: `perf(query-compiler): share nested-only upsert result read`

Fresh-base split commits:

- `d1fc6e9fb6a`: `perf(query-compiler): narrow empty update carrier projection`
- `edc04839bb5`: `perf(query-compiler): join shared nested upsert m2m connect`
- `b9c9b81191e`: `perf(query-compiler): return nested upsert shared connect condition`
- `7d03e6550d2`: `perf(query-compiler): share empty upsert result read`
- `dcb9d62da7b`: `perf(query-compiler): share nested-only upsert result read`
- `d19e56f3084`: `test(query-compiler): refresh upsert result sharing snapshots`

Scope relative to `prisma-client-perf-update-upsert-pruning`:

- `query-compiler/core/src/query_graph/formatters.rs`
- `query-compiler/core/src/query_graph/mod.rs`
- `query-compiler/core/src/query_graph_builder/inputs.rs`
- `query-compiler/core/src/query_graph_builder/write/nested/upsert_nested.rs`
- `query-compiler/core/src/query_graph_builder/write/update.rs`
- `query-compiler/core/src/query_graph_builder/write/upsert.rs`
- `query-compiler/query-compiler/src/translate.rs`
- snapshots for nested upsert, update carrier, and upsert shared-read fixtures

Validation:

- `cargo fmt --check`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/upsert-result-target cargo check -p query-core`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/upsert-result-target cargo check -p query-compiler`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/upsert-result-target INSTA_UPDATE=always cargo test -p query-compiler --test queries`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/upsert-result-target cargo test -p query-compiler --test queries`: passed
- `CARGO_TARGET_DIR=/home/aqrln.guest/prisma/.tmp/upsert-result-target cargo test -p query-core --lib`: passed

Suggested PR body linkage:

```text
/prisma-branch prisma-client-performance-2026-06-08
```

This branch is intentionally stacked after update/upsert pruning. It adds the shared nested-upsert M:N connect prerequisite that the result-sharing commits depend on, narrows empty update carriers to id-only projections, returns shared-connect-only nested-upsert conditions directly, and shares top-level upsert final reads for the proved empty/nested-only shapes. It keeps the guard narrow for nested-only upsert result sharing: create branches must stay non-nested, and update branches with multiple nested operations still need separate proof.

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
   - Current prerequisite split: `prisma-client-perf-render-datamapper-prereqs`, pushed and validated, pending PR creation after GitHub auth refresh. Stack the compact consumer branch on this instead of hiding render/data-mapper prerequisites in compact-format conflict resolutions.

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
   - Current producer-side split: `prisma-client-perf-compact-plan-format-engines`, pushed and validated, pending PR creation after GitHub auth refresh. It excludes `b64c854d6e2` by design.
   - 2026-06-24 packaging finding: the engines producer side mostly cherry-picks cleanly from fresh `origin/main` when the data-mapper prerequisites `babed274835` and `30a32a2c9f6` are inserted before `21a8db27dfd`. The broader validation-storage optimization `b64c854d6e2` conflicts with graph changes and should move to a later compiler-local/write-graph split unless a reviewer explicitly wants it in this PR.
   - 2026-06-24 packaging blocker: the matching Prisma consumer side is not a clean cherry-pick from `origin/main`. `dc8657d7f` (`Accept compact SQL string fragments`) conflicts in `render-query.ts` because it was authored on top of earlier render-query hot-path commits. The next attempt should either include the minimal render-query prerequisite chain in the compact consumer PR, or manually construct the final compact-only reader shape against current `origin/main` without carrying temporary compatibility history.
   - 2026-06-24 follow-up consumer attempt: the minimal render-query prerequisite chain can be replayed through `dc8657d7f` with narrow conflict resolutions, but `eb652f538` (`Allow omitted result field db names`) then conflicts because the compact data-mapper commits were authored on top of the direct result-set mapping prerequisite series (`e95ad9753`, `ec3857e9d`, `157c537fc`, `035eb8685`). Do not smuggle that series into a compact-format conflict resolution. Either extract those render/data-mapper prerequisites as a separate Prisma branch first, or hand-build the final compact-only consumer shape against current `origin/main`.

4. `pcperf/03-compiler-local-cleanups`
   - Areas: translation, data mapper, query graph, read graph builder, query structure.
   - Keep direct projected placeholder storage with downstream users.
   - Current extracted subset: `prisma-client-perf-graph-translation-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current extracted subset: `prisma-client-perf-selection-aggregate-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current extracted subset: `prisma-client-perf-filter-extraction-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-read-selection-cleanups` on `prisma-client-perf-selection-aggregate-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-translation-placeholder-cleanups` on `prisma-client-perf-graph-translation-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-direct-placeholder-storage` on `prisma-client-perf-translation-placeholder-cleanups`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-m2m-set-disconnect-pruning` on `prisma-client-perf-direct-placeholder-storage`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-required-set-pruning` on `prisma-client-perf-m2m-set-disconnect-pruning`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-empty-required-set-pruning` on `prisma-client-perf-required-set-pruning`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-coc-branch-pruning` on `prisma-client-perf-empty-required-set-pruning`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-update-upsert-pruning` on `prisma-client-perf-coc-branch-pruning`, pushed and validated, pending PR creation after GitHub auth refresh.
   - Current stacked subset: `prisma-client-perf-upsert-result-sharing` on `prisma-client-perf-update-upsert-pruning`, pushed and validated, pending PR creation after GitHub auth refresh.

5. `pcperf/04-raw-nested-read-plans`
   - Areas: raw-nested read expression/format/translation and snapshots.
   - Keep raw-nested preflight guarantees with result-map skipping.
   - 2026-06-24 packaging finding: do not try to stack this directly on `prisma-client-perf-upsert-result-sharing`. Cherry-picking `ca6d0202616` (`Emit raw nested read plans`) onto that base immediately conflicts in `query-compiler/query-compiler/src/expression.rs` because the commit assumes compact expression / tuple serialization from the compact query-plan stack. Extract `pcperf/02-compact-query-plan-format` first, then retry raw-nested read plans on that base.
   - 2026-06-24 WIP worktree audit: `wip/prisma-engines-raw-nested-m2m-ops` is clean at old producer commit `a018a977265`, contained in `origin/prisma-client-performance-2026-06-08-engines`, and has no upstream. `wip/prisma-client-raw-nested-m2m-ops` is clean but stale at docs commit `b4fb293ac`, also contained in the pushed Prisma status branch; the matching runtime support is later at `bf8e827fc`, not at the WIP tip.

6. `pcperf/05-write-graph-pruning`
   - Areas: nested write/update/upsert/set/connect graph-shape optimizations and snapshots.
   - Stack after raw-nested plan work to reduce snapshot conflicts.

7. `pcperf/06-raw-nested-relation-ops-final-owner`
   - Areas: raw-nested relation ops, M:N mapped operation remapping, one-to-many relation ops, final-owner schedule marker.
   - Must land with matching Prisma TS runtime support for relation ops and final-owner marker consumption.
   - The first M:N relation-ops producer commit `a018a977265` is not a valid next branch until raw-nested read plans are extracted: direct cherry-pick onto `prisma-client-perf-upsert-result-sharing` conflicts in `translate/query/read.rs` because the raw-nested read root/protocol helpers are absent. It also leaves mapped cursor/distinct fields on fallback until follow-up `0d2d3ad1547`.

## Packaging Rules

- Internal plan/protocol/runtime/generator formats are version-lockstep. Review and merge final shapes, not temporary old/new compatibility scaffolding.
- Use stacked draft PRs for visibility, but keep merge-ready PRs small enough that tests and review can understand one behavioral boundary at a time.
- Keep the full status PRs open until extracted stacks cover the accepted work and reviewers no longer need the monolithic context.
