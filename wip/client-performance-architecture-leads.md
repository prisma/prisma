# Prisma Client Performance Architecture Leads

Date: 2026-06-11

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
- raw-nested read-builder metadata that currently clones field selections or relation scalars.

Less promising without a sharper hypothesis:

- broad `Arc` replacement,
- arenas for long-lived schema objects,
- changing shared model/schema ownership before profiling shows it on CPU or retained-memory paths.
- single-link `RelationLinkage` storage by itself. The 2026-06-11 spike saved 3-6 allocations on some focused rows but softened enough Criterion medians to be rejected.
- deferred/non-result `CreateRecord.selection_order` by itself. The 2026-06-11 spike saved 2-6 allocations on create-heavy graph-build/full-compile rows, but close Criterion favored the reverted control on larger create/connectOrCreate rows.

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
3. For nested execution, pursue a larger writer/wave descriptor only if it changes ownership of a whole phase. The current unique-root raw-nested static-wave lower-bound gap is about 0.5 us/op on Node direct rows after compiled final-owner query leaves, so one-branch final-owner edits are unlikely to survive generated-client gates. The blog-feed product plan now does compile to raw-nested after relation-level no-cursor pagination ops were added, and the kept non-unique final-owner executor brought generated/direct feed rows to about 10.17 / 6.95 us/op. Follow-up one-root branching, second-wave branch scheduling, and Map pre-indexing of non-unique final-owner relation rowsets were rejected because each helped the wrong layer or softened direct/exact/generated rows. The next feed runtime spike should remove a larger relation assembly phase, produce a static writer/wave schedule that avoids both scans and Map/write-ahead overhead, or reduce generated wrapper/descriptor overhead; do not return to compact-join `d/l/j` work for this shape unless a different query still emits it.
4. For Rust memory management, keep taking profile-backed slices. Do not start an arena/borrowing rewrite until the target structure and Criterion row are named.
