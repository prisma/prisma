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

The next descriptor-helper candidate is not a generic nested matcher. The 2026-06-11 constant-`take` nested `Post.findMany` blog-feed row measured default / request-precomputed / descriptor-bound static / exact-helper at 22.24 / 24.02 / 19.09 / 19.26 us/op over 300k Node iterations, after an oracle probe confirmed `take` is currently a literal cache-key component rather than a placeholder. Productizing that lead should look like a strict generated template such as `template:Post.findMany:take:blogFeedPostListV1`, with descriptor-bound self-test and oracle coverage for constant `take: 10`, constant `orderBy`, exact nested selection shape, `undefined`, and `Prisma.skip`. Arbitrary `take` support needs a parameterization/cache-key change, not a descriptor-only shortcut.

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
3. For raw nested execution, pursue a larger final-owner writer/wave descriptor only if it changes ownership of a whole phase. The current static-wave lower-bound gap is about 0.5 us/op on Node direct rows after compiled final-owner query leaves, so one-branch edits are unlikely to survive generated-client gates.
4. For Rust memory management, keep taking profile-backed slices. Do not start an arena/borrowing rewrite until the target structure and Criterion row are named.
