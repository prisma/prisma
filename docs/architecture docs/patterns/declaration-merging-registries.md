# Pattern: Declaration-merging registries

**Status:** Emerging
**Maintainer:** architect

## Intent

The Postgres target gives every model with a full-text index a method, `db.Post.using.post_search(q)`, and pgvector gives every model with a vector field one, `db.Post.using.embedding_nearest(v)`. The ORM client computes the type of `using` from `CollectionMethodRegistry`, an interface in `@internal/sql-relational-core`. Each package adds its entry with a module augmentation, and the application writes no type argument for it.

A declaration-merging registry is an interface a lower package declares and other packages extend with `declare module`, so that types a package contributes reach a generic computation in another package without the application naming them.

## When to use

- A package contributes types that a computation in another package must see, and the application cannot pass them as a type argument. For example, the facade's `postgres<Contract>(...)` takes `Contract` explicitly, so TypeScript infers no further type argument.
- The contribution only takes effect for data the program already has, such as a field or an index of the contract, so loading a registration the contract does not use is harmless.
- The augmentation can live in a module that every program which needs it already loads, such as the entry point the application imports to use the package.

## When NOT to use

- The types belong to the contract itself. Contract types travel through the emitted `contract.d.ts` and its type imports. The emitted `contract.d.ts` must not load a registration for one query interface.
- A type argument can carry the contribution. Prefer an inferred type argument where the call site allows one.
- Two packages could register the same key with different meanings, and nothing in the key tells them apart. The registry is global to the program: entries from every loaded package merge. Make the key name its owner, such as `pgvector/nearest`.

## Structure

The lowest package that both the contributor and the consumer can depend on declares the registry (see [SPI at the lowest consuming layer](./spi-at-lowest-consuming-layer.md)):

```ts
export interface CollectionMethodRegistry {
  /** Keeps the interface from being empty, which would make it a type alias that cannot be merged. */
  readonly __collectionMethodRegistry?: never;
}
```

- **A marker member.** An empty interface is rewritten to a type alias by the lint, and a type alias cannot be merged. One optional `never` member keeps it an interface without a lint suppression. The consumer excludes the marker key when it reads the registry.
- **An entry computed from an input slot.** An entry is an interface with an input member the consumer fills and an output member computed from `this`: `interface PgvectorNearestMethods extends CollectionMethodsEntry { readonly methods: NearestMethodTable<this['model']> }`. The consumer reads the output by indexed access on the entry intersected with the input, `(Entry & { readonly model: Model })['methods']`. Matching the entry with a conditional type and `infer` gives the same type at a much higher type-checking cost.
- **The augmentation names the internal module.** A contributor writes `declare module '@internal/sql-relational-core/query-lane-context' { interface CollectionMethodRegistry { ... } }` in a module its entry points load.
- **The shell build rewrites the module name.** The published declarations keep the augmentation verbatim, so `packages/0-config/tsdown/shell-build.ts` rewrites `declare module '@internal/...'` to the published specifier, as it rewrites `import("@internal/...")`. An internal module with no published mapping fails the build. Without the rewrite, an application's program sees an augmentation of a module it cannot resolve, and the registry silently stays empty.
- **A run-time half keyed the same.** When the contribution also has behaviour, its run-time object carries the registry key as its `id`, and the consumer refuses two run-time objects with the same id.

## Reference implementations

| Implementation | Path | Demonstrates |
|---|---|---|
| `CollectionMethodRegistry` | [`packages/2-sql/4-lanes/relational-core/src/collection-method-contribution.ts`](../../../packages/2-sql/4-lanes/relational-core/src/collection-method-contribution.ts) | The registry with its marker member, the entry type with its `model` slot, and the run-time contribution type. |
| Reading the registry | [`packages/3-extensions/sql-orm-client/src/collection-methods.ts`](../../../packages/3-extensions/sql-orm-client/src/collection-methods.ts) | Filling each entry's `model` slot, reading `methods` back by indexed access, and typing a name two entries give as a clash. |
| Postgres full-text methods | [`packages/3-targets/3-targets/postgres/src/core/full-text-collection-method.ts`](../../../packages/3-targets/3-targets/postgres/src/core/full-text-collection-method.ts) | A contributor that holds both halves in one module, loaded through the Postgres client's entry points. |
| pgvector nearest-neighbour methods | [`packages/3-extensions/pgvector/src/core/nearest-collection-method.ts`](../../../packages/3-extensions/pgvector/src/core/nearest-collection-method.ts) | A contributor that computes method names and parameter types from a model's fields. |
| Shell rewrite | [`packages/0-config/tsdown/shell-build.ts`](../../../packages/0-config/tsdown/shell-build.ts) | `rewriteInternalModuleNames`, which rewrites augmentations to published module names. |

## Related ADRs

- [ADR 272 — Packages contribute collection methods computed from a model](../adrs/ADR%20272%20-%20Packages%20contribute%20collection%20methods%20computed%20from%20a%20model.md)
- [ADR 210 — Index-type registry](../adrs/ADR%20210%20-%20Index-type%20registry.md), which rejects declaration merging for index types themselves.

## Related patterns

- [SPI at the lowest consuming layer](./spi-at-lowest-consuming-layer.md) decides where the registry lives.

## Cautions / common mistakes

- Declaring the registry in a package the contributor cannot depend on. The contribution then splits across packages, and programs that do not load the second package do not see it.
- Placing the augmentation in a module that only some programs which need it load. A program that does not load it sees an empty registry and no error. A library whose declaration file uses the contributed types only inside function bodies emits no import of the module, so a program that sees only that declaration file has no entries until it imports the package itself.
