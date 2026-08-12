# Design notes: enums-as-domain-concept

> Synthesized design document for `enums-as-domain-concept`. Read this to understand
> **what the design is**, **what principles it serves**, and **what alternatives were
> considered and rejected**. It captures the settled design, standing independently of
> the discussion that produced it. The spec (`./spec.md`) is the authoritative,
> requirement-mapped statement; this document is the rationale behind it.

## Principles this design serves

- **A codec is a type; an enum is a restriction on it.** A column's type is its codec
  (the set of assignable values). An enum does not replace the codec — it narrows the
  permitted values to a named subset. Every field/column keeps its codec, always.
- **Domain concept vs storage projection (ADR 172).** The application's enum (named,
  ordered members) is a domain concept; the permitted physical values are a storage
  concept. Each lives in its own plane, referenced within that plane.
- **Single source, emitted projections.** The domain enum is the one authored source.
  Storage and runtime copies are emitted from it, so they cannot drift — the same
  redundancy ADR 172 already accepts for nullability and native types.
- **Structure carries strategy (no markers).** As with polymorphism and ownership, the
  persistence strategy is implied by the shape (text column + value-set + check), not a
  separate flag. Changing the strategy is a visible structural diff.
- **One reference rule everywhere (ADR 221 / PR #745).** References use the full
  space-aware entity coordinate, never bare names — uniform with relations and FKs.
- **Delete native enums; keep the seam.** Native `CREATE TYPE … AS ENUM` carries
  operational pain (no value removal without rebuild, transaction caveats, text-only).
  It is removed now and, because the strategy is structural, can return later as a
  different storage shape under the same unchanged domain enum.

## The model

An enum is an ordered map from a member **name** (a code identifier) to a member
**value** (the runtime value the column stores). The two are independent; the **value**
is the runtime identity used in the ORM, the query builder, raw SQL, and the wire.

### Domain plane — the concept

`domain.namespaces[ns].enum[Name]` carries an explicit `codecId` and ordered
`members: [{ name, value }, …]`. The codec is required (declared, never inferred) and
its input type constrains the member value type. A field that uses the enum keeps its
always-present `codecId` and adds a `valueSet` restriction referencing the enum.

### Storage plane — the physical projection

`storage.namespaces[ns].valueSet[Name]` carries ordered `values: […]` — a bare, named
set of permitted physical values (no member names, no application semantics; a
storage-legitimate concept). A column keeps its `codecId` + `nativeType` and adds a
`valueSet` restriction referencing the storage value-set. The value-set is referenced,
not inlined, so the values live once per plane.

### PSL surface

The codec is a required block attribute and each member's value is assigned with `=`:

```prisma
enum Role {
  @@type("pg/text@1")
  User  = "user"
  Admin = "admin"
}
```

`@@type(<codecId>)` is required — never inferred; a missing one is a validation error.
Each member's right-hand side is the codec's **JSON-encoded value** (`encodeJson`): the
literal is `JSON.parse`d and validated with `codec.decodeJson`, reusing the existing
PSL-extension `value`-parameter validation path (`PSL_EXTENSION_INVALID_VALUE` on a
non-JSON literal or a value the codec rejects). The value defaults to the member name
for string-input codecs and is required for others; `=` carries any codec-input type
(`Active = 1`).

Rejected: **`@map(...)`** — it miscategorizes a first-class domain value as a physical
storage mapping (its meaning everywhere else in PSL). A **parameterized header**
(`enum Role("pg/text@1")`) reads well and makes the codec required by grammar, but
invents a parameterized-block-header construct PSL has nowhere else and that
extension-contributed blocks cannot reuse — so the codec rides the existing
`@@`-attribute mechanism instead, with required-ness enforced by validation.

### Restriction and enforcement are separate jobs

- The column's **`valueSet` property** is the *notional* restriction — read the column
  in isolation and you know its value space. This types the client (ORM from the domain
  field, query builder from the storage column), present whether or not the database
  enforces anything.
- The **check constraint** (`StorageTable.checks[]`, referencing the same value-set) is
  the *server-side* enforcement. A column may carry the restriction with or without the
  check.

### References

`valueSet` carries the entity coordinate — the ADR 221 four-tuple, carried, never
derived: `plane` + `entityKind` (equal to the entries slot key: `'enum'` / `'valueSet'`
— one vocabulary, no translation) + `namespaceId` (admitting the `__unbound__`
sentinel) + `entityName`, plus an optional `spaceId` whose presence is the cross-space
discriminator (the TML-2500 / PR #745 convention). Every `valueSet` reference is
intra-plane (domain field → domain enum; storage column/check → storage value-set).
The directional invariant (corrected 2026-06-10; ADR 221 §115's parenthetical is
transposed, erratum pending): **domain may reference storage; storage may never
reference domain** — storage must be consumable in isolation by the migration
planner/runner. The original `enumMember` default carrier violated this and is
removed: the storage column carries the resolved literal default; member intent, where
recorded, lives domain-side.

### Typing and surface

Read/write types are the codec's `Output`/`Input` narrowed to the value-set's values
(`string` → `'user' | 'admin'`). `db.enums.<ns>.<Name>` exposes the ordered, literal-typed
value tuple and member accessors. `ORDER BY` follows declaration order, rendered per
target from the ordered values.

### Client-side entity accessors live on the `db` facade

Enums are **contract metadata, lane-agnostic** — the same values whether you reach them
through the sql lane or the orm lane — so the enum accessor map lives on the **`db`
facade** alongside `transaction` / `prepare` / `raw` / `context`, not under one lane.
`db.enums` is a **namespace-keyed map projected per target exactly like `db.sql` /
`db.orm`**: `db.enums.public.Priority.values` on postgres, and `db.enums.Role.values` on
unbound-namespace targets (sqlite, mongo) via the existing per-facade unbound projection.
Each namespace exposes only its own enums (`domain.namespaces[ns].enum`).

Why the facade, and why namespace-keyed:

- **Lane-agnostic placement.** Putting enums under `db.orm` (or `db.sql`) buries
  lane-independent metadata under one lane. The facade is the shared home for things that
  belong to the contract, not to a query style.
- **Cross-namespace collision.** A flat map merges every namespace's enums into one
  record, so the same enum name in two namespaces silently last-write-wins.
  Namespace-keyed resolution matches the IR (`domain.namespaces[ns].enum`) and keeps
  same-named enums independent.

**No reserved-name guard needed.** Because enums sit on the facade, not adjacent to models
in a namespace facet, a domain model named `enums` no longer collides with the accessor —
the earlier reserved-name rule is gone.

This is the template for future client-side entity-accessor maps over IR-modelled
entities: build a namespace-keyed map from `domain.namespaces[ns].<entity>`, hang it on
the facade, and project it per target like `db.sql` / `db.orm`.

## Alternatives considered

- **Enum as a storage-plane entity (the original approach).** Attractive: it was already
  half-built (`PostgresEnumType`). **Rejected because:** it puts the source of truth in
  the wrong plane, forcing every application-facing feature to reach down into storage
  for the values — the breakage this project removes.
- **Native `CREATE TYPE … AS ENUM` as the storage realization.** Attractive: a real,
  shared, introspectable type. **Rejected because:** Postgres-only, no value removal
  without rebuild, transaction caveats, text-only. Value-set + check works on every SQL
  target with ordinary `ALTER TABLE`s; native can return later as a different structure.
- **Field/column type as a `codec | enum` union.** Attractive: explicit. **Rejected
  because:** it breaks the "every field/column has a codec, always" invariant — a
  foundational change that ripples everywhere. A codec *is* the type; the enum is
  additive.
- **A named enum entity in the storage plane.** Attractive: symmetry with the domain
  enum. **Rejected because:** with native types gone there is no physical object to name;
  a storage "enum" would be a domain concept in a plane meant for concrete artifacts. The
  bare value-set is the storage-legitimate version.
- **Inlining permitted values on each column/check.** Attractive: storage fully
  self-contained for DDL. **Rejected because:** it duplicates the list per site. The
  named value-set, referenced intra-plane, keeps values once and storage still resolves
  without leaving its plane.
- **An `enumMember` `ColumnDefault` variant in storage (the original choice, reversed
  2026-06-10).** Attractive: records member intent in the contract. **Rejected
  because:** it is a storage → domain reference, violating the directional invariant —
  the migration planner must resolve defaults from storage alone. The storage column
  carries the resolved literal; member intent, where recorded, lives on the domain
  field.
- **An explicit persistence-strategy marker.** **Rejected because:** the structure
  declares the strategy (as in polymorphism/ownership); a marker would be a second source
  of truth.
- **Bare-name references.** **Rejected because:** names collide and need lexical context;
  the full space-aware coordinate is the uniform rule.
- **Authoring as a `Map` / bare object / array of pairs.** **Rejected because:** a `Map`
  erases literals; an object reorders integer-like keys and collides the accessor with
  type properties; pairs are unergonomic. The `member()` variadic preserves order and
  literals.
- **A per-enum runtime validator (e.g. arktype).** **Rejected because:** the compile-time
  union and the database check already enforce membership; a third check is redundant
  defense.
- **An ecosystem enum library** (Zod / Effect / enumify / …). **Rejected because:** each
  either collapses name into value or uses runtime classes (against no-runtime-codegen);
  none gives ordered + independent name/value + literal inference. The ~30-line
  `enumType` is hand-rolled.

## Open questions

- **Realization layer** — implement value-set + check at the SQL-family layer
  (MySQL/SQLite inherit) or Postgres-only now? **Working position:** family-layer; the
  structured check is dialect-agnostic.
- **`db.enums` scope** — local to this project or the first instance of a broader
  domain-client surface for IR-modelled entities? **Resolved (2026-06-10):** ship it
  here as the first namespace-keyed entity-accessor map, shaped so a later generalization
  is non-breaking; enums live on the `db` facade as a per-target-projected map (see
  "Client-side entity accessors live on the `db` facade").
- **Reference-carrier coupling** — the `valueSet`/default refs track TML-2500 / PR #745;
  if that convention shifts before this lands, these refs shift with it. **Working
  position:** conform to the merged M1 carrier; local refs need no `spaceId`.

## References

- Project spec: [`./spec.md`](./spec.md)
- Project plan: [`./plan.md`](./plan.md)
- [ADR 172 — Contract domain-storage separation](../../docs/architecture%20docs/adrs/ADR%20172%20-%20Contract%20domain-storage%20separation.md)
- [ADR 221 — Contract IR two planes, uniform entity coordinate, pack-contributed kinds](../../docs/architecture%20docs/adrs/ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md)
- TML-2500 / PR #745 — cross-contract-space FK reference carrier (the reference coordinate convention)
