# ADR 224 — Namespace concretions address entities by coordinate

**Status:** Accepted
**Date:** 2026-06-03

---

## A concrete example

Suppose a generic walker needs to look up a storage entity by its coordinate `{ namespaceId, entityKind, entityName }` — a migration planner deciding whether two operations touch the same entity, a validator checking for cross-namespace collisions, or a CLI introspection tool listing every named thing in a contract. In Postgres, where a namespace (a schema) holds two kinds of entities — tables and enum types — the walker reaches into `storage.namespaces` and asks for `('public', 'table', 'user')` or `('public', 'type', 'user_role')`.

The lookup is structural and uniform:

```ts
const entity = storage.namespaces[namespaceId].entries[entityKind][entityName];
```

That single expression works for any kind a target or extension pack contributes — `table` for SQL, `type` for Postgres enums, `collection` for Mongo, and any future kind a pack hangs off `entries` — without the walker ever learning the kind's name.

Concretely, here is a `PostgresSchema` instance — the Postgres target's `Namespace` concretion:

```ts
{
  id: 'public',
  // kind: 'schema' — non-enumerable
  entries: {
    table: {
      user: <StorageTable>,
      post: <StorageTable>,
    },
    type: {
      user_role: <PostgresEnumType>,
    },
  },
}
```

Two things to notice, because the rest of this document builds on them. First, every entity-kind slot map lives under a single `entries` container, not as sibling properties of `id`. Second, each slot key — `table`, `type` — is the entity kind itself, in the singular, named for what each entity *is* rather than for the collection it belongs to.

---

## Decision

The framework `Namespace` interface promises three properties, and only three:

1. `id` — the namespace's enumerable string identifier.
2. `kind` — a non-enumerable string discriminator naming the concretion class (`'schema'`, `'mongo-namespace'`, …).
3. `entries` — a frozen object whose own-enumerable keys are entity kinds (singular, essence-named: `table`, `type`, `collection`) and whose values are frozen maps from entity name to IR class instance.

Every target's namespace concretion (`PostgresSchema`, `MongoBoundNamespace`, …) implements this shape. The contract-IR coordinate `(plane, namespaceId, entityKind, entityName)` — see [ADR 221](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md) — addresses the entity directly through `entries`:

```ts
storage.namespaces[namespaceId].entries[entityKind][entityName]
```

No consumer-side translation table maps the coordinate's `entityKind` to a property name. The kind *is* the property name.

---

## The path follows from the coordinate

[ADR 221](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md) establishes that every named storage entity has a single canonical address — `(plane, namespaceId, entityKind, entityName)` — and that the framework exposes a free function `elementCoordinates(storage)` that yields this tuple for every entity in a contract. The coordinate is the vocabulary every consumer agrees on: migration planners, validators, hashing, cross-plane reference checks.

A coordinate is only useful if it resolves. The question every consumer asks after receiving one is "given this `(namespaceId, entityKind, entityName)`, hand me the entity." There are two ways to answer it.

One is to translate the kind to a property name on the way in:

```ts
function resolve(storage, { namespaceId, entityKind, entityName }) {
  const ns = storage.namespaces[namespaceId];
  switch (entityKind) {
    case 'table':       return ns.tables[entityName];
    case 'type':        return ns.enum[entityName];
    case 'collection':  return ns.collections[entityName];
    // …one branch per kind the consumer expects to see
  }
}
```

Every consumer that resolves a coordinate has to carry this dispatch. It is a hand-written mapping table from kind names to property names, and each consumer has to learn every kind that exists — including kinds a target pack contributes that the framework's authoring tools see but that the consumer never compiled against.

The other answer is to make the property name *be* the kind:

```ts
function resolve(storage, { namespaceId, entityKind, entityName }) {
  return storage.namespaces[namespaceId].entries[entityKind][entityName];
}
```

Now the coordinate *is* the path. Any kind a pack contributes — RLS policies, materialised views, Postgres roles, a future indexing kind — works through the same expression on the day the pack lands. The framework walker (`elementCoordinates`), the validators, the planner's disjoint calculation, and downstream tooling all dispatch by walking `entries` structurally, never by knowing which kinds exist.

This is what makes the coordinate a coordinate: it addresses the entity directly, not through a per-kind lookup table that the consumer has to maintain.

## Why `entries` is a container, not flat siblings

A namespace concretion carries more than entity-kind slot maps. `PostgresSchema` has an `id` (the schema name), a non-enumerable `kind` discriminator, and methods that aren't structural data at all — `qualifier()`, `qualifyTable()`, `ddlSchemaName()`, `regclassLiteral()` — plus, on subclasses, runtime-only fields like the late-bound singleton's identity. The framework's promise about a namespace cannot be "every own-enumerable property is an entity-kind slot map", because not every own-enumerable property is one.

If entity-kind slot maps lived flat next to `id`, the framework walker would have to learn the closed denylist of non-slot keys: `id`, qualifier helpers, target-specific runtime fields, anything a future concretion might add. The walker would still be guessing about which keys are entity-bearing, and that guess would have to stay in sync with every concretion across every target and pack.

`entries` is the structural fence. Outside `entries`, the concretion's surface is open — `id`, methods, helper fields, target-specific data, whatever the concretion needs. Inside `entries`, the framework gives an absolute promise: every own-enumerable property is an entity-kind slot map whose values are entity instances keyed by entity name. The framework walker enumerates `Object.keys(namespace.entries)` and trusts the shape without consulting a denylist or a per-kind allowlist.

The promise is enforced by construction. The `Namespace` interface types `entries` as `Readonly<Record<string, Readonly<Record<string, unknown>>>>`. Each concretion freezes the outer `entries` object *and* each inner per-kind map at construction time, before sealing the IR node itself — so adding, removing, or mutating a slot after construction is a runtime error rather than a quiet drift.

## Why slot keys are singular and essence-named

The slot keys are `table`, `type`, `collection` — not `tables`, `enums`, `collections`, and not `postgresEnums` or `mongoCollections`.

**Singular.** The lookup expression reads `entries[entityKind][entityName]`. If `entityKind` is `'table'`, the slot key has to be `'table'` for the path to equal the coordinate. The alternative is to keep plural keys and translate at every consumer site — `entries[pluralise(entityKind)]` — which is the same translation table that flat sibling slots forced, only moved one level deeper.

**Essence, not pack provenance.** A kind names what an entity *is* — a table, a Mongo collection, a Postgres enum *type*. Multiple packs may contribute to the same kind: a hypothetical second SQL target that emulates Postgres enums would contribute to `entries.type` under its own discriminator, not to a new `postgresEnums` slot. Naming the slot for the contributing pack would fragment the kind space and reintroduce the consumer-side dispatch the coordinate model is meant to eliminate.

The coordinate's `entityKind` and the slot key are now the same string by construction. The on-disk JSON envelope nests entity maps under `entries` and carries the same singular kind names — the runtime IR and the persisted contract agree on the shape.

---

## Consequences

**Generic consumers stay generic.** Code that looks up an entity by coordinate writes one expression and uses it across every target and every pack. There is no per-target adapter, no kind-to-slot mapping, no consumer-side awareness of which slots exist.

**Pack-contributed kinds are reachable on day one.** A pack contributing a new entity kind (RLS policies, materialised views, sequences) names its slot for the kind in the singular and hangs the map off `entries`. The framework walker, validators, and migration tooling reach the entries through the same structural walk that already finds `table`, `type`, and `collection` — no framework change required.

**The framework walker's invariant is structural, not conventional.** The promise "every own-enumerable property of a namespace's `entries` is an entity-kind slot map" is enforced by the shape of `entries`, not by a comment that says "remember not to add other fields here." There is exactly one container; non-entity data lives outside it.

**Namespace concretions remain deeply immutable.** The `entries` container freezes both the outer object and each inner per-kind map at construction. Combined with the IR-node freeze that seals the surrounding concretion, mutation after construction is impossible, and the IR's structural-equality and content-hash guarantees hold without per-consumer defensive copying.

**The contract envelope shape is part of the public contract.** The on-disk `contract.json` nests entity maps under `entries`. Downstream tooling that walks raw JSON (rather than rehydrating to classes) reads through the same `entries[kind][name]` path. Because `storageHash` is content-addressed, the persisted shape is fixed by hashing — this is the long-term shape.

---

## Alternatives considered

**Keep flat slot keys (`tables`, `enum`, `collections`); only fix the kind-to-slot mapping in consumers.** Rejected. The mapping table doesn't disappear; it migrates from the IR to every consumer, where each one has to keep it current. Pack-contributed kinds are unreachable until every consumer learns the new mapping, which defeats the coordinate model's promise that `elementCoordinates` yields walkable tuples generically.

**Lift to `entries` but keep plural slot keys (`entries.tables`, `entries.collections`).** Rejected. The coordinate's `entityKind` is singular (`'table'`) but the slot key would be plural (`'tables'`), so consumers would still translate at every lookup. Moving the translation one level deeper does not eliminate it. The slot key has to *be* the kind for the path to equal the coordinate.

**Singular slot keys at the top level, no `entries` container.** Rejected. Without a structural fence, the framework walker has no way to tell entity-kind slot maps apart from a concretion's other own-enumerable properties — `id`, target-specific data, future fields a concretion might add. The walker would need a denylist of non-slot keys that every concretion would have to keep in sync with the walker. `entries` is the fence that lets the walker promise "every own-enumerable property here is an entity-kind slot map" structurally, without a denylist.

**Translate at the JSON serializer boundary** — keep the runtime shape with `entries`, keep the on-disk JSON flat. Rejected. The JSON envelope's job is to serialize the IR faithfully; a serializer that reshapes the IR at the boundary makes the runtime model and the on-disk model drift, and erodes the "the JSON is the IR" mental model that tooling relies on. Internally consistent artefacts are a stronger property than byte-stable JSON.

---

## References

- [ADR 221 — Contract IR two planes with uniform entity coordinate and pack-contributed entity kinds](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md)
- [Architecture Overview](../../Architecture%20Overview.md)
