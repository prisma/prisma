# Design brief: `Shape`, a type for application data structures derived from models

_Status: draft for review, 2026-09-09. Follows the model-and-result-types design (`design-brief.md`) and replaces `With` from PR #30231 before that PR merges._

## The need

An API endpoint declares its response type. That type is a contract used throughout the client code, so it must be explicit and stable. Inside the endpoint there is logic and at least one database query, and the raw row is rarely returned as-is. The user wants to write the response type once, derived from the models in the contract, and have the compiler guarantee that whatever the body does, the returned value has that shape.

```ts
import type { Models } from './prisma/contract';
import type { Shape } from '@prisma/orm-postgres/family-contract/types';

type UserResponse = Shape<Models.public_User, {
  '-': 'passwordHash';
  posts: { '+': 'id' | 'title'; comments: {} };
}>;

export async function getUserWithPosts(id: string): Promise<UserResponse | null> {
  const user = await db.orm.public.User.where({ id }).include('posts', (p) => p.include('comments')).first();
  if (user === null) return null;
  const { passwordHash, ...rest } = user;
  return { ...rest, posts: user.posts.map(({ id, title, comments }) => ({ id, title, comments })) };
}
```

Prisma 7 users did this with `GetPayload<{ include, select }>`, and relied on it heavily. That is the signal that the need is real.

## The principle

The response type is not derived from the query. It is derived from the model, and the query is an implementation detail behind it. The compiler checks the body against the declaration at the `return`. Change the model and the type changes and the query stops satisfying it. Change the query client and nothing about the type changes; the new query has to satisfy the same declaration.

So `Shape` is a small language for describing application data structures derived from models. It is not a way of describing query results, and it does not need to express what the query builder can express. It describes end states. Anything it cannot express is composed by hand from `Scalars` and TypeScript's own operators.

## The type

`Shape<Model, Spec = {}>`, exported from each family's contract types entrypoint beside `Scalars`, and implemented once in `framework-components` beside them. `Model` is an emitted model type, `Models.<ns>_<Model>`. `Spec` is an object; omitted, it is the empty spec, so `Shape<User>` equals `Scalars<User>`. The constraint type `ShapeSpec<Model, Spec>` is exported beside it, because a generic over specs (`type Response<S extends ShapeSpec<User, S>> = Shape<User, S>`) has no other constraint that satisfies `Shape`.

### Spec rules

At every level of the spec:

1. `'+'` is a union of names to keep, scalars and relations alike. A relation named in `'+'` is included with all of its scalars and none of its relations. When `'+'` is present, only the named scalars are kept.
2. `'-'` is a union of scalar names to drop. Every other scalar is kept. Relations cannot be dropped, since they are absent unless asked for.
3. `'+'` and `'-'` together at one level is a compile error. "Only these" and "all but these" cannot both be meant. A relation named in `'+'` and also present as a key at the same level is a compile error for the same reason: "all its scalars" and "this nested spec" cannot both be meant. Use the key alone to narrow.
4. Any other key is a relation of the current model, and its value is a nested spec applied to the related model. `{}` is the empty spec: all scalars, no relations.
5. No `'+'` and no `'-'` means every scalar.
6. Relations are absent unless they appear in `'+'` or as a key.
7. Cardinality and nullability come from the model at every level: a to-many relation is `T[]`, a nullable to-one is `T | null`, a required to-one is `T`.

`'+'` and `'-'` cannot collide with field names because neither is a valid identifier.

### Examples

```ts
Shape<User, {}>                                              // Scalars<User>
Shape<User, { posts: {} }>                                   // all of User, plus posts
Shape<User, { '+': 'id' | 'name' | 'posts' }>                // id, name, and posts
Shape<User, { '-': 'passwordHash'; posts: {} }>              // all but the hash, plus posts
Shape<User, { posts: { '+': 'title'; comments: {} } }>       // posts narrowed to title, with comments
Shape<Task, { project: {} }>                                 // on a polymorphic base: distributes over the variants
```

### What it produces

For a spec at a level, the result is the kept scalars intersected with one property per included relation, each typed as `Shape<Related, nested>` wrapped by the relation's cardinality and nullability, flattened so hover text shows one object. Over a polymorphic union such as `Models.public_AnyTask`, `Shape` distributes so each variant keeps only its own relations, the way `With` was fixed to do in review.

### What it refuses, at compile time

- A name in `'+'` or `'-'` that is neither a scalar nor a relation of the model. The error names the bad key.
- A relation name in `'-'`.
- A relation key whose value is not an object.
- `'+'` and `'-'` at the same level, or a relation both in `'+'` and as a key.

## What is out of scope, deliberately

- **Query features.** No `where`, `orderBy`, `limit`, `count`, `combine`, aggregation. Those are query concerns; their results are transformed into a declared shape by the endpoint's logic.
- **Renaming, computed fields, unions of alternatives.** Compose with TypeScript: `Shape<User, {}> & { postCount: number }`.
- **Contract-level omission**, where a field exists in the database but is hidden from the model by default. That is a contract attribute with runtime consequences and a separate piece of work. `'-'` covers the response-type half of the need today.
- **Nested `'-'` semantics beyond scalars.** `'-'` drops scalars only.

## Relationship to what is on PR #30231

- `Scalars<M>` stays. `Shape<M, {}>` equals it, and `Scalars` remains the name of the default fetch's row.
- `With<M, R>` is removed before merge. `With<User, 'posts'>` is `Shape<User, { '+': 'posts' }>` plus all scalars, which the object form spells as `Shape<User, { posts: {} }>`. Keeping both would be two overlapping helpers.
- `ResultType<typeof query>` stays, for the other direction: when someone wants the raw shape of a query for an internal helper or a test. It needs the query bound to a name, because `typeof` cannot take a call expression.
- The invariant tests change shape: for every fixture model, `ResultType` of a plain `.include(r)` equals `Shape<M, { r: {} }>`, and a `.select(...)` projection equals `Shape<M, { '+': ... }>`. The refined-include nullability rule is unchanged.
- The docs page's "A view with relations" section and the Prisma 7 mapping row for `GetPayload` become `Shape`.

## Naming

`Shape` was chosen over `View` (a database term), `Payload` (Prisma 7's word, and it means "what a query returned", the meaning we are separating from), and `Projection` (query vocabulary). `'+'` and `'-'` were chosen over `pick`/`omit`/`select` keys because words collide with field names and sigils cannot.

## Alternatives considered

- **Booleans per key**, `{ id: true; posts: { title: true } }`. Prisma 7's form. Rejected as verbose; every scalar must be listed for the wide case, or a wildcard sigil added.
- **Dotted relation paths as a union**, `'id' | 'posts.title' | 'posts.comments'`. One flat grammar; composes as unions; validates per path. Rejected because deep trees repeat prefixes per leaf and exclusion needs a sigil; nested objects read better.
- **A relation value being the type that sits there**, `{ author: User }`. Rejected: makes the user import and restate what the contract already knows.
- **Scalar picking only via `Pick` outside**, with `Shape` handling relations only. Works at the top level, but nested narrowing has nowhere to go. `Pick` and `Omit` still work on a `Shape` result for those who prefer them.

## What building it changed (2026-09-09)

The implementation confirmed every rule and refusal as written, with a six-level nested spec through a model cycle typechecking without depth problems. Two additions came out of it and are folded into the rules above: the spec constraint is public as `ShapeSpec`, since it is F-bounded and nothing else satisfies `Shape`; and a relation appearing in both `'+'` and as a key at one level is refused. Repo tests spell the empty spec `Record<never, never>` because Biome bans `{}` in this repo; user code keeps `{}`.

## Open questions

- Whether `{}` as "everything" reads well enough, or whether the wide case wants a spelling like `posts: true` after all. The brief takes `{}` to keep one concept per key.
- Whether `'-'` should also be allowed on a relation listed in `'+'` at the same level to remove one of its scalars. The brief says no; use a nested spec.

## Implementation notes

- One recursive conditional type in `framework-components/src/execution/model-types.ts`, replacing `With`. Distributive over `M`. Validation of names via the constraint on `Spec`, built from `RelationNamesOf<M>` and `keyof Scalars<M>`, so errors land on the offending key.
- Type tests: the framework file covers every rule and every refusal; the SQL and Mongo ORM files replace their `With` equalities with `Shape` equalities for plain includes, projections, nullable to-one, to-many, polymorphic base and variant, and a two-level nest.
- Docs: the reference page, ADR 250, the user skill, the PR body, and `slice-2-extract-models-brief.md` replace `With` with `Shape`.
