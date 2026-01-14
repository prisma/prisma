# Task Breakdown

## Phase 1: Types and Config

1. **ParamGraph types**
   - Add `ParamGraph` types in `packages/client-common/src/parameterizationSchema.ts`.
   - Export from `packages/client-common/src/index.ts`.

2. **Client config plumbing**
   - Extend `GetPrismaClientConfig` in `packages/client-common/src/client-config.ts`
     with optional `parameterizationSchema?: ParamGraph`.

## Phase 2: Generator (TS + JS)

3. **Build ParamGraph from DMMF**
   - New utility in each generator:
     - `packages/client-generator-ts/src/utils/buildParamGraph.ts`
     - `packages/client-generator-js/src/utils/buildParamGraph.ts`
   - Implement steps from `03-schema-generation.md`.
   - Use a `ParamGraphBuilder` helper to keep generator logic readable while
     writing directly into the compact graph.

4. **Embed graph in generated client**
   - TS generator: `packages/client-generator-ts/src/TSClient/file-generators/ClassFile.ts`
   - JS generator: `packages/client-generator-js/src/TSClient/TSClient.ts`
   - Attach `config.parameterizationSchema = <json>` after runtimeDataModel.

## Phase 3: Runtime Parameterizer

5. **Parameterization module**
   - New module:
     - `packages/client/src/runtime/core/engines/client/parameterization/`
     - `classify.ts` for value classification
     - `traverse.ts` for ParamGraph traversal
     - `paramGraphView.ts` for the runtime view wrapper
     - `index.ts` for exports
   - Keep `parameterize.ts` as a thin wrapper (schema-aware + legacy fallback).

6. **ClientEngine integration**
   - Update `packages/client/src/runtime/core/engines/client/ClientEngine.ts` to
     pass the `ParamGraphView` into parameterizeQuery/parameterizeBatch.

7. **getPrismaClient plumbing**
   - Update `packages/client/src/runtime/getPrismaClient.ts` to build
     `ParamGraphView` once (using `config.parameterizationSchema` and
     `config.runtimeDataModel`) and pass it into the engine config.

## Phase 4: Tests

8. **Generator unit tests**
   - Add tests in `packages/client-generator-*/src/utils/buildParamGraph.test.ts`
     for union handling, enum tables, and pruning.

9. **Runtime unit tests**
   - `packages/client/src/runtime/core/engines/client/parameterization/*.test.ts`
     for classification and traversal rules.

10. **Integration tests**
    - New suite under `packages/client/tests/functional/parameterization/`
      to validate cache key behavior across different query shapes.

## Phase 5: Performance and Validation

11. **Benchmarks**
    - Add a micro-benchmark in `packages/client/src/__tests__/benchmarks/`
      to compare legacy vs ParamGraph parameterization.

12. **Size check**
    - Emit ParamGraph as JSON and measure typical size to confirm it stays small.
