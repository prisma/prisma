# Slice 5: packages contribute collection methods computed from a model

**Project:** [spec](../../spec.md), [plan](../../plan.md). **Design:** [ADR 272](../../../../docs/architecture%20docs/adrs/ADR%20272%20-%20Packages%20contribute%20collection%20methods%20computed%20from%20a%20model.md), agreed with Will 2026-10-13. **Ticket:** TML-3549. **Spike:** `spike-findings.md` on branch `spike-whole-model-collection-methods` (chosen state `cd04267edf`). **Replaces:** the index-only design of PR #30693, rejected 2026-10-13; this slice starts from main, not from that branch.

## At a glance

```ts
await db.Post.using.post_search(q).limit(10).all();
await db.Post.where({ userId }).using.embedding_nearest(vector).limit(5).all();
await db.User.include('posts', (posts) => posts.using.post_search(q).limit(3)).all();
```

## Chosen design

As ADR 272 states. In short:

- **Contribution.** A type half, an interface extending `CollectionMethodsEntry` whose `methods` is computed from `this['model']`, registered in `CollectionMethodRegistry` (relational core) by declaration merging; and a run-time half with the same id whose `methodsFor(model)` returns the model's methods by name.
- **What a contribution reads.** One model: target, name, fields with codec ids and type parameters, relations, storage table with columns and indexes.
- **Names.** Chosen by the contribution. No naming rule in the ORM.
- **Run time.** Target and extension descriptors may carry `collectionMethods`. `orm()` asks each contribution for each model's methods once per execution context, and refuses duplicate ids and duplicate method names on one model with `ORM.ARGUMENT_INVALID` (with `why` and `fix`). `using` binds the model's methods to the collection.
- **Types.** For each model the ORM builds the model's view, reads each entry's `methods` by indexed access (not `infer`), and merges the tables; a name two entries give is `CollectionMethodNameClash<Name, Model, Ids>`. Each method is `<Receiver extends Self = Self>(...args) => Ordered<Filtered<Receiver>>`.
- **Where types load.** Through each package's own entry points: the Postgres full-text entry through `@prisma/orm-postgres/runtime` and `/serverless`, pgvector's through its runtime entry. Nothing the emitted `contract.d.ts` imports may load a registration.
- **Contributions shipped.** Postgres full-text (one method per `fullText` index, named after the index) and pgvector nearest neighbour (one method per `pg/vector@1` field, `<field>_nearest(vector, maxDistance?)`, vector length typed from the field).
- **Order.** A contributed method's order appends where it is called.
- **Reserved names.** `using` is a member of every collection: a custom class cannot declare its own `using`, and an aggregate named `using` is refused.

## Scope

In: relational core (registry, entry and contribution types), the SQL runtime execution context and descriptors (`collectionMethods`), `packages/3-extensions/sql-orm-client` (model view, merge, clash type, `using`, run-time assembly, refusals, README), the Postgres target and facade (full-text contribution and where its types load), the serverless Postgres client, `packages/3-extensions/pgvector` (nearest-neighbour contribution), the shell build's `declare module` rewriting, `examples/prisma-8-demo` (a search command and a nearest-neighbour command using `using`, their tests, the declaration-emit test), `skills/prisma-8/references/queries-postgres.md`, an upgrade entry for the reserved `using`, ADR 272 (Accepted, with final cost), ADR 270's "Later decision" section (point to ADR 272), ADR 265's method table (add `using`), ADR 259's reserved-names sentence, and the pattern doc `docs/architecture docs/patterns/declaration-merging-registries.md`.

Out: MongoDB; methods declared in the schema; methods placed directly on the collection; the class of a related model inside an include refinement; `GroupedCollection`, prepared collections.

## Pre-investigated edge cases

- **Empty interface lint.** Biome rewrites an empty interface to a type alias, which cannot be merged. Use the marker member, never a `biome-ignore`.
- **`infer` is expensive.** Reading an entry's table with a conditional type and `infer` cost about one point more than indexed access in the spike.
- **The clash message.** A type alias around the owners printed as the alias name; the mapped type written inline printed the contribution ids.
- **Names unknown at the type level.** When the namespace or model is `string`, `using` has no members, not an index signature.
- **Include refinements.** `this` in the getter on an `Omit<Collection, …>` is the full `Collection`; terminals reappear on the result there; the run-time refusal stays.
- **Generic subclass.** `class Library<M extends 'User' | 'Post'> extends Collection<Contract, M>` reading `this.using` must compile (spike: it does).
- **Variants.** On a collection narrowed by `variant`, a contribution sees the base model's table.
- **Fragments.** `using` inside a fragment for one model works; inside a fragment for any model it has no members.
- **A library's declaration file.** A library that uses contributed methods only inside function bodies emits a `.d.ts` that does not load the registration. Record it; the demo's declaration-emit consumer imports the client, as an application does.
- **The registry is global to a program.** A client built without a package shows its methods if the program imports the package; the existing pack check throws at construction when the contract lists a missing pack.
- **Duplicate index names in one table** (an index's authored name shared by two indexes): the full-text contribution gives no method for that name.

## Slice-specific done conditions

- Type tests: root, after `where`/`limit`/`select`, inside an include refinement, on `this` in a custom class, in a generic subclass, inside `with` and a fragment for one model; result keeps the custom class and gains `Filtered` and `Ordered`; nothing is `any`; `postgres<Contract>({ contractJson, extensions })` unchanged.
- Compile errors pinned by a compiler test: a misspelled method, a model without methods, a name clash naming both contributions.
- A test-only contribution that reads a field's codec and one that names a method not derived from the schema each add methods with no ORM client change.
- A separate program with only the ORM client and the contract types has no contributed methods; one that imports the Postgres client and pgvector has them.
- Run-time tests: refusal of duplicate ids and duplicate names; the SQL of `orderBy` before and after a contributed method.
- Integration tests against Postgres (one new file under `test/integration/test/sql-orm-client/`): whole-shape results at the sites above for both contributions; title match above body match; `EXPLAIN` with sequential scans off shows the full-text index used.
- Demo commands and tests use `using.post_search` and `using.embedding_nearest`; the declaration-emit test covers an exported class whose method uses `using`.
- Type-checking cost on the demo and the client package, unused and ten uses, recorded in ADR 272 with commits and command; unused cost on the demo at or below +1.5%.

## Open questions

None.
