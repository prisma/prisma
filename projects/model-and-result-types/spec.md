# Model and result types

**Linear project:** [Model and result types](https://linear.app/prisma-company/project/model-and-result-types-080d7caa544f)
**Design brief:** `./design-brief.md` (agreed with Serhii 2026-09-08). This spec turns the brief into binding decisions. Where the brief left a name open, this spec picks one so implementation can proceed; the pick is recorded under § Decisions and can be changed in review.

## Purpose

Users can name their model types, the scalar row a default fetch returns, a view with relations, and the result of any ORM query, using types Prisma 8 emits or exports. The Prisma 7 questions "where is `Prisma.User`" and "where is `BookGetPayload`" have direct answers.

## At a glance

```ts
import type { models, Models } from './prisma/contract';
import type { Scalars, With } from '@prisma/orm-postgres/family-contract/types';
import type { ResultType } from '@prisma/orm-postgres/components/runtime';

type User = typeof models.public.User;          // the model: every field and relation
type AlsoUser = Models.public_User;             // same type, importable name
type UserRow = Scalars<User>;                   // what db.User.first() returns
type UserWithPosts = With<User, 'posts'>;       // Scalars<User> & { posts: Scalars<Post>[] }

export const usersWithPosts = db.User.include('posts');
export type SameThing = ResultType<typeof usersWithPosts>;   // equals UserWithPosts
```

## Where things stand (grounded 2026-09-08)

- `contract.d.ts` is rendered by `packages/1-framework/3-tooling/emitter/src/generate-contract-dts.ts`. Field type lines come from `generateBothFieldTypesMaps` in `domain-type-generation.ts`, which renders `readonly <field>: <type>` per model. Family hooks in `packages/2-sql/3-tooling/emitter/src/index.ts` and `packages/2-mongo-family/3-tooling/emitter/src/index.ts` supply `getFamilyImports` and `getContractWrapper`.
- Relation cardinality is a contract fact: each relation carries `cardinality` (`'1:1' | 'N:1' | '1:N' | 'N:M'` on SQL; `'1:1' | '1:N' | 'N:1'` on Mongo), `to`, and `on.localFields` / `on.targetFields`. The SQL ORM derives to-one nullability from the storage table's foreign keys and column nullability (`IsToOneRelationNullable` in `packages/3-extensions/sql-orm-client/src/types.ts`).
- The SQL ORM's root row is `InferRootRow` (a discriminated union for a polymorphic base); `.variant(V)` rows are `VariantModelRow`. The Mongo ORM's root row is `InferFullRow` (embeds always present). Neither collection carries a `_row` marker, so `ResultType` returns `never` on them.
- `ResultType<P>` in `packages/1-framework/1-core/framework-components/src/execution/query-plan.ts` reads an optional `_row` property.
- `UNBOUND_NAMESPACE_ID` is `'__unbound__'`. A Postgres contract may hold `__unbound__` and named-schema models together. `db.enums` and the contract views keep every namespace id explicit.
- 333 `contract.d.ts` fixtures exist under `test/`, `examples/`, and package test folders. `pnpm fixtures:check` regenerates and diffs them (install, build, install again, then check).

## Non-goals

- No change to `FieldOutputTypes`, `FieldInputTypes`, or `TypeMaps`.
- No selection language. `With` takes relation names only.
- No `db.models` runtime accessor. No bare top-level `export type User`.
- No rename of `ResultType` in this project (open question in the brief, handled separately if agreed).
- No nesting in `With` (one level).
- No runtime behaviour change.

## Decisions

### Emitted output

After `FieldInputTypes` (and any family storage-type exports) and immediately before `TypeMaps`, `contract.d.ts` gains one block, rendered by the framework emitter for both families:

```ts
export namespace Models {
  export type public_User = {
    id: CodecTypes['pg/int4@1']['output'];
    name: CodecTypes['pg/text@1']['output'];
    posts: public_Post[];
    profile: public_Profile | null;
    readonly [RelationKeys]?: 'posts' | 'profile';
  };
  // one member per model, then per polymorphic base one union member
  export type public_AnyTask = public_Bug | public_Feature | public_Epic;
}

export declare const models: {
  public: {
    User: Models.public_User;
    Task: Models.public_Task;
    Bug: Models.public_Bug;
    AnyTask: Models.public_AnyTask;
  };
  __unbound__: {
    Audit: Models.unbound_Audit;
  };
};
```

- **Member name** is `<nsSegment>_<ModelName>`. `nsSegment` is the namespace id verbatim, except `__unbound__` becomes `unbound`. Separator is `_`.
- **Namespace segment.** The segment is present on every target that has a namespace mechanism, so Postgres emits `unbound_User` for a default-schema model (because `public.User` can sit beside it) and Mongo keeps its segment. On a target whose descriptor declares `namespaceSupport: 'none'` (SQLite today), the member name is the bare model name (`Models.User`) and the `models` constant nests models directly under the root (`models.User`, no `__unbound__` key). The decision is read from the target descriptor's `namespaceSupport` field, threaded through `EmitOptions.namespaceSupport` into `GenerateContractTypesOptions`, never from a switch on the target id and never from the number of namespaces in a contract, so adding a schema later never renames a type. A target that declares nothing keeps the segment.
- **Field lines** use the same resolver as `FieldOutputTypes` (`resolveFieldType` with the same codec lookup, type-param resolver, and value-set resolver), without `readonly`, in declaration order.
- **Relation lines** follow the fields, in declaration order. Type is the related model's member; when the related model is a polymorphic base, the type is its `Any<Base>` member, because the ORM returns the variant union for such includes (settled after dispatch 2). Wrapper by cardinality: `'1:N'` and `'N:M'` give `X[]`; `'1:1'` and `'N:1'` give `X` or `X | null`. `| null` applies exactly when the relation's `nullable` flag in the contract is true (settled 2026-09-09; see § "Relation nullability is a contract fact"). A relation whose target model is not in this contract (cross-space, emitted as `never` today in the ORM) is omitted from the member and from `RelationKeys`.
- **Phantom** is the last line: `readonly [RelationKeys]?: 'a' | 'b'`, or `readonly [RelationKeys]?: never` when the model has no relations. Mongo embedded models (those with an `owner`) carry no phantom line, so that `Scalars` of the owner's embed field equals the ORM's embed row.
- **Polymorphism.** The base member has the base's own fields and relations, with the discriminator field typed as the union of the variants' literal values. Each variant member has base fields, then variant fields, then base relations, then variant relations, with the discriminator narrowed to its literal. One extra member `<ns>_Any<Base>` is the union of the variant members. `models.<ns>` carries `Base`, each variant, and `Any<Base>` as keys.
- **Mongo.** Reference relations are relations. Embed relations are emitted as fields typed as the embedded model's member (array or single per cardinality), placed after scalar fields and before reference relations, and are not in `RelationKeys`.
- **Name collisions.** If two emitted member names are equal (separator collision, or a model literally named `AnyTask` beside a base `Task`), the emitter throws the emitter's existing structured validation error naming both sources. Nothing is emitted.
- **Import.** Each family's `getFamilyImports` adds `RelationKeys` to its existing import from the family types entrypoint.

### Relation nullability is a contract fact

Whether a to-one relation can be missing is stated by the schema (`author User?` versus `author User`) and is recorded on the relation, not reconstructed from storage.

- `ContractNonJunctionRelation` in `packages/1-framework/0-foundation/contract/src/domain-types.ts` gains `nullable: boolean` on the `'1:1'` and `'N:1'` members. `'1:N'`, `'N:M'`, and embed relations do not carry it.
- Authoring sets it from what the user wrote: the SQL and Mongo PSL interpreters from the `?` on the relation field at every site that assigns a `'1:1'` or `'N:1'` cardinality; the SQL and Mongo TypeScript builders through a flag on the relation builder.
- Authoring rejects a required relation field whose foreign-key columns are nullable, and the reverse, with a structured contract error naming the field.
- `validate-domain.ts` requires the flag on every `'1:1'` and `'N:1'` relation. A `contract.json` without it fails validation with a message to re-run `prisma contract emit`.
- The emitter reads `relation.nullable`. `EmissionSpi.isToOneRelationNullable`, `packages/2-sql/3-tooling/emitter/src/relation-nullability.ts`, and their tests are deleted.
- The side of a one-to-one relation that does not own the foreign key is always nullable, because nothing in the database guarantees the related row exists: a `'1:1'` back-relation field written without `?` is a `PSL_REQUIRED_ONE_TO_ONE_BACKRELATION` diagnostic in both PSL interpreters, and `hasOne` in both TypeScript builders has no `optional` option and always records `nullable: true`.
- The SQL ORM's `IsToOneRelationNullable` reads the flag; `RelationLocalFieldColumns`, `MapFieldsToColumns`, `AnyColumnNullable`, `HasForeignKeyForCols`, and `IsFkSideOfRelation` are deleted. The Mongo ORM's `IncludeRelationRowType` reads the flag instead of always adding `| null`. Refined to-one includes (`include('payment', p => p.where(...))`) are `| null` independently of the flag, because the refinement can exclude the row.
- The storage hash canonicalizes the domain section as empty, so no contract hash changes.

### Framework types

New file `packages/1-framework/1-core/framework-components/src/execution/model-types.ts`, exported from `src/exports/runtime.ts` beside `ResultType`, and re-exported from `packages/2-sql/1-core/contract/src/exports/types.ts` and `packages/2-mongo-family/1-foundation/mongo-contract/src/exports/index.ts`:

```ts
export declare const RelationKeys: unique symbol;

export type Scalars<M> = M extends { readonly [RelationKeys]?: infer R extends string }
  ? Omit<M, R | typeof RelationKeys>
  : M;

export type With<M, R extends RelationNamesOf<M>> = Scalars<M> & {
  [K in R]: M[K] extends (infer Item)[]
    ? Scalars<Item>[]
    : M[K] extends infer Item | null
      ? Scalars<Item> | null
      : Scalars<M[K]>;
};
```

- `Scalars` is distributive, so `Scalars<Models.public_AnyTask>` is the union of the variants' scalar rows.
- `RelationNamesOf<M>` is `NonNullable<M[typeof RelationKeys]>`. A key outside it is a compile error.
- `With` handles `X[]`, `X | null`, and `X`. Nested includes are not supported; `With<With<...>>` is not supported.
- Exact conditional-type spelling may change during implementation as long as the type tests in § Tests pass.

### ORM changes

- SQL: `CollectionImpl` in `packages/3-extensions/sql-orm-client/src/collection.ts` gains `declare readonly _row?: Row;` directly below `declare readonly [RowType]: Row;`.
- Mongo: the `MongoCollection` interface in `packages/2-mongo-family/5-query-builders/orm/src/collection.ts` gains `readonly _row?: SimplifyDeep<IncludedRow<TContract, ModelName, TIncludes>>;` as its first member. `SimplifyDeep` is needed because Mongo rows are intersections; the ORM derivations themselves are unchanged.
- The ORM row derivations are unchanged. Equality with the emitted types is enforced by tests, not by redefinition. (The brief asked for "defined as"; threading the emitted map through `TypeMaps` would change `TypeMaps`, which is a non-goal. Hover text shows the expanded object either way.)

### Tests

All type tests use `expectTypeOf` in `*.test-d.ts`.

- `packages/1-framework/3-tooling/emitter/test/model-types-emission.test.ts`: snapshot the `Models` block and `models` constant for inline contracts covering: a model with no relations; every SQL cardinality including a nullable to-one and a non-nullable to-one; `__unbound__` and `public` models in one contract; a polymorphic base with two variants; a cross-space relation omitted; a Mongo contract with one reference and one embed relation; and an expected throw for a separator collision and for a model named `AnyTask` beside base `Task`.
- `packages/3-extensions/sql-orm-client/test/model-types.test-d.ts` against `test/fixtures/generated/contract` and the polymorphism fixture (relative import from `test/integration/...`): for every model, `DefaultModelRow<C, M>` equals `Scalars<Models.<ns>_M>`; `ResultType<typeof db.M>` equals `Scalars<Models.<ns>_M>` and is not `never`; `ResultType<typeof db.Post.include('author')>` equals `With<Models.public_Post, 'author'>`; a to-many include equals `With<..., 'comments'>`; a nullable to-one include equals `With<..., 'invitedBy'>`; `ResultType` of a `select()` projection equals `{ id: number }`; a refined include is not `never`; `Models.public_Task['type']` is the literal union; `ResultType<typeof db.Task.variant('Bug')>` equals `Scalars<Models.public_Bug>`; `ResultType<typeof db.Task>` equals `Scalars<Models.public_AnyTask>`; `With<Models.public_User, 'nope'>` is a `@ts-expect-error`.
- `packages/2-mongo-family/5-query-builders/orm/test/model-types.test-d.ts` against the `mongo-contract/test/fixtures/orm-contract` fixture (regenerated by this project): `InferFullRow<C, M>` equals `Scalars<Models.<ns>_M>` for every model; embeds are present in `Scalars`; `ResultType<typeof db.M>` is not `never` and equals the same; one `.include(ref)` equals `With<..., ref>`.
- `examples/prisma-8-demo/test/demo-dx.types.test.ts` gains one test: `typeof models.public.User` equals `Models.public_User`, and `ResultType<typeof db.orm...>` for one demo query equals the matching `With`.

### Fixtures

Every emitted `contract.d.ts` in the repo is regenerated with `pnpm fixtures:check` (install, build, install again, check) and committed. `contract.json` shows no diff anywhere.

### Docs and ADR

- New page `docs/reference/model-and-result-types.md`, title "Naming model and result types". Sections: "The model" (`typeof models.public.User`, `Models.public_User`, `__unbound__`, polymorphic base, variant, `Any<Base>`), "The row a default fetch returns" (`Scalars`), "A view with relations" (`With`, and the hand-written `Scalars & {...}` form it replaces), "The result of any query" (`ResultType` on collections, projections, refined includes), "Input types" (`CreateInput`, `MutationUpdateInput`, `ShorthandWhereFilter`, `UniqueConstraintCriterion`, Mongo equivalents), "Coming from Prisma 7" (table: `Prisma.User` to `Models.public_User`; `Prisma.UserGetPayload<{ include: { posts: true } }>` to `With<Models.public_User, 'posts'>`; `Prisma.UserCreateInput` to `CreateInput`; `Prisma.UserWhereInput` to `ShorthandWhereFilter`; `Awaited<ReturnType<typeof fn>>` to `ResultType<typeof query>`), and a first paragraph stating that a query result is a view and the default fetch returns `Scalars<Model>`, not the model. Every snippet is copied from a passing type test and names its source file in a comment.
- Index line in `docs/README.md` after the "Aggregate descriptor guide" line. "Related Docs" links in `packages/3-extensions/sql-orm-client/README.md` and `packages/2-mongo-family/5-query-builders/orm/README.md`. One sentence under the `ResultType` pattern in `docs/reference/query-patterns.md` pointing at the new page. One paragraph in `docs/architecture docs/subsystems/2. Contract Emitter & Types.md` describing the `Models` block and linking the ADR.
- `docs/architecture docs/adrs/ADR 249 - Models and views are emitted from the contract.md`: the model-versus-view rule, the always-explicit namespace rule and its `db.enums` precedent, why `FieldOutputTypes` is untouched, the three-shape polymorphism rule, the phantom-relation-keys mechanism, why `With` is not a selection language, and the rejected alternatives copied from the brief.

## Contract-impact

Type-level only. `contract.json` unchanged. `contract.d.ts` gains the `Models` namespace and `models` constant. `framework-components` gains three exports; both family contract packages re-export them.

## Adapter-impact

None.

## Project Definition of Done

- [ ] Team-DoD floor (repo checks, `pnpm fixtures:check`, Linear close-out).
- [ ] Every test in § Tests exists and passes.
- [ ] All 333 fixtures regenerated; `contract.json` diff empty.
- [ ] Docs page, index and README links, subsystem paragraph, and ADR 249 merged.
- [ ] One PR, over 1,000 lines changed, on the branch of this worktree.
