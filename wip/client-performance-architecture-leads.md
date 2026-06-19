# Prisma Client Performance Architecture Leads

Date: 2026-06-12

This note captures the larger leads that should survive harness restarts and context compactions. It complements `wip/client-performance-journal.md`, which remains the chronological source of benchmark evidence.

## JS-Owned Query Input / Rust-Owned IR

### Practicality

The radical JS-owned query idea is potentially practical, but only if it removes whole phases together. It is not worth pursuing as another boundary conversion patch.

The current path is:

1. Generated/public JS builds user args.
2. `serializeJsonQuery()` creates a JSON-protocol object.
3. `parameterizeQuery()` walks that object on the JS heap.
4. `JSON.stringify(parameterizedQuery.query)` builds the cache key and request string.
5. Wasm receives a string, parses into owned Rust `JsonBody` / `serde_json::Value` maps.
6. Rust validates/adapts into owned `Operation` / `Selection` / `ArgumentValue`.
7. Rust compiles owned IR and serializes a query plan back to JS-owned runtime structures.

`serde_wasm_bindgen::from_value(request)` only skips part of step 5. The release-Wasm `compileFromValue(JsValue)` spike was neutral to slower because it still built the same owned Rust maps before validation and compilation.

The 2026-06-18 Rust/Wasm scout rechecked the current code and found no active `compileFromValue` / `compileSerdeWasmBindgen` request entrypoint. A shallow `from_value()` entrypoint would still produce owned `JsonBody`, `IndexMap<String, serde_json::Value>`, `Operation`, `Selection`, and `ArgumentValue` structures before graph build. It also would not remove today's JS `JSON.stringify(parameterizedQuery.query)` cache-key path. That makes it the same rejected class of change as the earlier release-Wasm sidecar unless the request parser itself becomes JS-value-backed or borrowed. The 2026-06-19 singleton parser success-path cleanup is useful but deliberately smaller: it consumes already-owned `ArgumentValue` payloads only after the current protocol adapter has produced them.

The useful target is either:

- avoid Wasm entirely on hot cache hits, or
- let Rust inspect JS-owned input through a representation that does not pay dynamic `Reflect` walking and does not materialize Rust-owned protocol maps before it knows the request is a cache miss.

### Recommended Wedge

Start with cache hits, not compile misses.

1. Keep compile misses on the current string/Rust-owned path.
2. For generated-client hot shapes, emit or bind descriptor-specific exact matchers that:
   - validate own enumerable keys exactly,
   - extract placeholders in descriptor-owned order,
   - reuse a cached plan handle on hits,
   - fall back to `serializeJsonQuery()` on any uncertainty.
3. Only after JS-side exact/cache-hit wins are reliable, consider moving this matcher/parameterizer into Wasm with a non-Reflect representation.

The existing descriptor-bound exact-helper work is the closest practical version of this wedge. It already avoids the Rust request parser and cache-key string for supported cache hits while preserving slow-path semantics through descriptor self-tests.

The next descriptor-helper candidate is not a generic nested matcher. The 2026-06-11 constant-`take` nested `Post.findMany` blog-feed row measured default / request-precomputed / descriptor-bound static / exact-helper at 22.24 / 24.02 / 19.09 / 19.26 us/op over 300k Node iterations, after an oracle probe confirmed `take` is currently a literal cache-key component rather than a placeholder. The strict generated template `template:Post.findMany:take:blogFeedPostListV1` now has VM/oracle coverage and Workerd benchmark coverage: a 10k Workerd repeat measured default / engine-precomputed / request-precomputed / descriptor-bound static / exact-helper at 22.18 / 17.79 / 17.76 / 17.77 / 17.95 us/op host dispatch, with all precomputed rows hitting 10000/10000. This remains constant-`take` only. A direct 2026-06-11 probe showed the current Wasm compiler rejects `Param<Int>` for root `take`, nested `comments.take`, shared root+nested placeholders, and separate root/nested placeholders, so arbitrary `take` support needs an engines-side pagination placeholder design before the client cache key can change.

A stricter feed-by-author template now proves the same generated-template approach can extract a real non-pagination filter placeholder for `Post.findMany`: `template:Post.findMany:authorId:blogFeedByAuthorPostListV1` validates exact `where.authorId`, constant `take: 10`, fixed order, and the full nested blog-page select. Node 300k generated default / request-precomputed / descriptor-bound static / exact-helper measured 21.09 / 20.78 / 19.48 / 19.28 us/op, with all precomputed rows hitting 300000/300000. A focused 20k Workerd repeat measured worker-loop default / request-precomputed / descriptor-bound static / exact-helper at 18.75 / 15.85 / 16.55 / 14.85 us/op, with all precomputed rows hitting 20000/20000. This is a modest product-shaped win, not enough to justify a broad matcher system. The useful follow-up is an allowlist policy and broader special-value/exclusion coverage, while keeping duplicate dynamic/constant warm values out of descriptor-learning tests because equal initial values intentionally collapse in the value-keyed lazy descriptor.

A later direct-validation cleanup kept the same full user-argument shape checks but made the hot static select validation straight-line in the generated blog templates. Close 300k feed-by-author rows moved generated exact-helper 9.24 -> 9.16 us/op and cached-wrapper exact 8.26 -> 8.21, with solo confirmations at 9.16 and 8.06. This is a small implementation cleanup, not a change to the broader architecture lead: skipping full nested shape validation still requires a generated-shape proof.

A 2026-06-12 benchmark-only attempt to replace generated exact-helper fixed-width `Object.keys()` validators with `for...in` / `Object.hasOwn()` scans was rejected. Close control beat patched on the product-safe by-author rows: generated exact-helper `8.98` vs `9.60 us/op`, hoisted exact `8.78` vs `9.35`, and cached-wrapper exact `8.12` vs `8.88`. Keep the current key-array checks unless a different generated-shape proof changes the validation contract.

Flat `findFirst` / `findFirstOrThrow` exact-helper specs are now supported internally for strict one-field scalar/enum equality plus exact select. The first Node `findFirst users` row is small but positive: request-precomputed / hand exact / runtime exact measured `2.25 / 2.07 / 2.08 us/op`, then `2.25 / 2.09 / 2.14` on repeat. Workerd coverage for the same `User.findFirst({ where: { email }, select: { id, email, name } })` shape repeated at host dispatch default / request-precomputed / hand exact / runtime exact `15.56 / 3.24 / 3.01 / 2.93 us/op`, with all rows hitting `20000/0` cache hits. JS/TS generator oracle tests now prove flat `findFirst` and `findFirstOrThrow` placeholder/cache-key parity against the real serializer/parameterizer, and the request-layer self-test stores the runtime exact `findFirst` matcher. This is productization groundwork for exact helpers, not permission to build a broad filter matcher.

### What A Wasm Reference-Type Version Would Need

A direct Rust-over-JS implementation probably needs generated/static access strategy, not generic `js_sys::Reflect` traversal. Prior `Reflect` walkers were much slower than native `JSON.stringify()` and JS exact descriptor helpers.

A plausible design would introduce a query-input view abstraction:

- `PrismaValueRef` / `PrismaString` / object-view traits for parser and validator code.
- Native Rust implementations for unit tests and non-Wasm builds.
- Wasm implementations backed by JS references or generated accessors.
- Borrowed/lazy validation that materializes only the internal compiler IR on cache misses.

The more radical version is also coherent: do not create owned Rust representations of either the input query object or cached SQL strings unless the current compilation miss truly needs an internal IR node. In that model, the JS client passes one query-object reference, the cache lookup and parameter extraction operate over JS-owned values, and a cache hit returns a cached JS plan object without transferring a serialized request or plan across the Wasm boundary. Wrapper types such as `PrismaString` / `PrismaObjectRef` could have Rust-owned implementations for unit tests and JS-backed implementations for Wasm.

The practical caveat is that this only looks attractive with generated/static accessors or descriptor-bound views. A generic Rust walker over arbitrary JS objects would likely reproduce the `compileFromValue(JsValue)` failure mode: it would move the boundary but still pay dynamic traversal plus owned validation structures. The first proof should be narrow: one generated shape, one provider-independent request kind, and a direct comparison against both current string compile and JS exact-helper cache hit.

### SQL String Ownership

Avoiding Rust-owned SQL strings is a separate problem from avoiding Rust-owned input queries.

Compile misses still build SQL templates in Rust today. A no-Rust-SQL design would require one of:

- returning interned/template atom references into a JS-side plan cache,
- compiling to a more compact query-plan IR where SQL chunks are symbolized or shared,
- moving SQL template construction to JS for selected generated shapes.

This is probably not the first spike. The retained-plan memory probes show SQL strings remain the largest serialized plan component, but prior cache-side splitting/interner experiments did not reduce heap. Changing where SQL is owned should be tied to a producer-level plan-shape change, not another cache post-processing pass.

### Acceptance Gates

For any JS-owned query/cache-hit spike:

- Node generated rows: `findUnique`, batched `findUnique`, `findMany users`, stable blog-page, alternating blog-page.
- Workerd generated rows: the same supported subset, with stable and alternating blog-page if nested helpers are touched.
- Correctness oracle: compare shortcut output to `serializeJsonQuery()` + `parameterizeQuery()` + cache-key/placeholder ordering on special values.
- Exclusions must be explicit: extensions, global omit, SQL commenters, tracing/debug, transactions, non-empty `dataPath`, raw queries, writes, and batching changes should stay on slow path until covered.
- Pagination values such as `take` / `skip` are currently structural, not placeholder-safe. Treat arbitrary pagination support as an engines project that changes `Take` / SQL limit / in-memory pagination semantics, not as a JS-only parameterizer tweak.
- Internal data shapes are version-lockstep. If a spike changes an internal query-plan/input/view shape, replace the shape across producer and consumer code instead of carrying old/new compatibility readers.

## Borrowing, Arenas, And `Arc`

### Practicality

Borrowing/arena work can be practical in the query compiler, but broad `Arc` removal is too unfocused right now.

Recent allocation profiles still point at `graph_build` and `translate_ir` containers. The accepted Rust wins were concrete container/translation changes with Criterion proof. Several allocation-only rewrites saved a few allocations and still regressed Criterion.

### Recommended Wedge

Use compile-local ownership scopes rather than a repository-wide memory-management rewrite.

Good candidates:

- `QueryGraph.visited` capacity during translation was accepted in engines commit `b2377d67f39`: reserving for the graph node count before root traversal saved 1-2 `translate_ir` / `full_compile` allocations on nested-write rows, kept sampled read/aggregate controls allocation-neutral, and was neutral-to-positive in close Criterion.
- direct placeholder storage for `Flow` / `Diff` projected inputs was accepted in engines commit `fd906df5c3d`. `If`, `Return`, and `Diff` now store direct `Option<Placeholder>` inputs through `RowSink::ProjectedPlaceholder` instead of building a `Vec<SelectionResult>` that translation immediately unwraps. It saved 2-10 `translate_ir` / `full_compile` allocations on nested write rows (`update-set-nested` 1085/1831 -> 1075/1821, `create-nested-connectOrCreate-mixed` 1494/2432 -> 1484/2422, `nested-upsert-nested-only` 1721/3006 -> 1717/3002), with `create-nested-create`, `query-m2o`, `query-many-m2m`, and `aggregate` controls allocation-neutral. Focused Criterion was neutral-to-positive. This is a lockstep internal shape replacement with no old/new compatibility reader.
- identity parent binding skipping was accepted in engines commit `02404611763`. Translation no longer builds and then filters `Binding::new(source.id(), Get(source.id()))` for projected dependencies that do not need validation or uniqueness. It saved another 4-14 `translate_ir` / `full_compile` allocations on nested write rows (`update-set-nested` 1075/1821 -> 1061/1807, `create-nested-connectOrCreate-mixed` 1484/2422 -> 1474/2412), with read/aggregate controls allocation-neutral. Close Criterion was noisy but neutral-to-positive overall.
- required-child one-to-many nested `set` phase ownership was accepted in engines commit `102c8fb35ae`. The narrow `DiffBoth` object plus side-projection shape was rejected on 2026-06-18 because it removed one graph computation but only moved `update-set-nested` from `translate_ir/full_compile 1061/1807` to `1064/1806` while regressing adjacent nested-write controls. The accepted required-child, single-scalar id/link operation owns old/new reads, new-only connect/update, and old-only relation-violation validation while translating back to existing expression primitives. It moved `update-set-nested` from `graph_build/translate_ir/full_compile 608/1061/1785` to `597/1024/1737`, lowered full allocated bytes from `218.8 KiB` to `202.5 KiB`, kept sampled controls allocation-neutral, and had target-positive Criterion despite noisy runs (`213.54 us` patched vs `238.16 us` clean control in the final target-only A/B). No TS runtime/query-plan format changed and no old/new compatibility reader was added.
- branch-aware nested-upsert shared connect joining was accepted in engines commit `09374a92e87`. For the exact case where both create/update branches carry the same many-to-many `connect` and the update branch has no other work, the graph now returns the branch-selected child and runs one shared connect after the `if`. This moved `nested-upsert-nested-only` `translate_ir/full_compile` allocations from `1713/2998` to `1458/2732`, lowered full allocated bytes from `360.3 KiB` to `327.0 KiB`, and improved the focused Criterion row from `366.05` to about `335-336 us`. It is a lockstep internal graph replacement with no old/new compatibility reader.
- query-document parser and protocol adapter success paths. A small request-adapter success-path cleanup was accepted in engines commit `e761557fa45`: `JsonProtocolAdapter::convert_selection()` now records false selection keys during its main selection walk instead of pre-scanning the map. This did not change allocation counts, but close Criterion was neutral-to-positive on sampled compile rows, with the clearest wins on `create-nested-connectOrCreate-mixed`, `nested-pagination-query`, and `nested-upsert-nested-only`. The next kept parser cleanup is engines commit `a38dbd892f7`: `parse_input_value()` now consumes `ArgumentValue` directly when there is exactly one possible input type, leaving multi-input failure aggregation unchanged. It saved broad graph-build/full-compile allocations on sampled rows (`create-nested-connectOrCreate-mixed` full_compile `2412 -> 2357`, `nested-upsert-nested-only` `2732 -> 2679`, `update-set-nested` `1807 -> 1785`, `query-compound-id` `360 -> 348`) with focused Criterion neutral-to-positive.
- graph-build temporary selections and filters,
- translation-side result structures that are built and immediately consumed,
- root result mapping for raw-nested reads, but only when translation can prove the raw-nested output before building the mapper. Engines commit `491ce36d76c` keeps a conservative root-read preflight and hard invariant guard, saving 11-26 full-compile allocations on query-mode nested read rows while sampled controls stayed allocation-neutral.
- aggregation result-node data mapping in `query-compiler/query-compiler/src/data_mapper.rs::get_result_node_for_aggregation()` was accepted in engines commit `37b0b015f9c`: streaming the paired `selection_order` / `selectors` vectors removed the `IndexSet` / `ordered_set.get_index_of()` sorting path and saved 5-9 `translate_ir` / `full_compile` allocations on `aggregate`, `aggregate-custom`, and `group-by`.
- graph shapes that duplicate whole semantic branches. Many-to-many connect-or-create branch joining was accepted in engines commit `9b870cf327e`: both branches now return the selected child id through `Flow::Return`, then one shared connect runs after the `if`, saving about 135-138 full-compile allocations and about 4.5% Criterion time on the targeted m2m connect-or-create rows.
- branch result forwarding that is redundant with the branch expression. Engines commit `8b2a45cfe7b` removed the create-side `Flow::Return` from many-to-many nested connect-or-create because `CreateRecord` already returns the selected child id for the downstream connect. This saved 16-17 full-compile allocations on `create-nested-connectOrCreate-mixed` / `one2m`, with close Criterion neutral-to-positive.
- graph shapes that create semantic no-op write nodes. Nested-only to-one updates were accepted in engines commit `6f256b26dfd`: when the update has no scalar write args and only nested operations, the child lookup is validated and passed through `Flow::Return` instead of creating an empty `UpdateRecord` plus reload, saving 125 full-compile allocations and about 7% Criterion time on `update-set-nested-prisma#27650`.
- branch-local semantic no-op write nodes. Nested-upsert nested-only update branches were accepted in engines commit `34bde27cfb5`: the `Then` branch now validates and returns the found child row, then runs nested operations from that returned child instead of creating an empty `UpdateRecord`, saving 137 full-compile allocations and about 4% Criterion time on `nested-upsert-nested-only`.
- empty-set graph shapes. One-to-many `set: []` was accepted in engines commit `d3d45546416`: the graph now reads old children once, preserves the required-child-side relation violation check, and updates those old ids directly instead of building a `WHERE 1=0` new-child read, two diff nodes, and the impossible connect branch. The focused `update-set-nested-empty` fixture saved 344 full-compile allocations and improved close Criterion by about 18-20%.
- required child-side disconnect validation. One-to-many nested `set` on required child-side relations was accepted in engines commit `a87f6ccff37`: old-only rows now go through a validation-only node because any attempted disconnect must fail with a relation violation. This removed unreachable nulling updates from both empty and non-empty required `set` paths, saving 165/162 full-compile allocations and improving close Criterion by about 30% / 5% on `update-set-nested-empty` / `update-set-nested`.
- top-level upsert empty/nested-only update branches. This was accepted in engines commit `a3ee45d7d44`: when the update branch has no scalar writes, the `Then` branch now returns the initial parent-id read and attaches any nested writes there instead of building a no-op update/read path. The focused empty and nested-only fixtures saved 203/206 full-compile allocations and improved close Criterion by about 16% / 10%.
- ordered result-object builders where the semantic order is already known. Replacing `ResultNode::Object`'s `IndexMap` with a capacity-sized `Vec` paid off on 2026-06-12 because it removed hashing/bucket storage instead of merely pre-sizing the old map; close Criterion improved sampled compile rows by about 2-6% with no significant regressions.
- raw-nested read-builder metadata only if it removes a larger translate phase. A 2026-06-12 owned raw-nested builder guarded by exact preflight was rejected: it passed `cargo check`, but patched `translate_ir` allocs/op worsened from `327/425/326` to `331/429/330` on `query-m2o` / `query-many-m2m` / `query-many-one2m`, and pagination rows also softened by one allocation.

Less promising without a sharper hypothesis:

- broad `Arc` replacement,
- arenas for long-lived schema objects,
- changing shared model/schema ownership before profiling shows it on CPU or retained-memory paths.
- standalone preflight-owned raw-nested builders that duplicate the existing fallback checks before consuming `ReadQuery` values.
- single-link `RelationLinkage` storage by itself. The 2026-06-11 spike saved 3-6 allocations on some focused rows but softened enough Criterion medians to be rejected.
- deferred/non-result `CreateRecord.selection_order` by itself. The 2026-06-11 spike saved 2-6 allocations on create-heavy graph-build/full-compile rows, but close Criterion favored the reverted control on larger create/connectOrCreate rows.
- aggregation SQL `extract_columns()` linear scalar-field dedupe by itself. The 2026-06-12 spike saved allocations on `aggregate` and `aggregate-custom`, but close Criterion favored the reverted control on adjacent aggregate join/lateral/nested rows and matched or beat the patch on simple/group rows.
- scalar-only connect-or-create create-return node removal by itself. The 2026-06-12 spike saved 15-29 full-compile allocations on connect-or-create fixtures, but close Criterion was not robust and the narrowed M2M-only version regressed `create-nested-connectOrCreate-one2m` against the individual reverted control.
- direct `SelectionResult` constructors for already-selected pairs by themselves. The 2026-06-12 spike added a `from_selected_pairs()` constructor and used it in translation plus nearby selection helpers; allocation counts were unchanged on sampled rows, and quick Criterion regressed `nested-upsert-nested-only` by about 5.3%.
- compact `InitializeRecord` / `MapRecord` entry-array internal format by itself. The 2026-06-12 spike replaced object field maps with ordered entry arrays across the Rust producer and TS interpreter, with no old-format fallback because these internal shapes are lockstep. It passed `cargo check`, `@prisma/client-engine-runtime` build, and interpreter tests, but allocation counts were unchanged on sampled write rows; revisit only if a TS runtime profile shows `Object.entries()` on `i` / `M` nodes matters.
- single-child many-to-many nested bulk create by itself. The 2026-06-12 spike let the existing `CreateManyRecords` + connect path handle one-child m2m nested creates, but the `create-m2m` fixture regressed from `translate_ir 918` / `full_compile 1615` allocations to `933` / `1630`; regular `CreateRecord` is cheaper for this compile path.
- duplicate many-to-many nested-upsert target-read sharing as a small parser/graph rewrite. The 2026-06-12 exact-match spike shared the duplicate `Category` read in `nested-upsert-nested-only` while keeping branch-local `ConnectRecords`, but the target row regressed from `full_compile 3011` to `3032` and `translate_ir 1723` to `1749`; a true hoist also needs branch-aware error-order proof.
- JSON protocol `Selection` nested-vector pre-sizing by itself. The 2026-06-12 spike tried schema/selection-set capacity hints and then a narrowed root-only `Vec::with_capacity(query_selection.len())`; the narrowed patch added 1-2 allocations on representative `into_doc` / `full_compile` rows, so eager allocation is worse than the current empty-vector growth pattern.
- single-scalar related-read parent-result extraction by itself. The 2026-06-12 spike bypassed `split_into()` / `FieldSelection::assimilate()` only for matching single-scalar parent/child link types, but allocation counts were unchanged and close Criterion was mostly neutral-to-slightly-worse; the one small pagination win was not enough to keep the branch.
- result-node raw-nested mapper-skip preflights by themselves. The 2026-06-18 spike extended the root raw-nested mapper-skip to a single graph result node and allowed raw-nested `ThrowOnEmpty` validation wrappers, but allocation counts stayed unchanged on nested write/result-read rows. A useful mapper-removal follow-up needs to prove the whole write expression result can bypass the graph-level mapper.
- pre-sizing `ResultReachability::can_reach_result` to the graph node count by itself. A 2026-06-18 spike added one allocation to read/aggregate controls while leaving the intended nested-write rows unchanged, so the current grow-on-reach behavior is better for small-result/read graphs.
- one-to-many nested `set` `DiffBoth` plus side projections by itself. The 2026-06-18 spike added a fused graph computation, side-specific projected dependencies, and `Expression::DiffBoth` / `Expression::DiffSide` with no old-format readers. It saved four graph-build allocations on the target row but regressed translation and adjacent nested-write controls. The accepted `102c8fb35ae` required-child phase-owner supersedes this for the single-scalar id/link required-child case; future set work should extend that semantic-owner shape only with fresh allocation and Criterion evidence.
- skipping field bindings for `RowSink::Discard` by itself. A 2026-06-19 spike left allocation counts unchanged on sampled nested/write/read rows, including `nested-upsert-nested-only`, `create-nested-connectOrCreate-mixed`, `update-set-nested`, validation-heavy update/delete rows, `query-m2o`, and `aggregate`, so it was reverted before Criterion.

### Arena Spike Shape

A useful arena spike should be isolated in a side worktree and prove one of these:

1. A compile-local arena removes a known temporary tree and improves Criterion, not just allocation counts.
2. Borrowed views let translation consume graph/query-document data without cloning a specific hot structure.
3. A typed compact IR replaces an owned map/vector shape that is currently rebuilt between phases.

Minimum gates:

- allocation profile on the affected fixture set,
- close Criterion A/B on the same fixtures,
- no kept patch for allocation-only wins when timing softens.

## Near-Term Priority

1. Finish productizing descriptor-bound exact helpers only behind strict internal gates and oracle coverage.
2. Keep the strict nested `findMany` generated-template spike constant-`take` only unless parameterization changes; do not route it through a recursive nested-selection DSL.
3. Keep the accepted generated call-surface target-cache and edge plain-delegate slices, but stop treating transparent generated-code hoisting as an available runtime optimization for the current `client.model.action(args)` public syntax. Stable model delegate/action layers now cache resolved values on the composite-proxy target after first access and skip their old `cacheProperties()` wrappers, which improved simple generated rows while keeping feed-by-author product rows roughly neutral. Edge `wasm-compiler-edge` extension-free model delegates now use lazy plain-object properties for the inner model delegate, leaving Node `client` and extension-bearing delegates on the proxy path; a 50k Workerd feed-by-author rebuilt A/B moved worker-loop descriptor-bound / exact-helper / hoisted exact from `7.02 / 6.40 / 6.22 us/op` to `6.80 / 6.10 / 5.98`. Benchmark-only hoisted rows still prove more call-surface cost remains, but generated output only exports `runtime.getPrismaClient(config)` and cannot rewrite arbitrary user call sites that repeatedly evaluate `client.post.findMany(args)`. The first generated-owned prepared operation is now kept for `template:Post.findMany:authorId:blogFeedByAuthorPostListV1`: Node generated prepared / exact-helper / prepared request-surface first measured `7.81 / 8.61 / 7.66 us/op`, and Workerd worker-loop default / exact-helper / generated prepared / prepared request-surface measured `10.40 / 8.20 / 7.20 / 6.55 us/op`. A follow-up narrow prepared-read RequestHandler surface made this path target-runtime-positive while Node stayed small/noisy: Node reverse/reapply measured `8.03` reverted control vs `7.85` and `7.82 us/op` patched, post-build generated prepared / exact-helper / request-surface measured `8.06 / 9.20 / 7.86`, and Workerd generated prepared / exact-helper / request-surface measured `6.70 / 8.10 / 6.50`. The inner model-action-target product attempt failed, a universal plain-delegate variant showed a small Node `client` simple-row regression, an edge-only direct-client lazy-model-property fast path regressed the 50k Workerd feed rows, both proxy target-cache micro-fast paths were rejected, precomputing `paramOverrides` metadata inside model actions worsened priority Workerd exact-helper rows, a specialized extension-free edge applied-client proxy lost the close Workerd control, mutable prepared-hit placeholder reuse was neutral-to-negative (`8.33` vs `8.23 us/op`), omitting the PrismaPromise operation spec regressed (`9.33` vs `8.59 us/op`), and reusing a stable read-options object while skipping the success `.then()` in `requestPreparedReadPrecomputedCachedResult()` regressed the same-session Node generated/request-surface prepared rows (`7.65 -> 7.94`, `7.72 -> 7.86`). A standalone queryless prepared engine method was also rejected on 2026-06-18: existing direct prepared / queryless prepared / request-surface prepared measured `7.02 / 7.24 / 7.63 us/op` over 300k Node iterations. Recovering more of the benchmark-only hoisted lower bound now means either trimming the kept generated prepared helper's remaining allocation cost or designing a real generated/public prepared operation surface, not another standalone applied-client proxy, cache-hit aliasing, metadata removal, or engine-boundary variant.
4. For nested execution, pursue a larger writer/wave descriptor only if it changes ownership of a whole phase. The current unique-root raw-nested static-wave lower-bound gap is about 0.5 us/op on Node direct rows after compiled final-owner query leaves, so one-branch final-owner edits are unlikely to survive generated-client gates. The blog-feed product plan now does compile to raw-nested after relation-level no-cursor pagination ops were added, and the kept non-unique final-owner executor brought generated/direct feed rows to about 10.17 / 6.95 us/op. Follow-up one-root branching, second-wave branch scheduling, Map pre-indexing of non-unique final-owner relation rowsets, a non-Map single-pass root-slot writer, a small-parent array counter inside `filterRawNestedRelationRows()`, shared root-key scope extraction for wrapper/child first-wave queries, a compiled child-list relation-op filter, a prepared QueryInterpreter/LocalExecutor runner cache, and direct child-list assembly without the filtered child-row array were rejected because each helped the wrong layer or softened direct/exact/generated rows. A benchmark-only `raw result-set direct final-owner schedule blog feed by author / nested rows` row now proves the stricter phase-owner shape at `6.63 us/op` over 300k iterations, versus adjacent direct / raw compact / raw exact compact / local controls at `7.07 / 6.96 / 7.06 / 7.33 us/op`. The next feed runtime proof should productize that kind of plan-specific non-unique final-owner schedule, owning wave scopes, relation-op filtering, relation-specific row writing, and final attachment for the by-author topology. Do not return to compact-join `d/l/j` work for this shape unless a different query still emits it. If this requires an internal plan/protocol shape change, replace the old shape across producers and consumers rather than carrying old/new compatibility branches.
5. For Rust memory management, keep taking profile-backed slices. Do not start an arena/borrowing rewrite until the target structure and Criterion row are named. Direct placeholder storage for `Flow` / `Diff`, identity parent-binding skipping, the nested-upsert shared m2m connect join, singleton parser value consumption, and the required-child one-to-many nested `set` phase-owner have now been accepted. Do not retry the rejected one-to-many nested `set` `DiffBoth` object plus side-projection shape or the `RowSink::Discard` field-binding skip; future set work should extend the accepted semantic-owner shape only when the target case, lockstep internal shape, allocation profile, and Criterion row are named.
