# ADR 272 — Packages contribute collection methods computed from a model

**Status:** Proposed
**Date:** 2026-10-13
**Builds on:** [ADR 270 — ORM queries use the query builder's functions and a model's indexes](ADR%20270%20-%20ORM%20queries%20use%20the%20query%20builder's%20functions%20and%20a%20model's%20indexes.md), [ADR 265 — A collection keeps its class through the chain](ADR%20265%20-%20A%20collection%20keeps%20its%20class%20through%20the%20chain.md), [ADR 259 — Query fragments are functions](ADR%20259%20-%20Query%20fragments%20are%20functions.md), [ADR 210 — Index-type registry](ADR%20210%20-%20Index-type%20registry.md)

---

## At a glance

A schema declares a full-text index and a vector field:

```prisma
types {
  Embedding1536 = pgvector.Vector(1536)
}

model Post {
  id        Int            @id
  title     String
  body      String?
  embedding Embedding1536?

  @@fullTextIndex([title, body], name: "post_search")
}
```

The application can search posts with no code of its own:

```ts
await db.Post.using.post_search(websearchToTsquery(input)).limit(10).all();
await db.Post.using.embedding_nearest(queryVector).limit(5).all();
```

- `post_search` comes from the Postgres package. It gives one method for each full-text index, named after the index. The method keeps the posts that match and orders them by relevance.
- `embedding_nearest` comes from the pgvector package. It gives one method for each vector field, named after the field.
- Each package reads the model from the contract and decides which methods to give and what to call them. The ORM client collects them under `using`.

## Decision

1. **A package can contribute collection methods.** For each model, the package reads the model and returns a table of methods. A method is a collection method like `where` or a method of a custom collection class: it receives the collection and returns it refined.
2. **A contribution reads one model at a time:** the contract's target, the model's name, its fields with their codec ids and type parameters, its relations, and its storage table with columns and indexes. It does not read other models.
3. **The package names its methods.** The ORM imposes no naming rule. Our packages name a method that serves an index after the index, and a method that serves a field after the field.
4. **The ORM client offers the contributed methods under `using` on every collection.** A method returns the collection it was called on, with the `Filtered` and `Ordered` facts of what it applied (ADR 265).
5. **The schema declares no methods.** A package works its methods out from what the contract already holds. The schema author controls them through the schema: naming an index names its method.
6. **The types reach the application through a registry filled by declaration merging, loaded by the package's own import.** Never through the emitted `contract.d.ts` or anything it imports. The application writes `postgres<Contract>({ contractJson, extensions })` as today.
7. **Two contributions that give one model a method with the same name are an error:** a compile error where the method is called, and a run-time refusal when the client is created.
8. **A contributed method's order is an ordinary order.** It is added where the method is called, as `orderBy` is.
9. **Each ORM client defines its own contribution interface.** This ADR defines the SQL ORM's. A MongoDB contribution's body would add pipeline stages, not `where` and `orderBy`, so it needs the MongoDB ORM's own interface, designed when its first case arrives.

## Why

### Every application wrote the same query

ADR 270 lets an ORM query name an index, so a search matches the index exactly:

```ts
db.Post
  .where((p, { fns, indexes }) => fns.fullTextMatches(indexes.post_search, q))
  .orderBy((p, { fns, indexes }) => fns.fullTextRank(indexes.post_search, q).desc());
```

Every application that searches writes these lines, usually as a method of its collection class. Nothing in them belongs to the application. The package that owns the index type knows the query, so it writes it once, for every model it applies to.

### A package needs the whole model, not one index

The cases a package serves read different parts of a model:

| Case | Reads |
| --- | --- |
| Postgres full-text search | The table's `fullText` indexes, with their weights and language |
| pgvector nearest neighbour | A field's codec (`pg/vector@1`) and its length |
| A feature of the whole table, such as querying a system-versioned table as of a time | A table property; one method per model, with a name nothing in the schema gives |

So a contribution receives the whole model and returns whatever methods it finds there. Limiting it to one index, or deciding names in the ORM, would rule out the second and third rows.

A field already has its own operations, such as `cosineDistance` or `fullTextMatches`. A contributed method adds what a field operation cannot: a filter and an order together, and the settings an index holds, so the query matches the index.

### The package names its methods

Only the package knows what a method does, so only it can name it well. Naming a method after the element it serves is the convention our packages follow, because readers can then predict the name from the schema. A feature of the whole table has no element to name it after, and needs no special case.

### Grouped under `using`

`using` keeps contributed names apart from the collection's own methods and from a custom class's methods, so neither side can break the other by adding a method later. Placing contributed methods directly on the collection was measured in an earlier spike at about 4% more type checking for every application, and it breaks generic collection subclasses (TS2509) and custom class methods that share a name (TS2416).

### Types through the package's own import

The application already imports each package it uses, to pass it to the client, so that import can register the package's method types. The two other routes fail:

- **A type argument inferred from the client call.** TypeScript infers no further type argument once the application writes `<Contract>`, so the application would have to write the contributions' types.
- **The emitted `contract.d.ts`.** The contract's types describe the contract's data. They must not carry the types of one query interface, because the ORM client is interchangeable.

The registry is global to a program: a client built without a package still shows that package's methods if anything in the program imports it. A method still only appears on a model with the matching field or index, and a client created without a package the contract lists already throws ("Contract requires extension pack(s) …").

## How it works

### A contribution

A contribution has a type half and a run-time half. The pgvector one:

```ts
type NearestMethodTable<Model extends CollectionMethodModel> = {
  readonly [Name in VectorFieldNames<Model['fields']> & string as `${Name}_nearest`]: readonly [
    vector: Vector<VectorLength<Model['fields'][Name & keyof Model['fields']]>>,
    maxDistance?: number,
  ];
};

export interface PgvectorNearestMethods extends CollectionMethodsEntry {
  readonly methods: NearestMethodTable<this['model']>;
}

declare module '@internal/sql-relational-core/query-lane-context' {
  interface CollectionMethodRegistry {
    readonly 'pgvector/nearest': PgvectorNearestMethods;
  }
}

export const pgvectorNearestMethods: CollectionMethodContribution = {
  id: 'pgvector/nearest',
  methodsFor: (model) =>
    Object.fromEntries(
      vectorFields(model).map((field) => [
        `${field}_nearest`,
        (collection, vector, maxDistance) => /* where and orderBy on the field's distance */,
      ]),
    ),
};
```

- **The type half** is an interface whose `methods` is computed from `this['model']`. The ORM client fills `model` with each model's type and reads `methods` back: method names and their parameter lists.
- **The run-time half** has the same id. `methodsFor` returns the model's methods by name. Each method receives the collection and the arguments and returns the collection, using only `where`, `orderBy` and ADR 270's `fns` and `indexes`.
- `CollectionMethodRegistry` declares one optional marker member, so it is never an empty interface. An empty interface is rewritten by the lint to a type alias, which cannot be merged.

### At run time

A target or extension descriptor may carry `collectionMethods`. When the ORM client is created, it asks each contribution for each model's methods once per execution context, and refuses with `ORM.ARGUMENT_INVALID` two contributions with the same id or two that give one model the same method name. A collection's `using` binds the model's methods to that collection.

### In the types

For each model, the ORM client builds the model's view, reads every registered entry's `methods` by indexed access, `(Entry & { readonly model: View })['methods']`, and merges the tables. A name that two entries give becomes `CollectionMethodNameClash<Name, Model, Ids>`, which has no call signature, so calling it fails with an error naming the method, the model and both contributions. `using` maps each parameter list to a method generic over its receiver, `<Receiver extends Self = Self>(...args) => Ordered<Filtered<Receiver>>`.

The error texts:

```
Property 'search' does not exist on type 'CollectionMethods<Contract, "User", "public", ...>'.

This expression is not callable.
  Type 'CollectionMethodNameClash<"labelled", "Tag", "test/clash-a" | "test/clash-b">' has no call signatures.
```

### Where the types load

The Postgres full-text entry loads through the Postgres client's own entry points (`@prisma/orm-postgres/runtime` and `/serverless`). The pgvector entry loads through the pgvector package's runtime entry. The emitted `contract.d.ts` imports neither.

### Cost

Type instantiations, `pnpm typecheck --extendedDiagnostics`, TypeScript 5.9.3, each count run twice with the same result, against the main commit the spike started from (`5ce30c940b`). The demo registers two contributions, full-text and pgvector.

| | Client package, unused | Ten uses | `examples/prisma-8-demo`, unused | Ten uses |
| --- | --- | --- | --- | --- |
| Before | 2,393,607 | — | 904,324 | — |
| This design | +1.66% | +1.73% | +1.20% | +1.39% |

Reading an entry's table with a conditional type and `infer` instead of indexed access cost about one more point in both. The implementation records its final numbers here.

## Consequences

- **An application searches a model with no code.** The Postgres clients register the full-text contribution for every application, and pgvector registers its own.
- **Any package can add methods from anything in a model,** with no change to the ORM client.
- **`using` is a member of every collection.** A custom class cannot declare its own `using`, and an aggregate cannot be named `using`.
- **A library that uses contributed methods only inside function bodies** emits a declaration file that does not load the package's types. A program that sees only that file and the contract types has no methods until it imports the package itself. An application always imports its client, so this only affects such a program.
- **Two cases the types accept that they should not.** A method infers its receiver from an expected type, so `const x: PostCollection = plain.using.post_search(q)` compiles when `PostCollection` is a subtype of the receiver. Inside an include refinement the result has the terminal methods back, so `.all()` compiles there; the ORM already refuses a terminal inside a refinement at run time.
- **The word "scope" keeps its meaning** (ADR 259): a query fragment that only imposes conditions. A contributed method may also order, so it is a collection method.
- **The MongoDB ORM client is unchanged.** Its first contribution, such as `$geoNear`, will also need its indexes to have names in the contract.

## Alternatives considered

- **A contribution matches one index type, and its method is named after the index.** The first version of this ADR. It cannot serve a method computed from a field or from the table, and it decides names in the ORM.
- **The package declares rules (per index, per field, per model) and the ORM builds names from a prefix and suffix.** About 0.5 points cheaper in the client package, but the ORM decides the names, and a rule cannot express "every model whose table has a column of codec X".
- **Methods declared in the schema,** for example in a `scopes {}` block. Every case so far can be worked out from the model, and declarations would put the ORM's surface into the contract.
- **Methods placed directly on the collection, `db.Post.post_search(q)`.** About 4% more type checking for every application, and it breaks generic collection subclasses (TS2509) and class methods sharing a name (TS2416).
- **The method types loaded through the emitted `contract.d.ts`.** It ties the contract's types to one query interface.
- **The contributions as a type argument of the client.** TypeScript infers no further type argument once `<Contract>` is written.
- **A method name made of two parts, element then operation (`using.embedding.nearest(v)`).** Unnecessary once the package names methods itself; it can choose such names if it wants them.
