# Slice 2 brief: the ORM reads its row types from the emitted models

_Status: draft for hand-off to an implementer. Follows PR #30231 (TML-3233). Grounded 2026-09-09._

## What this slice changes, in one screen

Today the ORM computes a model's row type from the contract's field and relation IR, and the emitter computes `Models.public_User` from the same IR by a separate path. Type tests prove they agree for every fixture model. After this slice, the ORM reads the emitted model and there is one computation:

```ts
// what a user sees on hover, after this slice
const user = await db.orm.public.User.first();
//    ^? Scalars<Models.public_User> | null

const withPosts = await db.orm.public.User.include('posts').first();
//    ^? With<Models.public_User, 'posts'> | null   (or the equivalent flattened shape)
```

The mechanism: the emitted `Models` map travels into the contract type through `TypeMaps`, the same way `FieldOutputTypes` does today, and the ORM's `DefaultModelRow` becomes an indexed access on it wrapped in `Scalars`.

## Why

- **Structural equivalence instead of tested equivalence.** After this slice the ORM's rows and the emitted models cannot drift, because the ORM has no second computation. The equality type tests from slice 1 stay as a check on the emitter, not on agreement between two things.
- **Readable types.** `Scalars<Models.public_User>` on hover names the thing the docs talk about. Today hover shows an expanded object.
- **Less type machinery in the ORM.** `FieldsOf`, `FieldJsType`, `VariantRow`, and the relation-cardinality lookups in `sql-orm-client/src/types.ts` exist to rebuild what the emitter already wrote down.

## Where things stand (grounded)

- `TypeMaps` in `packages/2-sql/1-core/contract/src/types.ts` is a positional generic over seven maps (`codecTypes`, `queryOperationTypes`, `fieldOutputTypes`, `fieldInputTypes`, `storageColumnTypes`, `storageColumnInputTypes`, `aggregateTypes`), attached to the contract as an optional phantom property under `TypeMapsPhantomKey`. `ExtractTypeMapsFromContract<T>` reads it back; `FieldOutputTypesOf<T>` and the `Extract*` family index into it and return `Record<string, never>` when absent.
- The Mongo family has the same arrangement with three maps: `MongoTypeMaps<TCodecTypes, TFieldOutputTypes, TFieldInputTypes>` in `packages/2-mongo-family/1-foundation/mongo-contract/src/contract-types.ts`, with `ExtractMongoFieldOutputTypes<T>` and `MongoUnboundFieldOutputTypes<T>`.
- The emitter writes the `TypeMaps` expression per family: `getTypeMapsExpression()` in `packages/2-sql/3-tooling/emitter/src/index.ts` returns `TypeMapsType<CodecTypes, QueryOperationTypes, FieldOutputTypes, FieldInputTypes, StorageColumnTypes, StorageColumnInputTypes, AggregateTypes>`; the Mongo hook returns `MongoTypeMaps<CodecTypes, FieldOutputTypes, FieldInputTypes>`. The `Models` namespace and `models` constant are emitted after the contract wrapper by `packages/1-framework/3-tooling/emitter/src/model-types-emission.ts`.
- The ORM already has a "read the emitted map first, derive otherwise" pattern: `FieldJsType` in `packages/3-extensions/sql-orm-client/src/types.ts` reads `NamespaceFieldOutputType` from `TypeMaps` and falls back to `FieldStorageJsType` when that is `never`. The no-emit flow, where there is no `contract.d.ts`, relies on that fallback today.
- `Scalars`, `With`, and `RelationKeys` live in `packages/1-framework/1-core/framework-components/src/execution/model-types.ts`.
- Slice 1's type tests in `packages/3-extensions/sql-orm-client/test/model-types.test-d.ts`, `packages/2-mongo-family/5-query-builders/orm/test/model-types.test-d.ts`, and `examples/prisma-8-demo/test/demo-dx.types.test.ts` assert equality between ORM rows and `Scalars`/`With` of the emitted models. They are the acceptance tests for this slice and must keep passing unchanged.

## The design

### 1. `Models` becomes a `TypeMaps` slot

SQL: `TypeMaps` gains an eighth parameter, `TModels extends NamespacedModelMap = Record<string, never>`, stored as `readonly models: TModels`. `NamespacedModelMap` is `Record<string, Record<string, unknown>>`, keyed namespace then model, the same shape as `NamespacedFieldTypeMap`. Add `ModelsOf<T>` beside `FieldOutputTypesOf<T>` and `ExtractModels<T>` beside `ExtractFieldOutputTypes<T>`, following their exact spelling and `Record<string, never>` fallback.

Mongo: `MongoTypeMaps` gains a fourth parameter the same way, with `ExtractMongoModels<T>` and `MongoUnboundModels<T>` beside the field-output equivalents.

The emitter's two `getTypeMapsExpression()` hooks append `Models` as the last argument, where `Models` is a new top-level type alias the emitter writes: `export type ModelsMap = { public: { User: Models.public_User; ... } }`. It has the same entries as the `models` constant; the constant is then declared as `export declare const models: ModelsMap`. The `Models` namespace, `ModelsMap`, and `models` are emitted before the `TypeMaps` line, which means the model-types block moves from after the contract wrapper to before `TypeMaps`. TypeScript hoists type-only declarations, so order is for readers, not the compiler.

### 2. The ORM indexes into it

SQL, in `packages/3-extensions/sql-orm-client/src/types.ts`:

- `EmittedModel<TContract, ModelName, NsId>` = `ExtractModels<TContract>[ResolvedNsId][ModelName]` when that resolves to an object type, else `never`. Namespace resolution reuses `ResolvedNsId`, which already picks the single namespace containing the model when `NsId` is `never`.
- `DefaultModelRow<TContract, ModelName, NsId>` = `[EmittedModel<...>] extends [never] ? <today's derivation> : Scalars<EmittedModel<...>>`. Today's derivation is kept verbatim as the fallback, renamed `DerivedModelRow`, and is the only path in the no-emit flow.
- `VariantModelRow<TContract, Base, Variant, NsId>` = `Scalars<EmittedModel<TContract, Variant, NsId>>` when present, else today's derivation.
- `InferRootRow<TContract, Base, NsId>` for a polymorphic base = `Scalars<EmittedModel<TContract, \`Any${Base}\`, NsId>>` when present, else today's derivation. The `Any<Base>` key is present in `ModelsMap` because the constant has it.
- `IncludeRelationValue` keeps its cardinality and nullability logic but resolves the related row through `DefaultModelRow`, so it inherits the emitted path. No change to `include()`'s signature or to refinement typing.

Mongo, in `packages/2-mongo-family/5-query-builders/orm/src/types.ts`: the same three substitutions on `InferFullRow`, `VariantModelRow`, and `InferRootRow`, reading `ExtractMongoModels`. Embeds are already inside the emitted model, so `Scalars` of it equals today's `InferFullRow` by slice 1's tests.

### 3. What must stay true

- Every slice 1 type test passes unchanged. They are the acceptance criteria.
- The no-emit demo paths in `examples/prisma-8-demo/src/prisma-no-emit/` and the no-emit type tests in `demo-dx.types.test.ts` pass unchanged, proving the fallback.
- A new type test per family proves the emitted path is actually taken: with the fixture contract, `DefaultModelRow<C, 'User'>` is assignable to and from `Scalars<Models.public_User>` (already true) and, with a synthetic contract whose `TypeMaps` has `models` but whose storage IR is deliberately wrong for one field, `DefaultModelRow` follows `models`, not storage. That is the one test that can only pass if the ORM reads the emitted map.
- `pnpm fixtures:check` regenerates every fixture, since `TypeMaps` and the block order change. `contract.json` does not change.

### 4. Out of scope

- Deleting the fallback derivation. The no-emit flow needs it.
- Changing `With`, `Scalars`, or the emitted member naming.
- Hover-text assertions. There is no way to test what an editor displays; the brief's hover example is the expected outcome, and the implementer reports what a hover in the demo actually shows.

## Risks

- **Type-instantiation depth.** Indexing `ExtractModels<C>[ns][M]` is cheaper than today's derivation, but the recursive model types (`User.posts: Post[]`, `Post.author: User`) now enter the ORM's generics. If TypeScript reports excessive depth in `sql-orm-client`'s type tests, the fix is to keep `Scalars` shallow (it already strips relations at one level) and to make sure nothing in the ORM maps over a model's relation fields.
- **Alias display.** Whether hover shows `Scalars<Models.public_User>` or the expanded object depends on TypeScript keeping the alias through the indexed access. It usually does when the map leaf is an alias reference, which `ModelsMap` guarantees. If it does not, the structural guarantee still holds; only the readability goal is missed.
- **Mongo namespace resolution.** `MongoUnboundModels` mirrors `MongoUnboundFieldOutputTypes`, which assumes `__unbound__`. Namespaced Mongo contracts go through `ExtractMongoModels<T>[ns]` directly, matching how the Mongo ORM resolves fields today.

## Hand-off checklist for the implementer

1. Read this brief, `design-brief.md`, `spec.md` § Decisions, and the slice 1 type tests.
2. Write the "emitted path is taken" type tests first and watch them fail.
3. Add the `TypeMaps` slot and extractors, then the emitter changes, then `pnpm build`, `pnpm install`, `pnpm fixtures:check`.
4. Switch the ORM derivations. Run every slice 1 type test.
5. Run `pnpm test:packages`, `pnpm test:integration`, `pnpm lint:deps`, and the demo's typecheck.
6. Report the hover text observed in `examples/prisma-8-demo` for `db.orm.public.User.first()`.
