# ADR 180 — Dot-path field accessor

> **Implementation update (Mongo query builder unification).** The consolidated `FieldAccessor` shipped in `@internal/mongo-query-builder` replaced the earlier `FieldProxy` and `FilterProxy` types — filter and update operators now hang off a single accessor, used by both read callbacks (`match`, `addFields`, `project`, `group`) and write callbacks (`updateMany`, `findOneAndUpdate`, etc.). Type-safe dot-path validation for the callable form `f("address.city")` added a second generic `N extends NestedDocShape` that threads the contract's model + value-object structure through the pipeline, constrains paths by `ValidPaths<N>`, drives the returned `Expression` from the resolved leaf's codec, and surfaces a reduced `ObjectExpression` operator surface for non-leaf paths. Additive pipeline stages preserve `N`; replacement stages (`project`, `group`, `replaceRoot`, …) reset it, disabling the callable form downstream. For paths that are intentionally outside the typed model (canonically, migration authoring where a backfill writes a field that is not yet in the contract), `f.rawPath("path")` is the sanctioned escape hatch — it returns a `LeafExpression<DocField>` with the verbatim path and the full leaf operator surface. The method is named `rawPath` rather than `raw` so the escape hatch does not shadow a legitimate top-level `raw` field on a user model (the callable fallback `f("raw")` is disabled downstream of replacement stages, which would otherwise leave such a field inaccessible).

## At a glance

Querying and mutating nested value object fields through a callable string accessor. Scalar fields are direct properties on the model proxy (existing pattern); value object fields use a dot-path string that navigates into the nested structure:

```typescript
// Scalar field — direct property access (existing pattern)
u.email.eq("alice@example.com")
u.age.gte(18)

// Value object field — string accessor, returns typed Expression
u("homeAddress.city").eq("NYC")
u("homeAddress.location.lat").gte(40.0)

// Extension operations work through value objects too
u("specs.featureVector").cosineDistance([1, 0, 0]).lt(0.5)

// Nullable value object — whole-object null check
u("workAddress").isNull()

// Mutation — per-field operations via the same accessor
db.users.where({ id }).update(u => [
  u("homeAddress.city").set("LA"),
  u("stats.loginCount").inc(1),
  u("tags").push("premium"),
])
```

Two things to notice:

1. **Scalar fields and operators never share a namespace.** Scalar fields are properties on the model proxy (`u.email`); operators are methods on the returned `Expression` (`.eq("NYC")`); value object traversal uses the call signature (`u("path")`). No collision possible.
2. **The same accessor works for queries and mutations.** `u("homeAddress.city").eq("NYC")` builds a filter expression; `u("homeAddress.city").set("LA")` builds a mutation operation. The accessor is a general-purpose path reference.

## Context

[ADR 178](ADR%20178%20-%20Value%20objects%20in%20the%20contract.md) introduces value objects as structured composite fields. To be useful, the query builder and mutation API need a way to reach into these nested structures — filtering by a city inside an address, incrementing a counter inside a stats object, setting a nested field to null.

The existing query builder accesses scalar fields as properties on a model proxy:

```typescript
db.users.where((u, fns) => fns.and(
  u.email.eq("alice@example.com"),
  u.age.gte(18),
))
```

Each property (`u.email`, `u.age`) returns an `Expression` with trait-gated operators ([ADR 202](ADR%20202%20-%20Codec%20trait%20system.md)). The question is how to extend this pattern to value objects without breaking the existing API.

## Problem

How should the query builder and mutation API navigate into value object fields, given that:

1. Value objects can be nested arbitrarily deep (Address → GeoPoint → lat)
2. Value objects can be self-referential (NavItem → children: NavItem[])
3. The API must remain type-safe — the operator set at the end of a path depends on the leaf field's codec
4. The mechanism must not collide with existing operator method names

## Alternatives considered

### Property chaining (`u.homeAddress.city.eq("NYC")`)

Each value object field returns a proxy with properties for its sub-fields, which in turn return proxies for their sub-fields, all the way down.

**Why we rejected it:** Intermediate proxy objects for value objects need both field accessors (the value object's fields) and operator methods (`eq`, `gt`, `like`, etc.) on the same object. If a value object has a field named `eq`, `gt`, `like`, or any operator name, the API breaks — there's no way to distinguish "access the field called `eq`" from "call the `eq` operator." This is the same namespace collision problem that Prisma ORM encountered with its proxy-based approach.

### Separate function-based operators (`fns.eq(u.homeAddress.city, "NYC")`)

Value object access uses property chaining for navigation only, with operators as standalone functions.

**Why we rejected it:** This works for built-in operators but falls apart for extension-provided operators. The trait system ([ADR 202](ADR%20202%20-%20Codec%20trait%20system.md)) gates operators by codec — a `cosineDistance` method only appears on vector-type expressions. With standalone functions, either every function is available on every type (losing type safety) or the function needs the type parameter to restrict its domain (awkward ergonomics).

## Decision

### Callable string accessor with type-checked dot-paths

The model proxy is callable with a dot-path string. The call navigates into the value object structure and returns a typed `Expression` at the leaf:

```typescript
u("homeAddress.city").eq("NYC")
```

The returned `Expression` carries the same trait-gated operators and extension methods as any scalar expression. A text field reached via `u("homeAddress.city")` has `eq`, `gt`, `like` — the same methods as `u.email`. A vector field reached via `u("specs.featureVector")` has `cosineDistance` — the same methods as a direct vector column.

### Type safety via recursive template literal types

The dot-path string is type-checked at compile time using TypeScript template literal inference:

```typescript
type ResolvePath<T, Path extends string> =
  Path extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
      ? ResolvePath<T[Head], Rest>
      : never
    : Path extends keyof T
      ? T[Path]
      : never;
```

An invalid path produces `never`, which surfaces as a type error. The resolved type at the end of the path determines which operators are available — the same trait-gating mechanism that works on scalar fields.

### Autocomplete via lazy recursive completions

IDE autocomplete for string paths is achievable using the same technique ArkType uses for recursive grammars. At any cursor position in a dot-path, the set of valid next tokens is finite — just the field names of whichever value object you've navigated into:

```typescript
type PathCompletions<Fields, Prefix extends string = ""> =
  | { [K in keyof Fields & string]:
      | `${Prefix}${K}`
      | (Fields[K] extends ValueObjectRef<infer VO>
          ? PathCompletions<VO["fields"], `${Prefix}${K}.`>
          : never)
    }[keyof Fields & string];
```

This handles self-referential value objects safely — `NavItem.children.` re-suggests `label`, `url`, `children` without infinite expansion, because TypeScript evaluates recursive conditional types lazily (only the depth the user has typed so far).

### Mutation semantics: the verb determines the behaviour

The same dot-path accessor serves mutations. The key design principle is that **the operation determines how omitted fields are handled**, not the shape of the data:

| Operation | Semantics |
|---|---|
| **`create()` / `insert()`** | All required fields must be provided. Omitted optional fields get defaults. |
| **`update()` with plain object** | Partial — only specified fields change. Omitted fields are untouched. |
| **Field accessor `.set()`** | Explicit replacement of a single field or value object. |
| **Field accessor operations** | Targeted mutation operators — `inc()`, `push()`, `unset()`, etc. |

```typescript
// create — complete object, defaults fill in optional fields
db.users.create({
  email: "alice@example.com",
  homeAddress: { street: "123 Main", city: "NYC" }
})

// update — partial: only city changes, everything else untouched
db.users.where({ id }).update({
  homeAddress: { city: "LA" }
})

// field accessor — explicit per-field operations
db.users.where({ id }).update(u => [
  u("homeAddress.city").set("LA"),
  u("homeAddress.country").unset(),
  u("stats.loginCount").inc(1),
  u("tags").push("premium"),
])
```

This resolves the inherent ambiguity of omitted fields in mutations (don't change? set to null? apply default?) by making each form's semantics explicit and unambiguous.

### Capability-gated mutation operators

The mutation operators available through the field accessor are **capability-gated by target**, using the same mechanism as query operators:

| Target | Available operators |
|---|---|
| **All targets** | `.set()`, `.unset()` |
| **Mongo** | `.inc()`, `.mul()`, `.push()`, `.pull()`, `.addToSet()`, `.pop()`, etc. |
| **SQL** | `.set()` and `.unset()` for JSONB paths |

Mongo's native update operators (`$inc`, `$push`, `$addToSet`) map directly to field accessor methods. SQL is limited to wholesale set/unset for JSONB paths — arithmetic and array operators are not practically supported.

### Backend translation

The dot-path accessor translates to family-native syntax:

**Querying:**

| Target | `u("homeAddress.city").eq("NYC")` |
|---|---|
| **Mongo** | `{ "homeAddress.city": "NYC" }` — native dot-notation |
| **SQL JSONB** | `home_address->>'city' = 'NYC'` — JSON path extraction |
| **SQL flattened** | `home_address_city = 'NYC'` — if stored as separate columns |

**Mutations:**

| Form | Mongo | SQL JSONB |
|---|---|---|
| **Partial update** | `$set: { "homeAddress.city": "LA" }` | `jsonb_set(home_address, '{city}', '"LA"')` |
| **Complete replacement** | `$set: { "homeAddress": { ...all fields } }` | `SET home_address = '{ ...JSON }'` |
| **Field operations** | `{ $inc: { "stats.loginCount": 1 }, $push: { "tags": "x" } }` | `.set()` and `.unset()` only |

### Triple role of the dot-path accessor

The accessor serves three roles across the API:

1. **Querying**: `u("homeAddress.city").eq("NYC")` — filter expressions with trait-gated operators
2. **Mutation operations**: `u("stats.loginCount").inc(1)` — targeted field operations with capability-gated operators
3. **Type-safe path references**: for anything else that needs to name a nested field (e.g., sorting, projection, indexing hints)

## Consequences

### Benefits

- **No namespace collision.** Scalar field names and operator method names can never conflict. The problem that affected Prisma ORM's proxy approach is structurally eliminated.
- **Trait-gating works uniformly.** A text field reached through a value object gets the same operators as a direct text column. Extension operations (like `cosineDistance`) work without any special handling.
- **Mongo-native mutations.** The field accessor pattern maps directly to MongoDB's `$inc`, `$push`, `$addToSet` operators — type-safe access to Mongo's native update capabilities.
- **Familiar pattern.** String-based field access with type-checked paths is an established TypeScript pattern (ArkType, TypeORM query builder, lodash `get`).

### Costs

- **String-based access for value objects.** While autocomplete is achievable via recursive template literal types, the developer experience is slightly different from property access — you type `u("homeAddress.city")` instead of `u.homeAddress.city`. The ergonomic difference is small, and the safety gain is significant.
- **Recursive type computation.** Deep nesting produces deeper type evaluation. In practice, value objects rarely nest more than 2–3 levels, so this is unlikely to be a performance issue for the type checker.

## Related

- [ADR 178 — Value objects in the contract](ADR%20178%20-%20Value%20objects%20in%20the%20contract.md) — value objects as a contract concept
- [ADR 202 — Codec trait system](ADR%20202%20-%20Codec%20trait%20system.md) — trait-gating extends to expressions returned by the dot-path accessor
- [ADR 179 — Union field types](ADR%20179%20-%20Union%20field%20types.md) — union types reachable through dot-paths
