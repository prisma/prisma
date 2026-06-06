# Prisma Client Performance Journal

Date started: 2026-06-06

Objective: make Prisma Client materially faster and lower-memory, especially on Cloudflare Workers. The current focus is the local `ClientEngine` path with the Wasm query compiler and TypeScript query interpreter. Related Rust work lives in `/home/aqrln.guest/prisma-engines`.

## Current Baseline

- Prisma repo current relevant commits:
  - `ad49edcb6 Allow omitted result field type tags`
  - `eb652f538 Allow omitted result field db names`
  - `48d64e816 Add nested plan cache memory probe`
  - `dc8657d7f Accept compact SQL string fragments`
  - `10585f905 Record result field arity omission`
  - `af55854c7 Allow omitted result field arity`
  - `b26bf65d3 Split query plan cache memory probe sizes`
  - `fe3826c43 Add query plan cache memory probe`
  - `7474b3c3f Record query arg db type omission`
  - `e7684e6df Document query compiler phase timing`
  - `5745f952b Document query compiler request parsing path`
  - `247eeb701 Return native values from local client engine`
  - `45a9b05b9 Optimize single-key join attachment`
  - `ea639583f Document argument deserializer benchmark result`
  - `5d6e50460 Document ParamGraph node cache benchmark result`
  - `48e0b6fbd Skip chunk rebuild within parameter limit`
  - `cc7f692dd Inline SQL template chunk planning`
- Engines repo current relevant commits:
  - `04fdc54214a Omit result field type tags`
  - `af7c591f3c6 Omit default result field db names`
  - `dd03ee258c9 Serialize SQL string fragments compactly`
  - `1fe6a7c341b Omit non-list result field arity`
  - `78dfd45e838 Omit empty query arg db types`
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
  - `04fdc54214a Omit result field type tags`
    - Result field nodes inside result object `fields` now omit `type: "field"` and are identified by `fieldType` in the TypeScript data mapper. Legacy explicit `type: "field"` remains accepted.
    - Same-source local Wasm plan-size savings after default result-field `dbName` omission:
      - `findUnique`: 1,389 -> 1,239 bytes, saving 150 bytes.
      - `findMany filtered`: 1,506 -> 1,356 bytes, saving 150 bytes.
      - `findMany in filter`: 1,633 -> 1,483 bytes, saving 150 bytes.
      - `blog page`: 10,054 -> 9,484 bytes, saving 570 bytes.
    - Query-plan cache memory probe with local rebuilt Wasm moved retained serialized plan shape down:
      - Scalar selection / edge default warm: `planJsonRetained` 70.6 KiB -> 65.9 KiB.
      - Scalar selection / edge default churn: `planJsonRetained` 96.1 KiB -> 86.8 KiB.
      - Scalar selection / node default warm: `planJsonRetained` 848.5 KiB -> 776.2 KiB.
      - Blog page / edge default warm: `planJsonRetained` 907.7 KiB -> 866.4 KiB.
      - Blog page / edge default churn: `planJsonRetained` 927.7 KiB -> 881.8 KiB.
      - Blog page / node default warm: `planJsonRetained` 8.98 MiB -> 8.55 MiB.
    - Verification:
      - `cargo fmt -p query-compiler --check`
      - `cargo test -p query-compiler --test queries`
      - `cargo check -p query-compiler-wasm --features sqlite`
      - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`
      - `pnpm --filter @prisma/client-engine-runtime test`
      - `pnpm --filter @prisma/client-engine-runtime build`
      - `pnpm --filter @prisma/client build`
    - Benchmark gate with local rebuilt Wasm stayed in range:
      - `compile findUnique`: about 1,483 ops/sec.
      - `compile findMany filtered`: about 1,233 ops/sec.
      - `compile blog post page`: about 322 ops/sec.
  - `af7c591f3c6 Omit default result field db names`
    - Result field nodes now omit `dbName` when it matches the result field key. Prisma commit `eb652f538 Allow omitted result field db names` makes `dbName` optional and defaults it to the field key in the data mapper.
    - Explicit `dbName` remains serialized when SQL column names differ from the result field key.
    - Same-source local Wasm plan-size savings after compact SQL string fragments:
      - `findUnique`: 1,567 -> 1,389 bytes, saving 178 bytes.
      - `findMany filtered`: 1,684 -> 1,506 bytes, saving 178 bytes.
      - `findMany in filter`: 1,811 -> 1,633 bytes, saving 178 bytes.
      - `blog page`: 10,713 -> 10,054 bytes, saving 659 bytes.
    - Query-plan cache memory probe with local rebuilt Wasm moved retained serialized plan shape down:
      - Scalar selection / edge default warm: `planJsonRetained` 75.9 KiB -> 70.6 KiB, heap delta about 238.9 KiB.
      - Scalar selection / edge default churn: `planJsonRetained` 107.2 KiB -> 96.1 KiB, heap delta about 359.5 KiB.
      - Scalar selection / node default warm: `planJsonRetained` 934.3 KiB -> 848.5 KiB, heap delta about 2.51 MiB.
      - Blog page / edge default warm: `planJsonRetained` 952.8 KiB -> 907.7 KiB, heap delta about 2.48 MiB.
      - Blog page / edge default churn: `planJsonRetained` 979.1 KiB -> 927.7 KiB, heap delta about 2.52 MiB.
      - Blog page / node default warm: `planJsonRetained` 9.45 MiB -> 8.98 MiB, heap delta about 23.50 MiB.
    - Verification:
      - `cargo fmt -p query-compiler --check`
      - `cargo test -p query-compiler --test queries`
      - `cargo check -p query-compiler-wasm --features sqlite`
      - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`
      - `pnpm --filter @prisma/client-engine-runtime test`
      - `pnpm --filter @prisma/client-engine-runtime build`
      - `pnpm --filter @prisma/client build`
    - Benchmark gate with local rebuilt Wasm was acceptable after rerun:
      - First run was slightly low at about 1,432 / 1,214 / 313 compile ops/sec for `findUnique`, filtered `findMany`, and blog-page query.
      - Second run was back in range at about 1,503 / 1,260 / 328 compile ops/sec.
  - `dd03ee258c9 Serialize SQL string fragments compactly`
    - `DbQuery::TemplateSql.fragments` now serializes `Fragment::StringChunk` as a raw string. Other fragment variants (`parameter`, `parameterTuple`, `parameterTupleList`) keep the old tagged-object shape.
    - Prisma commit `dc8657d7f Accept compact SQL string fragments` makes the TypeScript query-plan type and renderer accept both raw string fragments and the legacy `{ type: 'stringChunk', chunk }` object.
    - Same-source local Wasm plan-size savings, measured after empty `dbType` and non-list field-arity omissions:
      - `findUnique`: 1,660 -> 1,567 bytes, saving 93 bytes.
      - `findMany filtered`: 1,808 -> 1,684 bytes, saving 124 bytes.
      - `findMany in filter`: 2,028 -> 1,811 bytes, saving 217 bytes.
      - `blog page`: 11,364 -> 10,713 bytes, saving 651 bytes.
    - Query-plan cache memory probe with local rebuilt Wasm moved retained serialized plan shape down:
      - Edge default warm: `planJsonRetained` 87.8 KiB -> 75.9 KiB, heap delta about 245.3 KiB.
      - Edge default churn: `planJsonRetained` 125.0 KiB -> 107.2 KiB, heap delta about 395.0 KiB.
      - Node default warm: `planJsonRetained` 1.06 MiB -> 934.3 KiB, heap delta about 2.74 MiB.
    - Verification:
      - `cargo fmt -p query-builder --check`
      - `cargo test -p query-compiler --test queries`
      - `cargo check -p query-compiler-wasm --features sqlite`
      - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`
      - `pnpm --filter @prisma/client-engine-runtime test`
      - `pnpm --filter @prisma/client-engine-runtime build`
      - `pnpm --filter @prisma/client build`
    - Benchmark gate with local rebuilt Wasm was neutral-to-positive:
      - `compile findUnique`: about 1,512 ops/sec.
      - `compile findMany filtered`: about 1,256 ops/sec.
      - `compile blog post page`: about 323 ops/sec.
  - `1fe6a7c341b Omit non-list result field arity`
    - `FieldType.arity` now serializes only for list fields; required/optional scalar result fields omit arity because the TS data mapper only branches on `arity === 'list'`.
    - Prisma commit `af55854c7 Allow omitted result field arity` makes `FieldType.arity` optional in the query-plan type.
    - Same-source local Wasm plan-size savings:
      - `findUnique`: 1,850 -> 1,660 bytes, saving 190 bytes.
      - `findMany filtered`: 1,998 -> 1,808 bytes, saving 190 bytes.
      - `findMany in filter`: 2,218 -> 2,028 bytes, saving 190 bytes.
      - `blog page`: 12,086 -> 11,364 bytes, saving 722 bytes.
    - Verification:
      - `cargo test -p query-compiler --test queries`
      - `cargo check -p query-compiler-wasm --features sqlite`
      - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts`
      - `pnpm --filter @prisma/client-engine-runtime test`
      - `pnpm --filter @prisma/client-engine-runtime build`
      - `pnpm --filter @prisma/client build`
    - Benchmark gate with local rebuilt Wasm was neutral-to-positive:
      - `compile findUnique`: about 1,440 ops/sec.
      - `compile findMany filtered`: about 1,229 ops/sec.
      - `compile blog post page`: about 323 ops/sec.
  - `78dfd45e838 Omit empty query arg db types`
    - `ArgType.db_type: None` now uses `#[serde(skip_serializing_if = "Option::is_none")]`.
    - This removes `dbType: null` from JS-visible query-plan `argTypes`; `@prisma/driver-adapter-utils` already models `dbType` as optional.
    - Same-source local Wasm plan-size savings:
      - `findUnique`: 1,892 -> 1,850 bytes, saving 42 bytes.
      - `findMany filtered`: 2,054 -> 1,998 bytes, saving 56 bytes.
      - `findMany in filter`: 2,316 -> 2,218 bytes, saving 98 bytes.
      - `blog page`: 12,380 -> 12,086 bytes, saving 294 bytes.
    - Verification:
      - `cargo test -p query-compiler --test queries`
      - `cargo check -p query-compiler-wasm --features sqlite`
      - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
      - `LOCAL_QC_BUILD_DIRECTORY=/home/aqrln.guest/prisma-engines/query-compiler/query-compiler-wasm/pkg pnpm exec tsx packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts`
      - `pnpm --filter @prisma/client-engine-runtime test render-query.test.ts`
      - `pnpm --filter @prisma/client build`
    - Benchmark gate with local rebuilt Wasm was neutral-to-positive:
      - `compile findUnique`: about 1,466 ops/sec.
      - `compile findMany filtered`: about 1,236 ops/sec.
      - `compile blog post page`: about 320 ops/sec.
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

- Direct scans instead of result-node construction maps.
  - Rust side replaced short-lived `HashMap`s in `query-compiler/src/data_mapper.rs` (`field_map`, grouped virtuals, `nested_map`) with direct scans over the small field/nested-query slices.
  - Allocation profile improved only slightly in `translate`: common representative queries saved about 1-3 allocations and about 140-520 allocated bytes.
  - `cargo test -p query-compiler --test queries` passed.
  - Native Criterion compile benchmark was mostly neutral, but `compile/update-set-nested` regressed:
    - `112.63-114.25 us`, change about `+1.11%` to `+2.62%`, Criterion reported "Performance has regressed."
  - Reverted. The small allocation savings do not justify the regression on a nested write shape.

- Avoid result-scope binding-name vector in `translate.rs`.
  - Rust side avoided collecting all result-node refs and all result binding names in `NodeTranslator::fold_result_scopes` for the single-result-node case.
  - `cargo test -p query-compiler --test queries` passed.
  - Native Criterion compile benchmark rejected it:
    - `compile/query-m2m` regressed by about `+1.46%` to `+2.39%`.
    - `compile/query-m2o` regressed by about `+1.34%` to `+2.59%`.
    - Nested update rows were neutral, but read regressions are not acceptable.
  - Reverted. This confirms small allocation-looking changes in translation can still perturb hot compile rows enough to lose.

- `serde_wasm_bindgen::from_value` as a direct replacement for string JSON request parsing.
  - Investigation showed it only removes JS-side parsing/copying unless the Rust request parser is redesigned.
  - Current Rust path deserializes request strings into `JsonBody`, including owned `IndexMap` and `serde_json::Value`, then `JsonProtocolAdapter` walks the tree again into `ArgumentValue`/`Selection`.
  - Release-Wasm phase probe showed JSON request decoding is only about 4-7 microseconds, roughly 4-6% of internal compile+serialize time.
  - Treat as low-ceiling unless combined with removing the owned `JsonBody`/`serde_json::Value` tree and/or the query-plan cache stringify path.

- Compact single-parameter SQL fragments as `0`.
  - Built on the accepted raw-string fragment shape and serialized `Fragment::Parameter` as numeric sentinel `0`, while keeping tuple fragments as tagged objects.
  - Focused checks passed:
    - `cargo fmt -p query-builder && cargo test -p query-compiler --test queries`
    - `cargo check -p query-compiler-wasm --features sqlite`
    - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
    - `pnpm --filter @prisma/client-engine-runtime test render-query.test.ts query-interpreter.test.ts`
  - Same-source local Wasm plan sizes improved as expected:
    - `findUnique`: 1,567 -> 1,510 bytes, saving 57 bytes.
    - `findMany filtered`: 1,684 -> 1,608 bytes, saving 76 bytes.
    - `findMany in filter`: 1,811 -> 1,678 bytes, saving 133 bytes.
    - `blog page`: 10,713 -> 10,352 bytes, saving 361 bytes.
  - Benchmark gate failed:
    - `compile findUnique`: about 1,330 ops/sec, down from about 1,512.
    - `compile findMany filtered`: about 1,133 ops/sec, down from about 1,256.
    - `compile blog post page`: about 300 ops/sec, down from about 323.
  - Reverted. The additional byte savings do not justify the Wasm compile regression and less-readable sentinel representation.

- Compact result field nodes as `[dbName, fieldType]`.
  - Rust side manually serialized `ResultNode::Field` as a two-element array while keeping object and affected-row nodes compatible.
  - TypeScript side accepted tuple field nodes in `data-mapper.ts` without normalizing them into duplicate objects, so cached plans would keep the compact shape.
  - Focused checks passed:
    - `cargo fmt -p query-compiler && cargo test -p query-compiler --test queries`
    - `cargo check -p query-compiler-wasm --features sqlite`
    - `PATH="/tmp/prisma-build-tools:$PATH" make build-qc-wasm`
    - `pnpm --filter @prisma/client-engine-runtime test data-mapper.test.ts query-interpreter.test.ts`
  - Same-source local Wasm plan sizes improved substantially:
    - `findUnique`: 1,567 -> 1,207 bytes, saving 360 bytes.
    - `findMany filtered`: 1,684 -> 1,324 bytes, saving 360 bytes.
    - `findMany in filter`: 1,811 -> 1,451 bytes, saving 360 bytes.
    - `blog page`: 10,713 -> 9,345 bytes, saving 1,368 bytes.
  - Benchmark gate failed even after replacing the initial helper-struct/`flatten` serializer with direct `SerializeStruct`:
    - Direct serializer `compile findUnique`: about 1,380 ops/sec, down from about 1,512.
    - Direct serializer `compile findMany filtered`: about 1,158 ops/sec, down from about 1,256.
    - Direct serializer `compile blog post page`: about 297 ops/sec, down from about 323.
  - Reverted. This suggests array-shaped field nodes or manual result-node serialization are slower through the Wasm/`serde_wasm_bindgen` compile path despite the smaller JS-visible plan.

- Omit `templateSql.chunkable: false`.
  - Measured before patching.
  - Representative local Wasm output after compact string fragments had only one `chunkable: false` template in filtered `findMany` and one in the blog-page query; `findUnique` and `findMany in filter` had only `chunkable: true` templates.
  - Ceiling was 18 bytes on filtered `findMany`, 18 bytes on the blog-page query, and 0 bytes on the other measured plans.
  - Dropped without implementation.

- Compact scalar `fieldType` objects as strings.
  - Measured after result field `type` tag omission, before patching.
  - All representative result field types were compactable single-key objects such as `{ "type": "int" }`.
  - Estimated JSON size savings:
    - `findUnique`: 1,239 -> 1,149 bytes, saving 90 bytes.
    - `findMany filtered`: 1,356 -> 1,266 bytes, saving 90 bytes.
    - `findMany in filter`: 1,483 -> 1,393 bytes, saving 90 bytes.
    - `blog page`: 9,484 -> 9,142 bytes, saving 342 bytes.
  - Not patched yet. This likely needs either direct-result-set mapping normalization or carefully benchmarked `typeof fieldType === "string"` handling in the hot value mapper.

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
  - This was tried later and rejected because `caching.bench.ts` compile rows regressed.

- Empty `ArgType.dbType` omission:
  - Same-source local Wasm A/B showed removing absent native DB type metadata from query-plan `argTypes` saves 42-98 bytes on common read plans and 294 bytes on the blog-page plan.
  - Unlike the rejected `placeholderFormat` omission, this does not require provider-default resolution in the interpreter: `dbType` is already optional in the adapter-facing TypeScript type.
  - `caching.bench.ts` with the rebuilt local Wasm was neutral-to-positive on compile rows: about 1,466 / 1,236 / 320 ops/sec for `findUnique`, filtered `findMany`, and blog-page query.

- Non-list `FieldType.arity` omission:
  - Same-source local Wasm A/B showed omitting required/optional result-field arity saves 190 bytes on common read plans and 722 bytes on the blog-page plan.
  - This is safe because `packages/client-engine-runtime/src/interpreter/data-mapper.ts` only branches on `fieldType.arity === 'list'`; omitted arity is interpreted as non-list.
  - `caching.bench.ts` with rebuilt local Wasm was neutral-to-positive on compile rows: about 1,440 / 1,229 / 323 ops/sec for `findUnique`, filtered `findMany`, and blog-page query.

- Compact `templateSql` string fragments:
  - `StringChunk` fragments are now raw strings in query-plan `templateSql.fragments`.
  - Parameter and tuple fragments intentionally remain tagged objects for now; this kept the renderer change small and avoided overloading array/number sentinel values.
  - Same-source local Wasm output had zero `stringChunk` tags in representative plans and saved 93 / 124 / 217 / 651 bytes on `findUnique`, filtered `findMany`, `findMany in filter`, and the blog-page query.
  - `caching.bench.ts` with rebuilt local Wasm was neutral-to-positive on compile rows: about 1,512 / 1,256 / 323 ops/sec.
  - The query-plan-cache memory probe showed retained plan JSON down to 75.9 KiB for 100 warm edge entries and 934.3 KiB for 1,000 warm node entries.

- Default result field `dbName` omission:
  - Field nodes omit `dbName` when the SQL/result column name matches the field key in the surrounding result-object map.
  - Same-source local Wasm output kept explicit `dbName` only for the two non-default blog-page fields in the representative nested plan.
  - Plan-size savings were 178 bytes on common read plans and 659 bytes on the blog-page plan.
  - The second `caching.bench.ts` gate was in range/slightly positive on compile rows: about 1,503 / 1,260 / 328 ops/sec.
  - The query-plan-cache memory probe showed retained plan JSON down to 848.5 KiB for 1,000 warm scalar-selection entries and 8.98 MiB for 1,000 warm blog-page entries.

- Result field `type` tag omission:
  - Field nodes inside object `fields` omit `type: "field"` and are recognized by `fieldType`; explicit field tags remain accepted.
  - Plan-size savings were 150 bytes on common read plans and 570 bytes on the blog-page plan.
  - `caching.bench.ts` with rebuilt local Wasm stayed in range on compile rows: about 1,483 / 1,233 / 322 ops/sec.
  - The query-plan-cache memory probe showed retained plan JSON down to 776.2 KiB for 1,000 warm scalar-selection entries and 8.55 MiB for 1,000 warm blog-page entries.

- Query plan cache memory probe:
  - Added `packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`.
  - Run with:
    - `pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`
  - The probe warms the sqlite Wasm query compiler, compiles unique `User.findMany` scalar-selection shapes, stores the resulting plans in `QueryPlanCache`, and reports forced-GC heap deltas.
  - Stable local Node/V8 results:
    - Cache disabled, 1,000 compiles, 0 retained: heap delta about 56.2 KiB.
    - Edge default warm, 100 compiles, 100 retained: heap delta about 258.9-263.3 KiB; about 2.6 KiB heap per retained entry; about 7.6 KiB retained cache-key strings and 87.8 KiB retained serialized plan shape.
    - Edge default churn, 1,000 compiles, 100 retained: heap delta about 404.5-413.3 KiB; about 4.0-4.1 KiB heap per retained entry; about 12.3 KiB retained cache-key strings and 125.0 KiB retained serialized plan shape.
    - Node default warm, 1,000 compiles, 1,000 retained: heap delta about 2.88-2.91 MiB; about 2.9-3.0 KiB heap per retained entry; about 101.9 KiB retained cache-key strings and 1.06 MiB retained serialized plan shape.
  - After compact SQL string fragments, the committed probe also covers nested blog-page plans with varying selected Post scalar fields:
    - Scalar selection / edge default warm: heap delta about 248.5 KiB, retained plan JSON about 75.9 KiB.
    - Scalar selection / edge default churn: heap delta about 395.1 KiB, retained plan JSON about 107.2 KiB.
    - Scalar selection / node default warm: heap delta about 2.74 MiB, retained plan JSON about 934.3 KiB.
    - Blog page / edge default warm: heap delta about 2.61 MiB, about 26.7 KiB heap per retained entry, retained cache-key strings about 48.3 KiB, retained plan JSON about 952.8 KiB.
    - Blog page / edge default churn: heap delta about 2.65 MiB, about 27.2 KiB heap per retained entry, retained cache-key strings about 53.5 KiB, retained plan JSON about 979.1 KiB.
    - Blog page / node default warm: heap delta about 24.82 MiB, about 25.4 KiB heap per retained entry, retained cache-key strings about 512.2 KiB, retained plan JSON about 9.45 MiB.
  - Follow-up key-size split:
    - Scalar-selection cache-key strings were only about 7.9-8.9% of retained serialized shape.
    - The committed nested blog-page scenarios show retained cache-key strings at about 4.8-5.2% of retained serialized cache-key-plus-plan shape.
    - Conclusion: shortening or hashing stored cache keys is low ceiling under current plan shape and not worth a correctness-sensitive cache-key semantics change yet. Plan objects / serialized plan shape still dominate.
  - This confirms the edge default cache size materially caps retained plan memory for simple unique plans. It is still a Node/V8 proxy, not a true workerd isolate measurement.

- Temporary native allocation profiler over query compiler phases:
  - Implemented as a temporary `query-compiler` example with a counting global allocator, then removed.
  - It measured per-iteration allocation counts/bytes for parse, `into_doc`, graph build, translate, simplify, and native JSON serialization.
  - Key results for representative fixtures:
    - `parse`: about 20-38 allocations and 2-4 KB.
    - `into_doc`: about 44-73 allocations and 4.8-9.4 KB.
    - `build_graph`: about 192-305 allocations / 48-59 KB for common reads; about 479 allocations / 81 KB for nested create; about 732 allocations / 146 KB for nested update.
    - `translate`: about 160-465 allocations / 16-53 KB for reads; about 678 allocations / 84 KB for nested create; about 1,303 allocations / 146 KB for nested update.
    - `simplify`: zero allocations in the measured fixtures.
    - native `serde_json` plan serialization: about 8-52 allocations / 2.3-35 KB.
  - Conclusion: native request parsing/adaptation is small relative to graph build and translation. Allocation-reduction work should profile `query-core` graph construction and query-compiler translation internals before broad ownership redesigns.

## Leads To Try Next

- Plan serialization shape.
  - The tagged object tree is verbose and `serde_wasm_bindgen` plan serialization is a large release-Wasm phase.
  - Compact raw string fragments are now kept; remaining compact-shape candidates should be gated because previous default-field omissions had mixed throughput.
  - Larger possible directions:
    - Compact representation for hot `Expression` variants.
    - Compact representation for tuple and tuple-list SQL fragments if a readable and type-safe TS representation can be found.
    - Compact result field metadata only if a different representation can avoid the Wasm compile regression seen with tuple field nodes.
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

- Radical JS-reference-backed query compiler pipeline.
  - User idea: do not create/own input query data or built SQL strings on the Rust heap; only internal IRs should be Rust-owned. Use wrapper types such as `PrismaString` that can wrap native Rust strings in unit tests and external JS strings/objects in Wasm.
  - Practicality assessment: potentially practical as a project-level redesign, but not as a narrow `serde_wasm_bindgen` substitution. Wrapper types help only if request parsing, schema lookup, validation, SQL rendering, and cache-key generation are all changed to consume borrowed/input-backed values instead of immediately converting into owned `String`/map trees.
  - Potential shape:
    - Client passes the query object as a single JS reference into Wasm.
    - Rust parameterizes and cache-keys by walking JS objects without cloning the whole request into Wasm memory.
    - Query plan cache lives in Rust/Wasm and returns an existing JS query-plan object on hit, or compiles and caches on miss.
    - Wasm reference types / `JsValue` handles carry JS-owned query values and cached plan objects across the boundary.
  - Potential upside:
    - Removes JS-side `JSON.stringify`/cache-key work and Rust-side `JsonBody`/`serde_json::Value` ownership at the same time.
    - Could reduce retained duplicated query/request data on Cloudflare Workers.
    - Could make parameterization and query-plan caching one pass instead of separate JS parameterization + stringify + Rust parse/adapt.
  - Main risks/questions:
    - Current `query-core` request parsing and graph building expect owned/cloneable Rust values (`String`, `ArgumentValue`, `PrismaValue`, `Selection`, maps); a real zero-copy path likely requires broad trait/lifetime/arena redesign, not a Wasm entrypoint tweak.
    - Rust schema lookup currently wants Rust string keys; comparing JS strings without copying may require interned IDs, JS-side maps, or a custom abstraction.
    - Caching by JS object identity is unsafe if user query objects are mutable; structural hashing over JS objects without copying is possible but must be deterministic and preserve current cache semantics.
    - Storing `JsValue`/externref handles in Rust caches needs careful lifetime/GC behavior and Cloudflare Workers compatibility verification.
    - Not building SQL strings on Rust heap would require a lower-level SQL/template IR and JS-side or driver-side final rendering, which is much broader than request parsing.
  - Treat as a project-level design/spike candidate. First useful proof would be a small Wasm prototype that walks a JS query object, computes the existing parameterization cache key, and returns placeholder refs without materializing `serde_json::Value`; second proof would compile a tiny read query into an IR that keeps SQL template strings external until final driver execution.

- More Cloudflare-specific memory measurement.
  - Current evidence is still mostly Node/V8 local benchmarks.
  - First repeatable query-plan-cache retention probe exists at `packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`.
  - Remaining gap: a true workerd/miniflare memory harness for edge bundle startup, Wasm instance memory, query compiler cache size, and representative query execution.

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
pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts

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
