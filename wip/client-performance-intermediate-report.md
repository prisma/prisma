# Prisma Client performance intermediate report

Date: 2026-06-09.

This report summarizes the current magnitude of the performance and memory gains from the ongoing Prisma Client performance branch. The numbers are from the persistent journal and focused probes in this branch; many rows are microbenchmarks over fake adapters or Miniflare/workerd harnesses, so they should be read as directional product-path evidence rather than final customer benchmarks.

## Headline

The branch has already found and landed enough product-path work to make several hot generated-client cache-hit rows materially faster, with the largest gains on Cloudflare/workerd simple reads and Node generated-client rows. The 3x target is met or exceeded for some simple/cache-hit paths, but not uniformly for nested generated-client rows yet.

| Surface                                                       |                                                   Earlier credible row |                                                  Current / kept row |                                                            Magnitude |
| ------------------------------------------------------------- | ---------------------------------------------------------------------: | ------------------------------------------------------------------: | -------------------------------------------------------------------: |
| Workerd generated `findUnique` warmed cache                   |   22.50 us/op worker-loop upper-bound after high-iteration calibration |  4.32 us/op worker loop in the current default product-path refresh |                                             ~5.2x faster, ~81% lower |
| Workerd generated blog-page warmed cache                      | 44.40 us/op host-dispatch upper-bound after high-iteration calibration | 17.10 us/op worker loop in the current default product-path refresh |                                             ~2.6x faster, ~61% lower |
| Node generated `findUnique` warmed cache                      |                          22.62 us/op before model-action/proxy cleanup |                4.25 us/op in the default-on request-precomputed A/B |                                                         ~5.3x faster |
| Node generated blog-page warmed cache                         |                          52.71 us/op before model-action/proxy cleanup |               14.33 us/op in the default-on request-precomputed A/B |                                                         ~3.7x faster |
| Workerd forced engine-precomputed `findUnique` benchmark mode |                                               22.50 us/op baseline row |                                              1.92 us/op worker loop |                ~11.7x faster, but not default-safe for all semantics |
| Workerd forced engine-precomputed blog-page benchmark mode    |                                               44.40 us/op baseline row |                                             12.20 us/op worker loop |                             ~3.6x faster, but still an internal mode |
| Retained blog-page query-plan heap, node warm                 |             about 16.8 MiB without raw-nested subtree/string interning |                    about 4.55 MiB after compact interner-count work |                                             ~3.7x less retained heap |
| Workerd retained blog-page serialized plans, 100 entries      |                     about 413.8 KiB before later compact/interner work |                                  335.4 KiB in the latest validation |                                     ~19% lower serialized plan bytes |
| Query compiler M:N nested read / connectOrCreate compile rows |                                       old `dataMap` / join translation |                                    compact raw-nested read emission | ~9-11% faster Criterion rows, ~10-15% fewer full-compile allocations |

## Biggest Contributors

1. Generated-client cache-hit/precomputed request path.

This is the largest CPU contributor. The branch proved that generated requests can carry descriptor-derived cache-hit data through the real request path and skip engine-side parameterization and cache-key construction. The product-safe default path now keeps RequestHandler/DataLoader semantics, with guards for transactions, extensions, tracing, debug, SQL commenters, global omit, non-root data paths, and unsupported call shapes.

Notable effects:

- Node default-on request-precomputed A/B moved generated `findUnique` 7.02 -> 4.25 us/op, batched `findUnique` 13.41 -> 8.55, and blog-page 19.86 -> 14.33.
- Workerd request-precomputed rows moved generated `findUnique` 7.50 -> 4.55 us/op worker loop and blog-page 19.20 -> 12.20 in the explicit request-layer mode.
- Direct engine-precomputed rows show a lower bound around 1.5-2.4 us/op for simple Worker hits and 8-10 us/op for nested Worker hits, but those bypass semantics that still need product-safe support.

2. Public API and serializer allocation cleanup.

Before the precomputed path became default, a long sequence of generated-client hot-path cleanups reduced public API overhead: cached model action proxy properties, prototype PrismaPromise methods, empty-extension `_request()` fast path, `queueMicrotask()` DataLoader scheduling, deferred batch-key construction, cheaper selection traversal, lazy serializer path materialization, avoiding rest-object allocation for selection-only fields, omitting empty JSON protocol arguments, cached serializer field tables, and cheap debug/timing guards.

This moved the Workerd generated-client band from roughly 22.50 / 44.40 us/op for simple/nested calibrated rows to roughly 6-7 / 18-20 us/op before the later request-precomputed product path tightened it further.

3. Query-plan cache shape and memory work.

The branch converted many query-plan protocol structures from object-heavy forms to compact tuples/omissions, added string/result-node sharing, made compact raw-nested plans participate in interning, and then replaced retained per-entry refcount `Map`s with compact arrays. The important result is not just smaller serialized plans; retained V8 heap for many cached nested plans dropped substantially.

Big memory wins:

- Raw-nested child subtree/string interning recovered sharing that compact raw-nested emission had initially bypassed: retained blog-page plans dropped from about 16.8 MiB to about 5.3 MiB in the node warm probe.
- Compact interner-count storage then reduced restarted-baseline blog-page node warm 4.88 -> 4.55 MiB and parameterized node warm 5.10 -> 4.75 MiB.
- Workerd retained blog-page plan cache validation shows 100 entries at 335.4 KiB serialized plan bytes with stable generated-client timing.

4. Raw nested read protocol and runtime.

The branch added compiler-emitted compact raw-nested read (`n`) plans and runtime support that avoids generic `serializeSql()` / `Join` / outer `dataMap` assembly for supported query-mode nested reads. Runtime numeric mapping, local relation scopes, wrapper assembly, relation fanout, and indexed relation attachment each moved parts of the nested path.

Current state:

- Initial local-Wasm blog-page comparisons had direct/local nested execution around 10-11 us/op and compact raw-nested node around 8.5 us/op.
- Current focused compact raw-nested rows are commonly around 6.0-6.5 us/op, with exact wrapper rows around 6.0-6.6 depending run.
- A synthetic 100-parent attachment-heavy raw-nested shape improved 208.0 -> 79.7 us/op after thresholded relation indexes.
- Benchmark-only static-wave writer rows reach the direct assembler lower bound: Node 3.90-3.91 us/op and Workerd 2.15 us/op worker loop. That is the strongest next product-shape lead, but runtime/product spikes that still used generic result/record/scope arrays have been rejected.

5. Rust query-compiler allocation and compile-time work.

The largest accepted Rust-side win is changing M:N nested reads from `dataMap` / join plans to compact raw-nested reads where guardrails allow it:

- `query-m2m` full compile allocations 941 -> 797 and Criterion 40.625 -> 36.055 us.
- `query-many-m2m` full compile allocations 912 -> 795 and Criterion 40.831 -> 36.203 us.
- M:N-containing connectOrCreate rows saved roughly 300 full-compile allocations and improved about 9-10%.

Smaller Rust allocation wins were kept only when Criterion stayed neutral-to-positive: selection-order consuming passes, parser path mutable stack, raw nested relation scalar helpers, borrowed related-read compilation, placeholder scalar serialization, and direct `ModelProjection::as_columns()` collection. The allocation profiles still point at `graph_build` and `translate_ir` mid-sized owned structures, not a broad `Arc` clone problem.

## What Did Not Pay Off

Several plausible ideas were tested and rejected:

- `serde_wasm_bindgen` / one-pass JSON deserialization as a standalone path is unlikely to be the main win. The native allocation profile shows JSON parse/adaptation is smaller than `graph_build` and `translate_ir`, and cache hits still need JS-side cache-key/shape work anyway.
- Cache-key-only work is low ceiling on Workerd: pure cache-key/lookup is about 0.4 us/op for `findUnique` and 1.5 us/op for blog-page, far below the full generated-client cost.
- Generic descriptor matchers, generic raw-nested flat schedules, and instruction-array executors that still allocate generic result/record/scope arrays do not beat the current paths enough to productize.
- Broad Rust ownership/`Arc` rewrites are not justified yet. The useful targets are concrete graph/translation containers and raw-nested/read-builder allocation sources.

## Current Best Leads

1. Productize descriptor-bound exact helpers behind strict internal gates and oracle tests. The first kept internal-gated slice now emits a runtime exact-helper registry for scalar `findUnique` specs supplied through `generator.config.internalExactDescriptorHelpers`. A 2026-06-09 focused Node 100k run measured generated `findUnique` default / request-precomputed / hand exact / runtime exact at 3.72 / 3.61 / 3.55 / 3.49 us/op, and batched `findUnique` at 8.31 / 8.59 / 8.08 / 8.11 us/op. This is useful groundwork, but not a default feature; the remaining product work is Workerd verification and oracle coverage for special values, placeholder reuse/order, `Prisma.skip`/strict undefined, extensions/global omit exclusions, and fallback misses. The broader generator-emitted proof also showed Node request-precomputed -> exact helper at 4.05 -> 3.88 us/op for `findUnique`, 9.70 -> 9.02 for batched `findUnique`, and 3.21 -> 2.95 for `findMany`; Workerd 5k host dispatch moved 10.04 -> 9.57, 14.08 -> 13.40, and 7.15 -> 5.61 respectively.

2. Move raw-nested execution toward generated/static writer schedules. The benchmark-only static-wave writer reaches the assembler lower bound, while runtime-derived generic schedules keep regressing or only moving a few percent.

3. Explore the radical JS-owned query/cache-hit architecture as a larger design, not as `serde_wasm_bindgen`. A handle-only cached `findMany` spike that merely removed `protocolQuery` from the final cached-plan engine call was rejected as noise-level, so the next proof has to remove larger phases together: descriptor/protocol construction, structural identity, Rust-owned request materialization, or plan/result transfer. Compile misses can still fall back to the current Rust-owned path initially.

4. Continue Rust allocation work from profile-backed structures: `graph_build`/`translate_ir` containers, relation scalar helper vectors, parser/query-document success-path allocations, and SQL/query plan serialization. Avoid broad arena rewrites until a specific compile-local ownership target is identified.

## Status

The branch has strong partial wins and much better instrumentation than at the start. It has not yet proven a uniform 3x improvement across every important generated-client scenario. Simple Worker cache-hit paths are already past 3x; nested Worker default product paths are closer to 2.5-2.7x, with internal engine-precomputed and raw-writer benchmark rows showing enough headroom to plausibly reach the remaining target if the next product shapes preserve semantics.
