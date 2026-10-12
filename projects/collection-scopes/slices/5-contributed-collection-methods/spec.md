# Slice 5: a package contributes collection methods for the index types it owns

**Project:** [spec](../../spec.md), [plan](../../plan.md). **Design:** [ADR 272](../../../../docs/architecture%20docs/adrs/ADR%20272%20-%20A%20package%20contributes%20collection%20methods%20for%20the%20index%20types%20it%20owns.md), approved by Will 2026-10-12. **Ticket:** TML-3549. **Spike:** `projects/collection-scopes/spikes/scope-call-forms.md` and form B (`665ad1b39a`) on branch `spike-slice-5-scope-forms`.

## At a glance

```ts
await db.Post.using.post_search(q).limit(10).all();
await db.Post.where({ userId }).using.post_search(q).all();
await db.User.include('posts', (posts) => posts.using.post_search(q).limit(3)).all();
```

## Chosen design

As ADR 272 states. In short:

- **Registry.** `CollectionMethodRegistry` in the ORM client, extended by declaration merging. It declares one optional marker member so it is never an empty interface; no lint suppression.
- **A contribution** has an id, a `match` index shape (types) and `matches` predicate (run time), the method's `parameters`, and a body `(collection, indexName, ...args) => collection` that uses only the public collection surface and ADR 270's `fns` and `indexes`.
- **Run time.** Target and extension descriptors may carry `collectionMethods`; the execution context collects them; the client refuses, at construction, duplicate ids and two contributions matching the same index (`ORM.ARGUMENT_INVALID`, with `why` and `fix`). A collection's `using` getter builds one function per matching index, once per model.
- **Types.** `using` is `CollectionMethods<Contract, Model, NsId, this, Table>`; each method is generic over its receiver, `<Receiver extends Self = Self>(...args) => Ordered<Filtered<Receiver>>` (or only the facts the contribution declares it applies). The method table (names and parameters) is computed once per model.
- **Order.** A contributed method's order is an ordinary order: it appends where it is called.
- **Postgres.** The target contributes `postgres/fullText` (filter by `fullTextMatches`, order by `fullTextRank` descending, both naming the index), registered through `postgres()` and the serverless client.
- **Reserved names.** `using` is a member of every collection: a custom class cannot declare its own `using`, and an aggregate operation named `using` is refused like `fragment` and `with` are.
- **Declaration output.** The published facades must rewrite `declare module '@internal/sql-orm-client'` to the published module name, as the spike did, and the demo's declaration-emit test must cover an exported collection class whose method uses `using`.

## Scope

In: `packages/3-extensions/sql-orm-client` (registry, `using`, types, run-time assembly, refusals, README), the SQL execution context and component descriptors that carry `collectionMethods`, `packages/3-targets/3-targets/postgres` or `packages/3-extensions/postgres` (the full-text contribution, whichever owns runtime contributions today; follow how query operations are contributed), the serverless Postgres client, the publish/shell build step for `declare module` rewriting, `examples/prisma-8-demo` (use `db.Post.using.post_search(q)` in a command and its test), `skills/prisma-8/references/queries-postgres.md`, ADR 272 (Accepted, with final cost), ADR 270's "Later decision" section (point to ADR 272), ADR 265's method table (add `using`), ADR 259's reserved-names sentence.

Out: methods placed directly on the collection; more than one method per index; MongoDB; contributions declared in the contract; `GroupedCollection`, prepared collections.

## Pre-investigated edge cases

- **Empty interface lint.** Biome rewrites an empty interface to a type alias, which cannot be merged. Use the marker member, never a `biome-ignore`.
- **Names unknown at the type level.** When the namespace or model is `string`, the index map has a string index signature; `using` must then have no members, not an index signature.
- **Include refinements.** `this` in the getter on an `Omit<Collection, …>` is the full `Collection`; record (do not try to fix) that terminals reappear on the result there; the run-time refusal stays.
- **Receiver inference from an expected type.** `<Receiver extends Self = Self>` refuses unrelated types and accepts subtypes; record it in a type test.
- **A shared parameter.** The query appears in the filter and the order; the adapter binds it once.
- **Variants.** On a collection narrowed by `variant`, `using` serves the base model's table's indexes, like ADR 270's `indexes`.
- **Fragments.** `using` inside a fragment for one model works; inside a fragment for any model (`db.orm.fragment(fields, body)`) the body's collection has no `using` members.
- **A pack the contract does not list.** Its contribution matches no index, so it adds no members.

## Slice-specific done conditions

- Type tests: root, after `where`/`limit`/`select`, inside an include refinement, on `this` in a custom class, inside `with` and a fragment for one model; result keeps the custom class and gains `Filtered` and `Ordered`; misspelled method name and a model without a full-text index are compile errors naming `CollectionMethods`; `postgres<Contract>({ contractJson, extensions })` unchanged; nothing is `any`.
- A test-only contribution for a test-only index type adds its own method with no ORM client change.
- Run-time tests: refusal of duplicate ids and of two contributions matching one index; the SQL of `orderBy` before and after a contributed method.
- Integration test against Postgres (one new file under `test/integration/test/sql-orm-client/`): whole-shape results at the sites above, title match above body match, `EXPLAIN` with sequential scans off shows the index used.
- Demo command and test use `db.Post.using.post_search(q)`; the declaration-emit test covers it.
- Type-checking cost on the demo and the client package, unused and ten uses, measured with the commits and command recorded in ADR 272; unused cost on the demo at or below +1%.

## Open questions

None.
