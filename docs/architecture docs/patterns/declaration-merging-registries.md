# Pattern: Declaration-merging registries

**Status:** Emerging
**Maintainer:** architect

## Intent

The Postgres target owns the `fullText` index type and gives every model with a full-text index a method, `db.Post.using.post_search(q)`. The ORM client computes the type of `using` from `CollectionMethodRegistry`, an interface in `@internal/sql-relational-core`. The target adds its entry with a module augmentation, and the application writes no type argument for it.

A declaration-merging registry is an interface a lower package declares and other packages extend with `declare module`, so that types a package contributes reach a generic computation in another package without the application naming them.

## When to use

- A package contributes types that a computation in another package must see, and the application cannot pass them as a type argument. For example, the facade's `postgres<Contract>(...)` takes `Contract` explicitly, so TypeScript infers no further type argument.
- The contribution only takes effect for data the program already has, such as an index of the contract, so loading a registration the contract does not use is harmless.
- The augmentation can live in a module that every program which needs it already loads, such as the package's contract type entries, which every emitted `contract.d.ts` imports.

## When NOT to use

- The types belong to the contract itself. Contract types travel through the emitted `contract.d.ts` and its type imports.
- A type argument can carry the contribution. Prefer an inferred type argument where the call site allows one.
- Two packages could register the same key with different meanings, and nothing in the key tells them apart. The registry is global to the program: entries from every loaded package merge. Make the key or a field of the entry name its owner, as a target-owned signature states its `target`.

## Structure

The lowest package that both the contributor and the consumer can depend on declares the registry (see [SPI at the lowest consuming layer](./spi-at-lowest-consuming-layer.md)):

```ts
export interface CollectionMethodRegistry {
  /** Keeps the interface from being empty, which would make it a type alias that cannot be merged. */
  readonly __collectionMethodRegistry?: never;
}
```

- **A marker member.** An empty interface is rewritten to a type alias by the lint, and a type alias cannot be merged. One optional `never` member keeps it an interface without a lint suppression. The consumer excludes the marker key when it reads the registry.
- **The augmentation names the internal module.** A contributor writes `declare module '@internal/sql-relational-core/query-lane-context' { interface CollectionMethodRegistry { ... } }` in a module its type entries load.
- **The shell build rewrites the module name.** The published declarations keep the augmentation verbatim, so `packages/0-config/tsdown/shell-build.ts` rewrites `declare module '@internal/...'` to the published specifier, as it rewrites `import("@internal/...")`. An internal module with no published mapping fails the build. Without the rewrite, an application's program sees an augmentation of a module it cannot resolve, and the registry silently stays empty.
- **A run-time half keyed the same.** When the contribution also has behaviour, its run-time object carries the registry key as its `id`, and the consumer refuses two run-time objects with the same id.

## Reference implementations

| Implementation | Path | Demonstrates |
|---|---|---|
| `CollectionMethodRegistry` | [`packages/2-sql/4-lanes/relational-core/src/collection-method-contribution.ts`](../../../packages/2-sql/4-lanes/relational-core/src/collection-method-contribution.ts) | The registry with its marker member, beside the run-time contribution type. |
| Postgres full-text method | [`packages/3-targets/3-targets/postgres/src/core/full-text-collection-method.ts`](../../../packages/3-targets/3-targets/postgres/src/core/full-text-collection-method.ts) | A contributor that holds both halves in one module, loaded by the target's `operation-types` entry. |
| Shell rewrite | [`packages/0-config/tsdown/shell-build.ts`](../../../packages/0-config/tsdown/shell-build.ts) | `rewriteInternalModuleNames`, which rewrites augmentations to published module names. |

## Related ADRs

- [ADR 272 — A package contributes collection methods for the index types it owns](../adrs/ADR%20272%20-%20A%20package%20contributes%20collection%20methods%20for%20the%20index%20types%20it%20owns.md)
- [ADR 210 — Index-type registry](../adrs/ADR%20210%20-%20Index-type%20registry.md), which rejects declaration merging for index types themselves.

## Related patterns

- [SPI at the lowest consuming layer](./spi-at-lowest-consuming-layer.md) decides where the registry lives.

## Cautions / common mistakes

- Declaring the registry in a package the contributor cannot depend on. The contribution then splits across packages, and programs that do not load the second package do not see it.
- Placing the augmentation in a module that only some programs load, such as one runtime entry point. A program that does not load it sees an empty registry and no error.
