# Naming model and result types

A query result is a view on a model, not the model. The model is what you wrote in PSL: every field and every relation. The default fetch, `db.orm.public.User.first()` or `db.orm.public.User.all()`, returns `Scalars<Model>`, the model without its relations, because returning the model would mean loading the whole reachable graph. A fetch with `.include()` returns `Scalars<Model>` plus the relations you asked for, and a fetch with `.select()` returns what you selected. Every type on this page is emitted into `contract.d.ts` or exported by the family package, so you can name a model, a default row, an application data structure derived from a model, or the result of a query without a client in scope.

Every snippet below is copied from a passing type test or an emitted fixture. The first line of each snippet names the file it came from. One spelling differs: the empty spec is `{}` in your code, and the tests spell it `Record<never, never>`, the same type, because the repo's lint bans `{}` in its own files. The tests import from `@internal/*` package names; the public spellings are `@prisma/orm-postgres/family-contract/types` for `Scalars`, `Shape`, and `ShapeSpec`, `@prisma/orm-postgres/components/runtime` for `ResultType`, and `./prisma/contract` for `models` and `Models` (`@prisma/orm-mongo/contract` and `@prisma/orm-mongo/components/runtime` on Mongo).

```ts
import type { models, Models } from './prisma/contract';
import type { Scalars, Shape } from '@prisma/orm-postgres/family-contract/types';
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

The `readonly [RelationKeys]?` line is a phantom: a symbol-keyed optional property that lists the relation names so `Scalars` and `Shape` can tell relations from scalars. It never affects assignability and never appears in a value.

### Models in the default namespace

On a target with a namespace mechanism, the namespace is always part of the name. A model in the default namespace, `__unbound__`, is `Models.unbound_User` and `typeof models.__unbound__.User`, never a bare `User`. This is the same convention as `db.enums.__unbound__.X`. Postgres and Mongo are such targets.

On a target whose descriptor declares `namespaceSupport: 'none'`, SQLite today, there is only ever one namespace, so the segment is dropped: the same model is `Models.User` and `typeof models.User`. The choice comes from the target declaration, not from how many namespaces a contract has, so adding a schema later never renames a type.

```ts
// examples/prisma-8-demo-sqlite/src/prisma/contract.d.ts
export declare const models: {
  User: Models.User;
  Post: Models.Post;
};
```

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
  Shape<PolyModels.public_Project, { tasks: {} }>
>();
```

## The row a default fetch returns

`Scalars<M>` is the model without its relations. It is what `db.orm.public.User.first()`, `db.orm.public.User.all()`, and every other terminal on a plain collection return. `Scalars` distributes over unions, so `Scalars<Models.public_AnyTask>` is the union of the variants' scalar rows.

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
expectTypeOf<DefaultModelRow<Contract, 'User'>>().toEqualTypeOf<Scalars<Models.public_User>>();

expectTypeOf<ResultType<typeof db.orm.public.User>>().toEqualTypeOf<Scalars<Models.public_User>>();
```

On Mongo, embedded documents are fields, not relations, so they stay present in `Scalars`.

```ts
// packages/2-mongo-family/5-query-builders/orm/test/model-types.test-d.ts
expectTypeOf<Scalars<Models.unbound_User>>().toHaveProperty('addresses');
expectTypeOf<Scalars<Models.unbound_Task>>().toHaveProperty('comments');
```

## A data structure derived from a model

An API endpoint declares its response type once, derived from the model, and the compiler checks the body against it at the `return`. The query inside is an implementation detail: change the model and the type changes; change the query and the same declaration still has to be satisfied. `Shape<Model, Spec>` is the type for that.

```ts
// examples/prisma-8-demo/test/demo-dx.types.test.ts
type UserResponse = Shape<
  EmittedModels.public_User,
  { '-': 'email'; posts: { '+': 'id' | 'title'; tags: {} } }
>;

async function getUserWithPosts(
  userId: EmittedModels.public_User['id'],
): Promise<UserResponse | null> {
  const user = await db.orm.public.User.where({ id: userId })
    .include('posts', (posts) => posts.include('tags'))
    .first();
  if (user === null) return null;
  const { email: _email, ...rest } = user;
  return { ...rest, posts: user.posts.map(({ id, title, tags }) => ({ id, title, tags })) };
}
expectTypeOf(getUserWithPosts).returns.resolves.toEqualTypeOf<UserResponse | null>();

// @ts-expect-error the body omits posts, which the shape declares
const withoutPosts = (row: Scalars<EmittedModels.public_User>): UserResponse => row;
```

At every level of the spec:

1. `'+'` is a union of names to keep, scalars and relations alike. A relation named in `'+'` is included with all of its scalars and none of its relations. When `'+'` is present, only the named scalars are kept.
2. `'-'` is a union of scalar names to drop. Every other scalar is kept. Relations cannot be dropped, since they are absent unless asked for.
3. `'+'` and `'-'` together at one level is a compile error.
4. Any other key is a relation of the current model, and its value is a nested spec applied to the related model. `{}` is the empty spec: all scalars, no relations.
5. No `'+'` and no `'-'` means every scalar.
6. Relations are absent unless they appear in `'+'` or as a key.
7. Cardinality and nullability come from the model at every level: a to-many relation is `T[]`, a nullable to-one is `T | null`, a required to-one is `T`.

`Shape` refuses, at compile time, a name in `'+'` or `'-'` that is neither a scalar nor a relation of the model, a relation name in `'-'`, a relation key whose value is not an object, and `'+'` beside `'-'`. It is not a query language: no `where`, `orderBy`, `limit`, or aggregation. Renames and computed fields are composed with TypeScript, `Shape<User, {}> & { postCount: number }`.

```ts
// packages/1-framework/1-core/framework-components/test/model-types.test-d.ts
expectTypeOf<Shape<User, {}>>().toEqualTypeOf<Scalars<User>>();
expectTypeOf<Shape<User, { '+': 'id' }>>().toEqualTypeOf<{ id: number }>();
expectTypeOf<Shape<Post, { '-': 'authorId' }>>().toEqualTypeOf<{ id: number; title: string }>();
expectTypeOf<Shape<User, { profile: {} }>['profile']>().toEqualTypeOf<{
  id: number;
  bio: string | null;
} | null>();
expectTypeOf<Shape<User, { posts: { '+': 'title'; comments: {} } }>>().toEqualTypeOf<{
  id: number;
  name: string;
  posts: { title: string; comments: { id: number; body: string }[] }[];
}>();

// @ts-expect-error 'posts' is a relation and cannot be dropped
type _Bad = Shape<User, { '-': 'posts' }>;
// @ts-expect-error '+' and '-' cannot both be given
type _Both = Shape<User, { '+': 'id'; '-': 'name' }>;
```

Over a polymorphic union, `Shape` distributes, so each variant keeps only the relations it declares.

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
type Flat<T> = { [K in keyof T]: T[K] };
type AssigneeRow = Scalars<PolyModels.public_Person> | null;
expectTypeOf<Shape<PolyModels.public_AnyTask, { assignee: {} }>>().toEqualTypeOf<
  | Flat<Scalars<PolyModels.public_Bug> & { assignee: AssigneeRow }>
  | Flat<Scalars<PolyModels.public_Feature> & { assignee: AssigneeRow }>
  | Flat<Scalars<PolyModels.public_Epic>>
>();
```

The rows the ORM returns are `Shape`s of the model: a plain `.include(r)` is `Shape<M, { r: {} }>`, a `.select(a, b)` projection is `Shape<M, { '+': 'a' | 'b' }>`, and a nested include is a nested spec. The type tests hold the bare-collection equality (`ResultType` of the collection equals `Shape<M>`) for every SQL fixture model, and the include, projection, and nested-include equalities for representative relations.

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
const withAuthor = db.orm.public.Post.include('author');
expectTypeOf<ResultType<typeof withAuthor>>().toEqualTypeOf<
  Shape<Models.public_Post, { author: {} }>
>();

const withInviter = db.orm.public.User.include('invitedBy');
expectTypeOf<ResultType<typeof withInviter>>().toEqualTypeOf<
  Shape<Models.public_User, { invitedBy: {} }>
>();

const projected = db.orm.public.User.select('id', 'name');
expectTypeOf<ResultType<typeof projected>>().toEqualTypeOf<
  Shape<Models.public_User, { '+': 'id' | 'name' }>
>();

const narrowed = db.orm.public.User.include('posts', (posts) =>
  posts.select('id', 'title').include('author'),
);
expectTypeOf<ResultType<typeof narrowed>>().toEqualTypeOf<
  Shape<Models.public_User, { posts: { '+': 'id' | 'title'; author: {} } }>
>();
```

`Shape<M, {}>` is `Scalars<M>`, and `Shape<M, { r: {} }>` replaces the hand-written `Scalars<M> & { r: Scalars<R>[] }` intersection: the two are assignable in both directions and identical once flattened, and `Shape` reads the wrapper from the model, so you do not have to remember which relations are lists and which are nullable. One rule of the query builder is not in the type: a refined to-one include (`include('reviewer', (r) => r.where(...))`) is `| null` even on a required relation, because the refinement can exclude the row.

Do not write `Pick<Models.public_User, 'id' | 'posts'>`. It demands `posts: Models.public_Post[]` with every post carrying its own `author` and `comments`, and no query returns that.

## The result of any query

`ResultType<typeof query>` names the row of any ORM query value: a plain collection, an include, a projection, a refined include, or a `.variant()` narrowing. Each collection value has exactly one row type, and every terminal on it returns that row in some wrapper (`Row | null`, `Row[]`, an async iterable of `Row`).

```ts
// packages/3-extensions/sql-orm-client/test/model-types.test-d.ts
expectTypeOf<ResultType<typeof db.orm.public.User>>().toEqualTypeOf<Scalars<Models.public_User>>();

const projected = db.orm.public.User.select('id');
expectTypeOf<ResultType<typeof projected>>().toEqualTypeOf<{ id: number }>();

const refined = db.orm.public.User.include('posts', (posts) => posts.select('id'));
expectTypeOf<ResultType<typeof refined>>().not.toBeNever();
```

Through the public facade the same holds for a query defined beside the client.

```ts
// examples/prisma-8-demo/test/demo-dx.types.test.ts
import type { ResultType } from '@prisma/orm-postgres/components/runtime';
import type { Scalars, Shape } from '@prisma/orm-postgres/family-contract/types';

expectTypeOf<Scalars<User>>().toEqualTypeOf<ResultType<typeof db.orm.public.User>>();

const usersWithTasks = () => db.orm.public.User.include('tasks');
expectTypeOf<ResultType<ReturnType<typeof usersWithTasks>>>().toEqualTypeOf<
  Shape<EmittedModels.public_User, { tasks: {} }>
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
| `Prisma.UserGetPayload<{ include: { posts: true } }>` | `Shape<Models.public_User, { posts: {} }>` |
| `Prisma.UserGetPayload<{ select: { id: true; posts: { select: { title: true } } } }>` | `Shape<Models.public_User, { '+': 'id'; posts: { '+': 'title' } }>` |
| `Prisma.UserCreateInput` | `CreateInput<Contract, 'User'>` |
| `Prisma.UserWhereInput` | `ShorthandWhereFilter<Contract, 'public', 'User'>` |
| `Awaited<ReturnType<typeof fn>>` | `ResultType<typeof query>` |

The one difference to notice first: in Prisma 7 the generated `User` was scalars only. In Prisma 8, `Models.public_User` carries every relation, and the scalars-only row is `Scalars<Models.public_User>`.

## References

- [ADR 250 — Models and views are emitted from the contract](../architecture%20docs/adrs/ADR%20250%20-%20Models%20and%20views%20are%20emitted%20from%20the%20contract.md)
- [Contract Emitter & Types](../architecture%20docs/subsystems/2.%20Contract%20Emitter%20%26%20Types.md)
- [Query Patterns](./query-patterns.md)
