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

The 2026-06-11 Rust/Wasm scout rechecked the current code and found no active `compileFromValue` / `compileSerdeWasmBindgen` request entrypoint. A shallow `from_value()` entrypoint would still produce owned `JsonBody`, `IndexMap<String, serde_json::Value>`, `Operation`, `Selection`, and `ArgumentValue` structures before graph build. That makes it the same rejected class of change as the earlier release-Wasm sidecar unless the request parser itself becomes JS-value-backed or borrowed.

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

- query-document parser and protocol adapter success paths,
- graph-build temporary selections and filters,
- translation-side result structures that are built and immediately consumed,
- aggregation result-node data mapping in `query-compiler/query-compiler/src/data_mapper.rs::get_result_node_for_aggregation()` was accepted in engines commit `37b0b015f9c`: streaming the paired `selection_order` / `selectors` vectors removed the `IndexSet` / `ordered_set.get_index_of()` sorting path and saved 5-9 `translate_ir` / `full_compile` allocations on `aggregate`, `aggregate-custom`, and `group-by`.
- graph shapes that duplicate whole semantic branches. Many-to-many connect-or-create branch joining was accepted in engines commit `9b870cf327e`: both branches now return the selected child id through `Flow::Return`, then one shared connect runs after the `if`, saving about 135-138 full-compile allocations and about 4.5% Criterion time on the targeted m2m connect-or-create rows.
- graph shapes that create semantic no-op write nodes. Nested-only to-one updates were accepted in engines commit `6f256b26dfd`: when the update has no scalar write args and only nested operations, the child lookup is validated and passed through `Flow::Return` instead of creating an empty `UpdateRecord` plus reload, saving 125 full-compile allocations and about 7% Criterion time on `update-set-nested-prisma#27650`.
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
3. Keep the accepted generated call-surface target-cache and edge plain-delegate slices, but stop treating transparent generated-code hoisting as an available runtime optimization for the current `client.model.action(args)` public syntax. Stable model delegate/action layers now cache resolved values on the composite-proxy target after first access and skip their old `cacheProperties()` wrappers, which improved simple generated rows while keeping feed-by-author product rows roughly neutral. Edge `wasm-compiler-edge` extension-free model delegates now use lazy plain-object properties for the inner model delegate, leaving Node `client` and extension-bearing delegates on the proxy path; a 50k Workerd feed-by-author rebuilt A/B moved worker-loop descriptor-bound / exact-helper / hoisted exact from `7.02 / 6.40 / 6.22 us/op` to `6.80 / 6.10 / 5.98`. Benchmark-only hoisted rows still prove more call-surface cost remains, but generated output only exports `runtime.getPrismaClient(config)` and cannot rewrite arbitrary user call sites that repeatedly evaluate `client.post.findMany(args)`. The inner model-action-target product attempt failed, a universal plain-delegate variant showed a small Node `client` simple-row regression, an edge-only direct-client lazy-model-property fast path regressed the 50k Workerd feed rows, both proxy target-cache micro-fast paths were rejected, precomputing `paramOverrides` metadata inside model actions worsened priority Workerd exact-helper rows, and a specialized extension-free edge applied-client proxy lost the close Workerd control. Recovering the benchmark-only hoisted lower bound would need a new generated-owned call surface, such as generated/static prepared operation helpers that close over model actions, not another standalone applied-client proxy variant.
4. For nested execution, pursue a larger writer/wave descriptor only if it changes ownership of a whole phase. The current unique-root raw-nested static-wave lower-bound gap is about 0.5 us/op on Node direct rows after compiled final-owner query leaves, so one-branch final-owner edits are unlikely to survive generated-client gates. The blog-feed product plan now does compile to raw-nested after relation-level no-cursor pagination ops were added, and the kept non-unique final-owner executor brought generated/direct feed rows to about 10.17 / 6.95 us/op. Follow-up one-root branching, second-wave branch scheduling, Map pre-indexing of non-unique final-owner relation rowsets, and a non-Map single-pass root-slot writer were rejected because each helped the wrong layer or softened direct/exact/generated rows. The next feed runtime spike should be producer-emitted/static enough to remove more than local scan order, or it should reduce generated wrapper/descriptor overhead; do not return to compact-join `d/l/j` work for this shape unless a different query still emits it.
5. For Rust memory management, keep taking profile-backed slices. Do not start an arena/borrowing rewrite until the target structure and Criterion row are named. The aggregation result-node scout has been consumed and kept; the next Rust target should come from a fresh allocation profile or CPU profile rather than from the now-exhausted candidate list.
