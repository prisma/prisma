# ADR 272 — A package contributes collection methods for the index types it owns

**Status:** Proposed
**Date:** 2026-10-12
**Builds on:** [ADR 270 — ORM queries use the query builder's functions and a model's indexes](ADR%20270%20-%20ORM%20queries%20use%20the%20query%20builder's%20functions%20and%20a%20model's%20indexes.md), [ADR 265 — A collection keeps its class through the chain](ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md), [ADR 259 — Query fragments are functions](ADR%20259%20-%20Query%20fragments%20are%20functions.md), [ADR 210 — Index-type registry](ADR%20210%20-%20Index-type%20registry.md)

---

## At a glance

A schema author declares a full-text index:

```prisma
model Post {
  id     Int     @id
  userId Int
  title  String
  body   String?

  @@fullTextIndex([[title], body], name: "post_search")
}
```

The application can search posts through it at once, with no code of its own:

```ts
const q = websearchToTsquery(input.search);

await db.Post.using.post_search(q).limit(10).all();
await db.Post.where({ userId }).using.post_search(q).all();
await db.User.include('posts', (posts) => posts.using.post_search(q).limit(3)).all();
```

- `post_search(q)` is a collection method, like a method of a custom collection class. The Postgres package contributes it, because it owns the `fullText` index type. It filters to the posts whose weighted title and body match the query, and orders them by relevance.
- `using` groups the methods packages contribute: one for each index of the model's table that a package knows how to query, named after the index.
- The result is the collection it was called on, with the filter and the order recorded (ADR 265). A custom collection class stays the class, and everything that works on a collection works after it.

## Decision

1. **A package that owns an index type can contribute a collection method for indexes of that type.** The contribution names the index type it serves, the method's arguments, and the method's body: a function that receives the collection and the index's name and returns the collection with a `where`, an `orderBy`, or both. The body names the index (ADR 270), so its query is the index's own document.
2. **The ORM client offers these methods under `using` on every collection: `using.<name>` for each index of the model's table that a registered contribution serves.** `<name>` is the index's authored name: the `name:` the schema gave it, or its `map:` name. The contract declares no methods; they follow from the contract's indexes and the registered contributions.
3. **A contributed method's result is the receiver's type plus the `Filtered` and `Ordered` facts** of what it applied. It works on a root collection, after other methods, inside an include refinement, inside a fragment, and on `this` in a custom class.
4. **A contributed method's order is an ordinary order.** It is added where the method is called; an `orderBy` before it comes first, and one after it comes after.
5. **Contributions are registered by declaration merging on the ORM client's `CollectionMethodRegistry` interface, and at run time on the package's descriptor.** The application writes no type arguments: `postgres<Contract>({ contractJson, extensions })` stays as it is.
6. **The Postgres target contributes the method for `fullText` indexes**, through both Postgres clients (`postgres()` and the serverless client).

## Why

### The contract already knows how to query the index

A full-text index states its fields, weights and language (ADR 210, ADR 236). With ADR 270, an ORM query can search it by naming it. Every application that searches would write the same `where` and `orderBy` around the same index, usually as a method of its custom collection class. The package that defines the index type knows that query, so it writes the method once, for every model with such an index.

### Grouped under `using`, not placed on the collection itself

A method the application writes sits directly on its class: `db.Post.published()`. A contributed method could sit there too, as `db.Post.post_search(q)`, and that was measured. It costs every application about 4% more type checking on `examples/prisma-8-demo`, whether or not it uses one, against under 1% for `using.<name>`. It also breaks code that compiles today: a generic subclass such as `class Library<Model> extends Collection<Contract, Model>` fails with TS2509, because the collection's member names would depend on `Model`, and a custom class method with an index's name and another signature fails with TS2416. Under `using`, an index name can never collide with a collection method or a custom class's method, whatever either side adds later.

`using` reads as plain English, "posts, using `post_search`", echoes SQL's `USING` for an index's access method, and does not assume the method is a search: an index type for periods could contribute `db.Booking.using.booking_during(from, to)`.

### One method per index

A contribution gives each index one method, called as `using.<name>(...args)`. An index type that needs a variant of its query takes an options argument. A form with a named method per index type, `using.<name>.fulltext(q)`, costs the same and allows several per index type, but no index type in the repository needs more than one.

### An ordinary order

A draft before this decision gave a search a default order that a later `orderBy` replaced. That is a second kind of order the collection would have to track, and `orderBy` everywhere else appends. A contributed method's order is a sort key like any other, so its position in the chain decides its priority, exactly as for `orderBy`: `db.Post.orderBy((p) => p.pinned.desc()).using.post_search(q)` sorts pinned posts first, then by relevance.

### Registered by declaration merging

A contribution must reach the types of every collection without the application naming it. The facades' `postgres<Contract>(...)` takes the contract type explicitly, and TypeScript infers no further type argument once one is written, so contributions cannot travel as an inferred type argument. The contract's emitted types must not describe one query interface, so they cannot carry them either. A registry interface that each package extends is the form that meets all three.

ADR 210 rejects declaration merging for index types, because a contract that does not attach a pack would see the pack's index types. Here that does not matter: a contribution only produces a method for an index the contract actually has, and a contract only has an index of a type its packs registered. A contribution from a pack the contract does not use matches nothing.

## How it works

### A contribution

```ts
export interface PostgresFullTextMethod extends CollectionMethodKind {
  readonly match: { readonly type: 'fullText' };
  readonly parameters: readonly [query: TsqueryArgument];
}

declare module '@internal/sql-orm-client' {
  interface CollectionMethodRegistry {
    readonly 'postgres/fullText': PostgresFullTextMethod;
  }
}

export const postgresFullTextMethod: SqlCollectionMethodContribution = {
  id: 'postgres/fullText',
  matches: (index) => index.type === 'fullText',
  method: (collection, indexName, query) =>
    collection
      .where((p, { fns, indexes }) => fns.fullTextMatches(indexes[indexName], query))
      .orderBy((p, { fns, indexes }) => fns.fullTextRank(indexes[indexName], query).desc()),
};
```

- `match` is the shape of a contract index the contribution serves, compared with the model's literal index entries.
- `parameters` are the method's arguments.
- The body uses only the public collection surface, so it composes with everything else a collection can do.
- `CollectionMethodRegistry` declares one optional marker member, so it is never an empty interface: the lint that rewrites an empty interface to a type alias, which cannot be merged, does not apply.

### At run time

A target or extension descriptor may carry `collectionMethods`. The execution context collects them, and a collection's `using` getter builds, once per model, one function per index that a contribution matches. The client refuses at construction, with `ORM.ARGUMENT_INVALID`, two contributions with the same id and two contributions that match the same index.

### In the types

`using` is typed as `CollectionMethods<Contract, Model, NsId, this, Table>`: a table of the model's method names and parameter lists, computed once per model, and a receiver. Each method is generic over its receiver, `<Receiver extends Self = Self>(...args) => Ordered<Filtered<Receiver>>`. That generic signature is what keeps the cost low: TypeScript compares collection types often, and a non-generic method that returns its receiver made each comparison recurse through every collection type in the program (+6.5% on the client package, against +1.7%).

Errors name the group: `Property 'search' does not exist on type 'CollectionMethods<Contract, "Post", "public", ...>'`. A model with no matching index has a `using` with no members.

### Cost

Type instantiations, `pnpm typecheck --extendedDiagnostics`, TypeScript 5.9.3, each run twice with the same count, measured in the spike against the tip of ADR 270's implementation. The implementation records its final numbers here.

| | Client package, unused | Ten uses | `examples/prisma-8-demo`, unused | Ten uses |
| --- | --- | --- | --- | --- |
| Before | 1,921,735 | — | 792,100 | — |
| `using.<name>(q)` | +1.7% | +1.8% | +0.8% | +1.0% |

## Consequences

- **An application searches a model with no code.** The Postgres clients register the full-text contribution for every application.
- **An extension pack can add methods for its own index types** by contributing them, with no change to the ORM client. A test-only contribution proves it.
- **`using` is a member of every collection.** A custom class cannot declare its own `using`, and an aggregate operation cannot be named `using`.
- **Two cases the types accept that they should not.** A method infers its receiver from an expected type, so `const x: PostCollection = plainPostCollection.using.post_search(q)` compiles; only a subtype of the receiver is accepted this way. Inside an include refinement the result has the terminal methods back, so `.all()` compiles there; the ORM already refuses a terminal inside a refinement at run time.
- **A contributed method's position in a chain decides its order's priority**, as for `orderBy`.
- **The word "scope" keeps its meaning** (ADR 259): a query fragment that only imposes conditions. A contributed method that also orders is a collection method, not a scope.
- **The MongoDB ORM client is unchanged.** Its indexes have no names in the contract, and some of its searches are pipeline stages, not filters.

## Alternatives considered

- **Contributed methods placed directly on the collection, `db.Post.post_search(q)`.** About 4% more type checking on the demo for every application, and it breaks generic collection subclasses (TS2509) and class methods that share an index's name (TS2416).
- **Other names for the group.** `scopes` gives "scope" a second meaning, since these methods also order; `search` does not fit index types that are not searches; `byIndex` puts a storage term in front of every call; `indexes` collides with ADR 270's `indexes`, where `indexes.post_search` is an index reference, not a method.
- **A named method per index type, `db.Post.using.post_search.fulltext(q)`.** The same cost; allows several methods per index type, which none needs.
- **A default order that a later `orderBy` replaces.** A second kind of order for the collection to track, unlike `orderBy` everywhere else.
- **Methods declared in the contract's domain plane.** A domain entry would carry nothing beyond a name the index already has, and the contract must not describe one query interface.
- **A helper exported by each package**, `fulltextSearchScopes(db.Post).post_search(q)`. It needs code in the application and a generic builder in the ORM.
- **Contributions as a type argument of the facade.** TypeScript infers no further type argument once `Contract` is written, so the application would have to write the contributions' types.
