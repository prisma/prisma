# Prisma Client Performance Journal

Date started: 2026-06-06

Objective: make Prisma Client materially faster and lower-memory, especially on Cloudflare Workers. The current focus is the local `ClientEngine` path with the Wasm query compiler and TypeScript query interpreter. Related Rust work lives in `/home/aqrln.guest/prisma-engines`.

## Current Baseline

- Prisma repo current relevant commits:
  - `e7684e6df Document query compiler phase timing`
  - `5745f952b Document query compiler request parsing path`
  - `247eeb701 Return native values from local client engine`
  - `45a9b05b9 Optimize single-key join attachment`
  - `ea639583f Document argument deserializer benchmark result`
  - `5d6e50460 Document ParamGraph node cache benchmark result`
  - `48e0b6fbd Skip chunk rebuild within parameter limit`
  - `cc7f692dd Inline SQL template chunk planning`
- Engines repo current relevant commits:
  - `ba4aa725900 Avoid empty exclusion vector allocation`
  - `cc50b6120df Avoid eager argument conversion errors`
  - `b135e3d34b9 Avoid parsed argument value clone`
  - `8939dc3b333 Avoid input object schema map allocation`
  - `aa0c044176d Reduce query parser argument cloning`

## Kept Changes

- `247eeb701 Return native values from local client engine`
  - Local `ClientEngine` now has `LocalExecutor.resultFormat = 'js'`.
  - `QueryInterpreter` returns native JS values for non-raw local results.
  - `RequestHandler` skips JSON-protocol deserialization only for responses marked with `queryEngineResultDataWasDeserialized`.
  - Remote/Data Proxy/query-plan-executor paths still use JSON-protocol-shaped values.
  - Verified with:
    - `pnpm --filter @prisma/client-engine-runtime test`
    - `pnpm --filter @prisma/client-engine-runtime build`
    - `pnpm --filter @prisma/client build`
    - `pnpm --filter @prisma/client test RequestHandler.test.ts --runInBand`
    - `git diff --check`
  - Query-performance after this change was broadly neutral-to-positive versus the prior baseline:
    - `findUnique with nested includes`: about 3,943-3,974 ops/sec vs earlier about 3,771.
    - `findMany with includes`: about 3,604-3,628 vs earlier about 3,401.
    - Page-query rows showed no clear broad regression.

- `45a9b05b9 Optimize single-key join attachment`
  - Kept as a focused interpreter-side improvement.

- `48e0b6fbd Skip chunk rebuild within parameter limit`
  - Kept as a render-query/chunking improvement.

- `cc7f692dd Inline SQL template chunk planning`
  - Kept as a render-query/chunking improvement.

- Engines parser/allocation commits kept:
  - `ba4aa725900 Avoid empty exclusion vector allocation`
  - `cc50b6120df Avoid eager argument conversion errors`
  - `b135e3d34b9 Avoid parsed argument value clone`
  - `8939dc3b333 Avoid input object schema map allocation`
  - `aa0c044176d Reduce query parser argument cloning`

## Rejected Experiments

- `RequestHandler.unpack` broader allocation patch.
  - Tried replacing `Object.keys`/`Object.values`, using a first-key helper, and skipping `dataPath.filter`/`deepGet` for empty paths.
  - Focused tests and build passed.
  - Query-performance regressed relation-heavy rows:
    - `findUnique with nested includes`: about 3,743 vs committed baseline about 3,943-3,974.
    - `findMany with includes`: about 3,524 vs about 3,604-3,628.
    - `order history query`: about 6,893 vs about 6,980-7,042.
  - Reverted.

- `RequestHandler.unpack` narrow `Object.values(data)[0]` removal.
  - Changed only `const response = Object.values(data)[0]` to `const response = data[operation]`.
  - `pnpm --filter @prisma/client test RequestHandler.test.ts --runInBand` passed.
  - `pnpm --filter @prisma/client build` passed.
  - Query-performance regressed relation-heavy rows and then failed at `count all` with `Missing data field (Object): '_count'`.
  - Reverted.

- Cached per-field result mapper closures in `data-mapper.ts`.
  - Focused tests passed after fixing enum capture.
  - Interpreter benchmark was mixed/noisy:
    - Some nested/deep rows improved, but simple/findUnique/join rows were flat or worse across runs.
  - Reverted.

- Single-Map `QueryPlanCache` LRU.
  - Replaced linked-list/two-map cache with insertion-ordered `Map`.
  - Tests passed.
  - Pure JS A/B showed hit path was much slower:
    - Linked hit: about 12.7M ops/sec.
    - Single Map hit: about 7.6M ops/sec.
  - Heap saving for 100k long-key entries was only about 1.5 MiB; edge default cache size is 100.
  - Reverted.

- Omit default `ResultNode` fields from Wasm output.
  - Tried skipping `serializedName: null` and `skipNulls: false`.
  - TS accepted optional defaults; Rust/TS tests passed.
  - Plan-size savings were tiny:
    - `findUnique`: saved about 40 bytes.
    - Blog page: saved about 188 bytes.
  - `caching.bench.ts` compile rows got slightly worse.
  - Reverted.

- Empty `DataMap.enums` omission.
  - Measured before patching.
  - Representative plans saved only 0-11 bytes.
  - Dropped without implementation.

- Optional provider-default `placeholderFormat` omission.
  - Rust side omitted known provider-default formats (`$` numbered, `?` unnumbered, `@P` numbered).
  - TS side made `placeholderFormat` optional and resolved defaults from `QueryInterpreter` provider.
  - Focused checks passed:
    - `pnpm --filter @prisma/client-engine-runtime test render-query.test.ts`
    - `pnpm --filter @prisma/client-engine-runtime test query-interpreter.test.ts`
    - `pnpm --filter @prisma/client-engine-runtime test`
    - `pnpm --filter @prisma/client-engine-runtime build`
    - `cargo check -p query-compiler-wasm --features postgresql`
    - `cargo test -p query-builder`
    - `cargo test -p query-compiler --test queries`
    - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
    - `pnpm --filter @prisma/client build`
  - First benchmark gate failed:
    - `pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts`
    - Compile rows regressed to about `1,315` ops/sec for `findUnique`, `1,119` for filtered `findMany`, and `282` for blog page query, below prior current ranges around `1,445`, `1,200`, and `311`.
  - Reverted. The estimated byte savings (about 55 bytes per `templateSql`) did not justify the compile regression.

- `serde_wasm_bindgen::from_value` as a direct replacement for string JSON request parsing.
  - Investigation showed it only removes JS-side parsing/copying unless the Rust request parser is redesigned.
  - Current Rust path deserializes request strings into `JsonBody`, including owned `IndexMap` and `serde_json::Value`, then `JsonProtocolAdapter` walks the tree again into `ArgumentValue`/`Selection`.
  - Release-Wasm phase probe showed JSON request decoding is only about 4-7 microseconds, roughly 4-6% of internal compile+serialize time.
  - Treat as low-ceiling unless combined with removing the owned `JsonBody`/`serde_json::Value` tree and/or the query-plan cache stringify path.

## Measurements And Evidence

- Native Rust query compiler Criterion timings on a clean engines tree:
  - Common reads such as `query-m2o` / `query-m2o-lateral`: about 32-33 us.
  - `query-m2m`, `query-many-m2m`, `query-many-one2m`: about 35-40 us.
  - Nested distinct/pagination reads: about 30-42 us.
  - Nested create/update shapes: about 60-140 us / 95-110 us.
  - Criterion "change/regressed" labels were against a stale local baseline; use absolute times only.

- JS/Wasm uncached compilation through `caching.bench.ts` is much slower than native Rust:
  - Compile rows around 1.2k ops/sec for common query shapes and about 304 ops/sec for a blog page query.
  - That implies roughly hundreds of microseconds per Wasm compile in JS, so Wasm boundary, request adaptation, plan serialization, and JS-visible plan shape matter.

- Temporary release-Wasm phase probe over query compiler fixture reads:
  - JSON decode: about 4-7 us, roughly 4-6%.
  - `into_doc`: about 5-7 us for common reads.
  - Compiler work: roughly 50-60%.
  - Plan serialization: often 25-35%, up to about 39% for nested create.
  - JS-visible `compiler.compile(request)` time aligned with internal phase totals, so there was no hidden massive boundary cost in this probe.

- Placeholder-format ceiling check:
  - Each `templateSql` query emits `placeholderFormat`.
  - Removing known provider-default `placeholderFormat` would save about 55 bytes per `templateSql` query.
  - Representative savings:
    - Common two-query reads: about 110 bytes.
    - `create-nested-create`: about 220 bytes.
    - `update-set-nested`: about 385 bytes.
  - This is a plausible small serialization/memory experiment, but not yet implemented or benchmarked.

## Leads To Try Next

- Plan serialization shape.
  - The tagged object tree is verbose and `serde_wasm_bindgen` plan serialization is a large release-Wasm phase.
  - Larger possible directions:
    - Compact representation for hot `Expression` variants.
    - Provider-level defaults for repeated SQL-query metadata.
    - Avoid serializing query plans as generic JS objects if the interpreter can consume a more compact representation.
  - Risk: broad TS interpreter contract change.

- Rust ownership/allocation redesign.
  - User specifically suggested reducing "Arc madness" and heap allocations by using references/borrowing and possibly arenas.
  - Good candidate areas:
    - request `JsonBody` -> `JsonProtocolAdapter` -> `Selection` / `ArgumentValue` tree transitions.
    - query graph to expression translation where owned `String`, `Cow<'static, str>`, `BTreeMap`, and `Vec` allocations accumulate.
    - result-node/data-map construction.
  - This likely requires allocation profiling before patching, not guesswork.

- Direct `js_sys` / typed request parser.
  - Potentially valuable only if it avoids the owned Rust `JsonBody` / `serde_json::Value` request tree, not if it merely swaps `serde_json::from_str` for `serde_wasm_bindgen::from_value`.
  - Needs a design that preserves validation errors and query-plan cache semantics.

- More Cloudflare-specific memory measurement.
  - Current evidence is mostly Node/V8 local benchmarks.
  - Need a repeatable memory harness for edge bundle startup, Wasm instance, query compiler cache size, and representative query execution.

## Useful Commands

```sh
git status --short
git -C /home/aqrln.guest/prisma-engines status --short

pnpm --filter @prisma/client-engine-runtime test
pnpm --filter @prisma/client-engine-runtime build
pnpm --filter @prisma/client build
pnpm --filter @prisma/client test RequestHandler.test.ts --runInBand

pnpm exec tsx packages/client-engine-runtime/bench/interpreter.bench.ts
pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts
pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/query-performance.bench.ts

cd /home/aqrln.guest/prisma-engines
cargo test -p query-compiler --test queries
cargo check -p query-compiler-wasm --features postgresql
cargo bench -p query-compiler --bench compilation_bench -- "query-m2o|query-m2m|query-many|filter|nested"
PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm
```

## Hygiene Rules For Future Work

- Do not keep experiments unless benchmarks are neutral-to-positive on the relevant hot rows.
- Commit worthy results along the way.
- Revert rejected experiments fully.
- Keep this journal updated after each accepted change, rejected experiment, and new measurement.
- If Rust Wasm changes are kept, build the relevant Wasm package in `/home/aqrln.guest/prisma-engines`, then update Prisma with `pnpm upgrade -r @prisma/query-compiler-wasm@file:/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg`, and inspect any lockfile churn before keeping it.
