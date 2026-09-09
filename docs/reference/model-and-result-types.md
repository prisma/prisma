# Naming model and result types

A query result is a view on a model, not the model. The model is what you wrote in PSL: every field and every relation. The default fetch, `db.User.first()` or `db.User.all()`, returns `Scalars<Model>`, the model without its relations, because returning the model would mean loading the whole reachable graph. A fetch with `.include()` returns `Scalars<Model>` plus the relations you asked for, and a fetch with `.select()` returns what you selected. Every type on this page is emitted into `contract.d.ts` or exported by the family package, so you can name a model, a default row, a view with relations, or the result of a query without a client in scope.

Every snippet below is copied from a passing type test or an emitted fixture. The first line of each snippet names the file it came from. The tests import from `@internal/*` package names; the public spellings are `@prisma/orm-postgres/family-contract/types` for `Scalars` and `With`, `@prisma/orm-postgres/components/runtime` for `ResultType`, and `./prisma/contract` for `models` and `Models` (`@prisma/orm-mongo/contract` and `@prisma/orm-mongo/components/runtime` on Mongo).

```ts
import type { models, Models } from './prisma/contract';
import type { Scalars, With } from '@prisma/orm-postgres/family-contract/types';
import type { ResultType } from '@prisma/orm-postgres/components/runtime';
```

## The model

`contract.d.ts` exports a `Models` namespace with one member per model, named `<namespace>_<Model>`, and a `models` declared constant that reaches the same types by dotted access. Each member carries every scalar field and every relation. Relation lines are typed as the related model's member: `X[]` for to-many, `X | null` for a to-one relation whose field is optional in the schema (`author User?`, or `belongsTo(User, { ..., optional: true })`), and `X` for a required one. The contract records this as `nullable` on the relation; the emitter and both ORMs read that flag rather than working it out from foreign keys.

```ts
// packages/3-extensions/sql-orm-client/test/fixtures/generated/contract.d.ts
export namespace Models {
  export type public_User = {
    id: CodecTypes['pg/int4@1']['output'];
    name: CodecTypes['pg/text@1']['output'];
    email: CodecTypes['pg/text@1']['output'];
    invitedById: CodecTypes['pg/int4@1']['output'] | null;
    address: AddressOutput | null;
    invitedUsers: public_User[];
    invitedBy: public_User | null;
    posts: public_Post[];
    profile: public_Profile | null;
    tags: public_Tag[];
    roles: public_Role[];
    readonly [RelationKeys]?: 'invitedUsers' | 'invitedBy' | 'posts' | 'profile' | 'tags' | 'roles';
  };
  export type public_Post = {
    id: CodecTypes['pg/int4@1']['output'];
    title: CodecTypes['pg/text@1']['output'];
    userId: CodecTypes['pg/int4@1']['output'];
    views: CodecTypes['pg/int4@1']['output'];
    embedding: Vector<3> | null;
    comments: public_Comment[];
    author: public_User;
    readonly [RelationKeys]?: 'comments' | 'author';
  };
}

export declare const models: {
  public: {
    User: Models.public_User;
    Post: Models.public_Post;
  };
};
```

`typeof models.public.User` and `Models.public_User` are the same type. `models` has no runtime value; import it with `import type`.

```ts
// examples/prisma-8-demo/test/demo-dx.types.test.ts
import type { Models as EmittedModels, models } from '../src/prisma/contract.d';

type User = typeof models.public.User;
expectTypeOf<User>().toEqualTypeOf<EmittedModels.public_User>();
```

The `readonly [RelationKeys]?` line is a phantom: a symbol-keyed optional property that lists the relation names so `Scalars` and `With` can tell relations from scalars. It never affects assignability and never appears in a value.

### Models in the default namespace

The namespace is always part of the name. A model in the default namespace, `__unbound__`, is `Models.unbound_User` and `typeof models.__unbound__.User`, never a bare `User`. This is the same convention as `db.enums.__unbound__.X`.

```ts
// packages/2-mongo-family/5-query-builders/orm/test/model-types.test-d.ts
expectTypeOf<ResultType<typeof db.users>>().toEqualTypeOf<Scalars<Models.unbound_User>>();
```

### Polymorphic models

A polymorphic base emits three shapes: the base member, one member per variant, and an `Any<Base>` union of the variant members. The base's discriminator field is the union of the variant literals; each variant narrows it to its own literal and adds its own fields. A relation whose target is a polymorphic base is typed as the `Any<Base>` union, because the ORM returns the variant union for such an include.

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
expectTypeOf<PolyModels.public_Task['type']>().toEqualTypeOf<'bug' | 'feature' | 'epic'>();

const bugs = poly.Task.variant('Bug');
expectTypeOf<ResultType<typeof bugs>>().toEqualTypeOf<Scalars<PolyModels.public_Bug>>();

expectTypeOf<ResultType<typeof poly.Task>>().toEqualTypeOf<Scalars<PolyModels.public_AnyTask>>();

const projectsWithTasks = poly.Project.include('tasks');
expectTypeOf<ResultType<typeof projectsWithTasks>>().toEqualTypeOf<
  With<PolyModels.public_Project, 'tasks'>
>();
```

## The row a default fetch returns

`Scalars<M>` is the model without its relations. It is what `db.User.first()`, `db.User.all()`, and every other terminal on a plain collection return. `Scalars` distributes over unions, so `Scalars<Models.public_AnyTask>` is the union of the variants' scalar rows.

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
expectTypeOf<DefaultModelRow<Contract, 'User'>>().toEqualTypeOf<Scalars<Models.public_User>>();

expectTypeOf<ResultType<typeof db.User>>().toEqualTypeOf<Scalars<Models.public_User>>();
```

On Mongo, embedded documents are fields, not relations, so they stay present in `Scalars`.

```ts
// packages/2-mongo-family/5-query-builders/orm/test/model-types.test-d.ts
expectTypeOf<Scalars<Models.unbound_User>>().toHaveProperty('addresses');
expectTypeOf<Scalars<Models.unbound_Task>>().toHaveProperty('comments');
```

## A view with relations

`With<M, R>` names the row an `.include()` returns: `Scalars<M>` plus each named relation, wrapped the way the model declares it (`X[]`, `X | null`, or `X`). `R` is constrained to the model's relation names, so a typo is a compile error. `With` is not a selection language: it takes relation names only, one level deep, and has nothing to mirror at runtime.

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
const withAuthor = db.Post.include('author');
expectTypeOf<ResultType<typeof withAuthor>>().toEqualTypeOf<With<Models.public_Post, 'author'>>();

const withComments = db.Post.include('comments');
expectTypeOf<ResultType<typeof withComments>>().toEqualTypeOf<
  With<Models.public_Post, 'comments'>
>();

const withInviter = db.User.include('invitedBy');
expectTypeOf<ResultType<typeof withInviter>>().toEqualTypeOf<
  With<Models.public_User, 'invitedBy'>
>();

// @ts-expect-error 'nope' is not a relation of User
type Bad = With<Models.public_User, 'nope'>;
```

`With` replaces the hand-written `Scalars & { ... }` intersection. The two are assignable in both directions and identical once the intersection is flattened; `With` flattens it for you, so hover text shows one object, and it reads the wrapper from the model, so you do not have to remember which relations are lists and which are nullable.

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
type PostWithComments = Scalars<Models.public_Post> & {
  comments: Scalars<Models.public_Comment>[];
};
expectTypeOf<With<Models.public_Post, 'comments'>>().toMatchTypeOf<PostWithComments>();
expectTypeOf<PostWithComments>().toMatchTypeOf<With<Models.public_Post, 'comments'>>();
expectTypeOf<With<Models.public_Post, 'comments'>>().toEqualTypeOf<{
  [K in keyof PostWithComments]: PostWithComments[K];
}>();
```

Do not write `Pick<Models.public_User, 'id' | 'posts'>`. It demands `posts: Models.public_Post[]` with every post carrying its own `author` and `comments`, and no query returns that.

## The result of any query

`ResultType<typeof query>` names the row of any ORM query value: a plain collection, an include, a projection, a refined include, or a `.variant()` narrowing. Each collection value has exactly one row type, and every terminal on it returns that row in some wrapper (`Row | null`, `Row[]`, an async iterable of `Row`).

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
expectTypeOf<ResultType<typeof db.User>>().toEqualTypeOf<Scalars<Models.public_User>>();

const projected = db.User.select('id');
expectTypeOf<ResultType<typeof projected>>().toEqualTypeOf<{ id: number }>();

const refined = db.User.include('posts', (posts) => posts.select('id'));
expectTypeOf<ResultType<typeof refined>>().not.toBeNever();
```

Through the public facade the same holds for a query defined beside the client.

```ts
// examples/prisma-8-demo/test/demo-dx.types.test.ts
import type { ResultType } from '@prisma/orm-postgres/components/runtime';
import type { Scalars, With } from '@prisma/orm-postgres/family-contract/types';

expectTypeOf<Scalars<User>>().toEqualTypeOf<ResultType<typeof db.orm.public.User>>();

const usersWithTasks = () => db.orm.public.User.include('tasks');
expectTypeOf<ResultType<ReturnType<typeof usersWithTasks>>>().toEqualTypeOf<
  With<EmittedModels.public_User, 'tasks'>
>();
```

`ResultType` also works on SQL query lane plans; see [Query Patterns](./query-patterns.md#type-inference-with-resulttype).

## Input types

The ORM clients already export the types that describe what you pass in. They take the contract type and the model name, so they need the `Contract` from `./prisma/contract` in scope.

- SQL, from `@prisma/orm-postgres/orm-client`: `CreateInput<Contract, 'User'>` for `create`, `MutationUpdateInput<Contract, 'User'>` for `update`, `ShorthandWhereFilter<Contract, 'public', 'User'>` for `where`, and `UniqueConstraintCriterion<Contract, 'User'>` for the unique lookup in `findUnique`-style calls.
- Mongo, from `@prisma/orm-mongo/orm`: `CreateInput<Contract, 'User'>` and `VariantCreateInput` for `create`, and `MongoWhereFilter<Contract, 'User'>` for `where`.

## Coming from Prisma 7

| Prisma 7 | Prisma 8 |
| --- | --- |
| `Prisma.User` | `Models.public_User` |
| `Prisma.UserGetPayload<{ include: { posts: true } }>` | `With<Models.public_User, 'posts'>` |
| `Prisma.UserCreateInput` | `CreateInput<Contract, 'User'>` |
| `Prisma.UserWhereInput` | `ShorthandWhereFilter<Contract, 'public', 'User'>` |
| `Awaited<ReturnType<typeof fn>>` | `ResultType<typeof query>` |

The one difference to notice first: in Prisma 7 the generated `User` was scalars only. In Prisma 8, `Models.public_User` carries every relation, and the scalars-only row is `Scalars<Models.public_User>`.

## References

- [ADR 249 — Models and views are emitted from the contract](../architecture%20docs/adrs/ADR%20249%20-%20Models%20and%20views%20are%20emitted%20from%20the%20contract.md)
- [Contract Emitter & Types](../architecture%20docs/subsystems/2.%20Contract%20Emitter%20%26%20Types.md)
- [Query Patterns](./query-patterns.md)
