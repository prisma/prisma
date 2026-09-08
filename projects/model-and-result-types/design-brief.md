# Design brief: model and result types for Prisma 8

_Status: draft for team review, revised 2026-09-08 after discussion with Serhii. The implementation plan beside this file is out of date and will be rewritten once the brief is agreed._

## Prisma 8 has no way to name a model or a query result

Two Prisma 7 users raised the same gap in the Prisma 8 Discord this month.

One wrote that Prisma 7 let them get "a lot of types of the available APIs from the Prisma namespace", and that a single line like `export type Book = Prisma.BookGetPayload<{ include: { author: true } }>` told everyone consuming `Book` that the author is always there. They noted Prisma 8 has no equivalent and that "you can of course manually write the types yourself, but Prisma 7 made it so easy it's now confusing why the type safety feature is no longer there."

The other asked: "is it normal that the models are only exposed through the `FieldOutputTypes` type in `contract.d.ts`? Can't we have a simple `export type MyModel`?"

Both are right about the facts. The emitted `contract.d.ts` exports hashes, codec maps, `FieldOutputTypes`, `FieldInputTypes`, `TypeMaps`, and `Contract`. There is no model type. Getting the type of a query result today means writing `NonNullable<Awaited<ReturnType<typeof query.first>>>` yourself. `ResultType`, which exists for the SQL and Mongo query lanes, returns `never` on ORM queries because the ORM collection does not carry the marker it reads.

## Users need two things: the model type, and the query result type

1. **Name my model in types alone.** With no query and no client in scope: a shared types package, an API contract, a frontend receiving JSON.
2. **Name the return type of a query I already wrote.**

## A model is the whole row plus its relations; a query result is a view on it

The model is what you wrote in PSL: every field and every relation. Selection belongs to the query, not to the model. The contract defines models; the client defines views.

Two consequences follow, and both are deliberate:

- The model type carries every relation, always. `User.posts` is `Post[]`, `Post.author` is `User`, and so on around the cycle.
- A query result is therefore not a model. The default fetch returns the model's scalar fields, because returning the model would mean loading the whole reachable graph. Partial fetches return whatever was selected. This is the opposite of Prisma 7, where the generated `User` is scalars-only, and it is the first thing a Prisma 7 user will notice. The docs say it in their first paragraph, and the default fetch's return type is spelled in terms of the model so the relationship is visible in hover text.

## `Models`, `models`, `Scalars`, `With`, and `ResultType`

### The emitted file

For a Postgres contract with a `public` schema, `contract.d.ts` gains this:

```ts
import type { RelationKeys } from '@prisma/orm-postgres/family-contract/types';

export namespace Models {
  export type public_User = {
    id: number;
    name: string;
    email: string;
    posts: public_Post[];
    profile: public_Profile | null;
    readonly [RelationKeys]?: 'posts' | 'profile';
  };

  export type public_Post = {
    id: number;
    title: string;
    authorId: number;
    author: public_User;
    comments: public_Comment[];
    readonly [RelationKeys]?: 'author' | 'comments';
  };

  export type public_Profile = {
    id: number;
    userId: number;
    bio: string | null;
    user: public_User;
    readonly [RelationKeys]?: 'user';
  };

  export type public_Comment = {
    id: number;
    postId: number;
    body: string;
    post: public_Post;
    readonly [RelationKeys]?: 'post';
  };
}

export declare const models: {
  public: {
    User: Models.public_User;
    Post: Models.public_Post;
    Profile: Models.public_Profile;
    Comment: Models.public_Comment;
  };
};
```

Every model has two spellings of one type: `Models.public_User`, an importable name, and `typeof models.public.User`, dotted access with the schema as a property. The recursion between models goes through the namespace members, which is why they are named.

`models` is a declared constant with no runtime. Users import it with `import type`, which guarantees nothing is looked up at runtime. A TypeScript namespace cannot carry the schema as a nested namespace because `public` is a reserved word in strict mode, so the schema is folded into the member name instead.

The namespace is always present, including the default one. Models in the `__unbound__` namespace (the default schema on Postgres, the only namespace on SQLite) are `Models.unbound_User` and `typeof models.__unbound__.User`, never a bare `User`. This is the existing convention: `db.enums.__unbound__.X` and the Postgres contract view both keep the namespace explicit and never promote one to the root, because a Postgres contract can hold `__unbound__` and `public` models side by side and a bare name would collide with a prefixed one. It also means the emitter has one code path for every target.

Every emitted name is a pure function of namespace and model, so nothing a user adds later renames or removes an existing type. The one edge is a separator collision, schema `public_User` with model `X` against schema `public` with model `User_X`. It is detectable at emit time and the emitter fails with a clear message rather than emitting two types under one name. The separator itself is not decided here.

`RelationKeys` is a `unique symbol` declared once in the family contract package. The optional, symbol-keyed phantom on each model never affects assignability and does not appear when a value is spread or iterated. It exists so the next utility can tell relations from scalars structurally.

### `Scalars<M>` is the model without its relations, and what a default fetch returns

```ts
// family contract package, not generated
export declare const RelationKeys: unique symbol;

export type Scalars<M extends { readonly [RelationKeys]?: string }> =
  Omit<M, NonNullable<M[typeof RelationKeys]> | typeof RelationKeys>;
```

```ts
type User = typeof models.public.User;
type UserRow = Scalars<User>;   // { id; name; email }
```

The ORM's default row type is defined as `Scalars<Models.public_User>`, not merely equal to it, so hover text and error messages show the model the row came from. The name `Scalars` follows PSL, where fields are scalar or relation. `Row` was suggested as an alternative; the name is open, the shape is not.

### `ResultType<typeof query>` is the shape of any query

A collection value has exactly one row type. `db.User` reads and writes `Scalars<Models.public_User>`. `db.User.include('posts')` is a new value whose terminals all return `Scalars<Models.public_User> & { posts: Scalars<Models.public_Post>[] }`. `db.User.select('id')` is a third. Every terminal on a given collection returns that collection's shape in some wrapper: `Row | null`, an async iterable of `Row`, a promise of `Row`. Both ORM collections gain the one-line `_row` phantom that the existing `ResultType` reads, so:

```ts
import type { models, Models } from './prisma/contract';
import type { Scalars } from '@prisma/orm-postgres/family-contract/types';
import type { ResultType } from '@prisma/orm-postgres/components/runtime';

type User = typeof models.public.User;      // the model
type UserRow = Scalars<User>;               // what db.User.first() returns

export const usersWithPosts = db.User.include('posts');
export type UserWithPosts = ResultType<typeof usersWithPosts>;
// { id; name; email; posts: Scalars<Models.public_Post>[] }

const recent = db.Post.select('id', 'title').include('comments', (c) => c.select('id').limit(3));
type RecentPost = ResultType<typeof recent>;
```

This is the Prisma 8 answer to `BookGetPayload<{ include: { author: true } }>`: the view is named by the query that produces it, in the one include vocabulary the ORM has.

A view with relations can also be written by hand, but not with `Pick` on the model. `Pick<User, 'id' | 'name' | 'posts'>` demands `posts: Post[]` with every post carrying its own `author` and `comments`, and no query returns that. The hand-written form uses the scalar pieces:

```ts
type UserWithPosts = Scalars<User> & { posts: Scalars<Post>[] };
```

That is exactly what `db.User.include('posts')` returns, because the ORM builds its row types from the same `Scalars` pieces. It needs no query in scope and the type tests below keep it in step with the ORM.

### `With<M, Relations>` names a view with relations, without a query

The hand-written form is more typing than it needs to be, and the writer has to know that `posts` is a list and `profile` is `| null`. A second utility over the model type removes both:

```ts
type UserWithPosts = With<User, 'posts'>;
// Scalars<User> & { posts: Scalars<Post>[] }

type UserWithBoth = With<User, 'posts' | 'profile'>;
// Scalars<User> & { posts: Scalars<Post>[]; profile: Scalars<Profile> | null }

type Book = With<Models.public_Book, 'author'>;
// the first user's example
```

`With` takes the model and a union of its relation names, reads the wrapper from the model's own field type (`Post[]` versus `Profile | null`), and produces the `Scalars` intersection. It is a pure utility over `Models.public_User`, like `Scalars`: no contract parameter, no object of booleans, and nothing that could be mirrored at runtime, which is what separates it from the rejected selection parameter. The second parameter is constrained to the model's relation keys, so a typo is a compile error. One level deep is enough on day one; nesting can come later if asked for.

`With<User, 'posts'>` and `ResultType<typeof db.User.include('posts')>` are the same type, checked by the type tests.

Input types are already exported by the ORM client (`CreateInput`, `MutationUpdateInput`, `ShorthandWhereFilter`, `UniqueConstraintCriterion`) and only need documenting alongside the above.

### The ORM's row types are built from the model types

The ORM does not have its own copy of the model shapes. For every model:

- `db.User.first()` returns `Scalars<Models.public_User>`.
- `db.User.include('posts')` adds `posts: Scalars<Models.public_Post>[]`. A to-one relation adds a single value, `| null` when the foreign key is nullable.
- `Models.public_User` itself is `Scalars<Models.public_User>` plus one field per relation, holding the related model wrapped the same way.

Type tests over the fixture contracts, for SQL and Mongo and including the polymorphism fixtures, check each of these three lines for every model.

Polymorphic models follow the usual object-oriented arrangement: the base carries its own fields with the discriminator typed as the union of variant literals, each variant carries base plus own fields with the discriminator narrowed, and the base's variants are reachable as a union. Their spelling under `Models` is an open question below.

## `FieldOutputTypes`, the fluent API, and runtime behaviour do not change

- `FieldOutputTypes` and `FieldInputTypes` stay exactly as they are. They serve `TypeMaps` and the lanes. `Models` and `models` are new exports beside them.
- No selection language at the type level. No `{ posts: { comments: true } }` and no relation paths. `With` takes relation names only, reads everything else from the model, and has no runtime counterpart.
- The ORM's fluent API is unchanged.
- No runtime behaviour changes anywhere. This is emitter output, phantom properties, two utility types, and docs.

## Payload types, selection parameters, `db.models`, bare aliases, and a schema-nested namespace were rejected

- **`db.models`, a runtime accessor for model types.** Dotted access already exists through `typeof models.public.User` with no runtime. A runtime value would be either an object pretending to be a row or a definition object whose `typeof` is not the model.
- **Bare `export type User` at the top level.** Adding a second `User` in another schema would silently remove the alias and break every import of it: a breaking change caused by an unrelated schema edit. `Models.public_User` is the importable name instead, and it cannot disappear.
- **Emit `GetPayload`-style types per query.** Ties the contract to one lane's vocabulary and grows `contract.d.ts` without bound.
- **A relation-selection parameter, `Model<Contract, 'User', { posts: { comments: true } }>`.** A second, type-only vocabulary for what `.include()` already says, and once it exists the same bag will be asked for at runtime. Raised by Serhii; agreed. `With<User, 'posts'>` differs in kind: it names relations on a model type, with no nesting object and nothing to mirror at runtime.
- **A parameter mapping relation name to the model type that sits there.** Makes the user import and restate what the contract already knows.
- **`Models.public.User` as nested TypeScript namespaces.** `namespace public` does not compile. Folding the schema into the member name gives the importable form; the declared constant gives the dotted form.
- **A separate `RowOf` helper for ORM queries.** `ResultType` exists and is documented. Give the collections the marker it reads.

## Four open questions

- `Scalars<M>` versus `Row<M>`, and whether `With` is the right name for its companion.
- Renaming `ResultType<typeof query>` to `Result<typeof query>`. It is the odd one out next to `Scalars` and `With`, and the `Type` suffix adds nothing. One export in `framework-components`, a sweep of the SQL lane and Mongo docs and a few demo type tests, no alias left behind.
- The separator between namespace and model in `Models` member names, and how `__unbound__` is spelled in a member name (`unbound_User` is the placeholder above).
- The spelling of polymorphic bases, variants, and the variant union under `Models`.

## After agreement

Rewrite the plan and slices around `Models`, `models`, `Scalars`, `With`, and the `_row` phantom. The earlier `Model<Contract, Name>` helper and its type move are dropped.
