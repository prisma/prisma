# Enums as a domain concept — project spec

## Decision

An enum is a **domain-plane** entity: an ordered map from a member **name** (a code
identifier) to a member **value** (the runtime value the column stores). It is declared
once, names its codec explicitly, and is the single source of truth for the application
concept.

A codec is how we represent a **type** — the set of values assignable to a column. An
enum does not replace the codec; it adds a **restriction** narrowing the permitted
values to a named subset. Every field and column keeps its codec, always; an enum-typed
field/column additionally carries a `valueSet` restriction. Read types are the codec's
output narrowed by that restriction.

The domain enum is **target-agnostic** — it lives in the framework's domain plane and
means the same thing for every target. What differs per target is how storage *realizes*
the restriction:

- **SQL (Postgres):** a named value-set plus a check constraint — never a native
  `CREATE TYPE … AS ENUM`. The persistence strategy is carried by the *structure* (a text
  column + a value-set + a check), not by a marker field, so changing it is a visible
  contract diff. The native Postgres enum machinery is deleted; because the strategy is
  structural, a native realization can return later as a different storage shape
  (§ Alternatives).
- **Mongo:** a `$jsonSchema` collection validator — the enum field becomes an `enum`
  keyword inside the collection's JSON-Schema validator (`validationLevel: strict`). No
  value-set storage entity and no migration-ops parallel are needed; the restriction is a
  field property in the validator the family already applies. Mongo has no native enum and
  no prior PSL `enum`, so its `enum` keyword means the domain concept from day one — Mongo
  needs neither a transitional keyword nor a cutover.

Both targets read the same way: the codec's output narrowed by the `valueSet` restriction
to the value union, plus a `db.enums.<ns>.<Name>` accessor on the facade. Declaration-order
`ORDER BY` is SQL-only (Mongo has no schema-level enum-ordinal sort; the ordinal stays
runtime metadata via `db.enums.<Name>.ordinalOf`).

Everything below is settled design. The implementer builds it; the only open items are
the sequencing calls in § Decomposition and the items in § Deferred to plan.

## At a glance — one worked example

Authoring (TS DSL; PSL equivalent in R1). The codec is a required argument — no
inference:

```ts
const Role = enumType('Role', pgText(),
  member('User', 'user'),
  member('Admin', 'admin'),
)

User: model('User', {
  fields: { role: field.namedType(Role).default(Role.members.Admin) },
})
```

Emitted contract — **domain plane**. The enum lives here once; the field carries its
codec (always) plus a `valueSet` restriction referencing the enum:

```jsonc
"domain": { "namespaces": { "public": {
  "enum": {
    "Role": {
      "codecId": "pg/text@1",
      "members": [
        { "name": "User",  "value": "user" },
        { "name": "Admin", "value": "admin" }
      ]
    }
  },
  "models": {
    "User": {
      "fields": {
        "id":   { "nullable": false, "codecId": "pg/int4@1" },
        "role": { "nullable": false, "codecId": "pg/text@1",
                  "valueSet": { "plane": "domain", "entityKind": "enum",
                                "namespaceId": "public", "entityName": "Role" } }
      },
      "relations": {},
      "storage": { "table": "users", "fields": { "id": { "column": "id" }, "role": { "column": "role" } } }
    }
  }
} } }
```

Emitted contract — **storage plane**. A named `valueSet` holds the permitted physical
values; the column references it (notional restriction → client typing); a check
constraint references it (server-side enforcement). No enum entity in storage:

```jsonc
"storage": { "namespaces": { "public": {
  "id": "public",
  "entries": {
    "valueSet": {
      "Role": { "kind": "valueSet", "values": ["user", "admin"] }
    },
    "table": {
      "users": {
        "columns": {
          "id":   { "nativeType": "int4", "codecId": "pg/int4@1", "nullable": false },
          "role": {
            "nativeType": "text",
            "codecId": "pg/text@1",
            "nullable": false,
            "valueSet": { "plane": "storage", "entityKind": "valueSet",
                          "namespaceId": "public", "entityName": "Role" },
            "default": "admin"
          }
        },
        "primaryKey": ["id"],
        "uniques": [], "indexes": [], "foreignKeys": [],
        "checks": [
          { "name": "users_role_check", "column": "role",
            "valueSet": { "plane": "storage", "entityKind": "valueSet",
                          "namespaceId": "public", "entityName": "Role" } }
        ]
      }
    }
  }
} } }
```

Generated DDL:

```sql
CREATE TABLE public.users (
  id   int4 NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  CONSTRAINT users_role_check CHECK (role IN ('user', 'admin')),
  PRIMARY KEY (id)
);
```

Client surface:

```ts
db.enums.Role.values          // readonly ['user', 'admin']   (ordered, literal-typed)
db.enums.Role.members.Admin   // 'admin'
const u = await db.user.findOne({ where: { id: 1 } })
u.role                        // 'user' | 'admin'   (not string)
db.user.create({ data: { role: db.enums.Role.members.User } })   // ok
db.user.create({ data: { role: 'usr' } })                        // compile error
```

The permitted values appear in the domain `enum` (the source) and the storage
`valueSet` (the physical projection). That is the cross-plane, emitted redundancy ADR
172 already accepts: one authoring act, regenerated copies, no drift. Within each plane
the values are stored once and referenced — the column and the check both point at the
single `valueSet`.

**Slot naming.** New entity-kind slots are singular per ADR 221 (`enum`, `valueSet`),
while the grandfathered built-ins stay plural (`models`, `tables`). `checks` is a
plural array field on the table, like the existing `uniques` / `indexes` /
`foreignKeys`.

## Design

Each component states what to build and the requirements (§ Requirements) it satisfies.

### 1. Codec is the type; `valueSet` is an optional restriction

The existing invariant holds untouched: **every field and column has a `codecId`,
always.** An enum-typed field/column additionally carries a `valueSet` property — the
named restriction. The codec gives the base type; the restriction narrows it. There is
no union or conditional on the codec slot, and no change to non-enum fields.

- Domain field: `{ nullable, codecId, valueSet?: ValueSetRef }`.
- Storage column: `{ nativeType, codecId, nullable, valueSet?: ValueSetRef, default? }`.

A consumer's rule is uniform: if `valueSet` is present, the field/column has a
restricted permitted-value set; resolve it for the values. A consumer that only asks
"is this restricted?" never branches on the source kind.

*Satisfies:* R2, R4, R5.

### 2. `valueSet` reference shape

`valueSet` holds the **entity coordinate** (the ADR 221 four-tuple, carried — never
derived): `plane`, `namespaceId` (admitting the `__unbound__` sentinel for
single-namespace contracts), `entityKind` (equal to the entries slot key — one
vocabulary, no translation: `'enum'` for the domain plane's `enum` slot, `'valueSet'`
for storage's `entries.valueSet`), and `entityName`, plus an optional `spaceId`
**whose presence is the cross-space discriminator** (absent ⇒ local, present ⇒
cross-space; no tag field) per TML-2500 / PR #745.

```jsonc
{ "plane": "domain",  "entityKind": "enum",     "namespaceId": "public", "entityName": "Role" }  // domain field → domain enum
{ "plane": "storage", "entityKind": "valueSet", "namespaceId": "public", "entityName": "Role" }  // column/check → storage value-set
{ "plane": "storage", "entityKind": "valueSet", "spaceId": "supabase",
  "namespaceId": "auth", "entityName": "Role" }                                                  // cross-space
```

References are name-based on the full coordinate (matching PR #745, which keeps FK refs
name-based and disambiguates by namespace + space, not by a stable entity id). Every
`valueSet` reference is **intra-plane**: the domain field references a domain enum; the
storage column/check reference a storage value-set. The directional invariant
(corrected 2026-06-10 — ADR 221's §115 parenthetical is transposed; erratum pending):
**domain may reference storage; storage may never reference domain** — the storage
plane must be consumable in isolation by the migration planner/runner. The
`entityKind` is the extension point: future restriction sources (inline sets, ranges)
add new variants without touching consumers that only test for `valueSet`'s presence.

*Satisfies:* R2, R3, R9 (uniform-reference parity).

### 3. Domain `enum` entity

`domain.namespaces[<ns>].enum[<Name>]` carries an explicit `codecId` and ordered
`members: [{ name, value }, …]`. It is the application concept and the single source of
truth: the value union, the member accessor, `db.enums`, and the default-member intent
all derive from it. The member **value** is stored in the codec's JSON form
(`encodeJson`); for a text codec that is the string itself.

The codec is **required**, declared with the enum, not inferred from the value type.
The codec's input type constrains the member value type (text → string values). This is
what lets an enum be over any scalar codec without the enum being a codec itself.

*Satisfies:* R1, R3, R6.

### 4. Storage `valueSet` entity

`storage.namespaces[<ns>].valueSet[<Name>]` carries ordered `values: [...]` — the
codec's storage-encoded form of each permitted value. It is a bare, named, ordered set
of permitted literal values: a genuinely *storage* concept ("these physical values are
allowed here"), with no member names and no application semantics. It is **not** the
deleted storage enum entity, which re-stated the application concept in the wrong plane.

It is a projection of the domain enum, emitted, and referenced (not inlined) by every
column and check that needs it — so the values live once per plane. The value-set is not
enum-specific; an enum is one producer of one today, and the same construct generalizes
to "permitted values for a column are x, y, z" without an enum behind it.

*Satisfies:* R2, R7.

### 5. Column restriction and check constraint are both present, doing different jobs

- The column's **`valueSet` property** is the *notional* restriction. Reading the column
  in isolation tells you its value space — what you may write, what you will read. This
  informs the **client**: the ORM types from the domain field's `valueSet`, the query
  builder types from the column's `valueSet`, both directly, no cross-plane reach and no
  parameterized codec. It is present whether or not the database enforces anything.
- The **check constraint** is the *server-side* enforcement. `CheckConstraint` is
  net-new IR; it lives in a table-level `checks: ReadonlyArray<CheckConstraint>` array
  (the `uniques` / `indexes` / `foreignKeys` precedent — nothing constraint-shaped hangs
  off `StorageColumn`). It references the same value-set:

  ```ts
  interface CheckConstraint {
    readonly name: string            // database constraint name, e.g. "users_role_check"
    readonly column: string          // the constrained column
    readonly valueSet: ValueSetRef   // the permitted set (component 2 shape)
  }
  ```

A column may carry `valueSet` with no check (client-informed, unenforced) or with one
(also enforced). Both reference the single storage value-set.

*Satisfies:* R2, R4, R5, R7.

### 6. Read/write typing

The field/column read and write types are the codec's `Output`/`Input` **narrowed to the
value-set's values** — `string` narrowed to `'user' | 'admin'` for a text codec. The
narrowing source is the resolved `valueSet`, read off the domain field (ORM) and the
storage column (query builder). The codec stays the ordinary scalar codec; there is no
bespoke or parameterized enum codec.

**Literal propagation** carries the value tuple to the typed surface and is the part
most likely to need iteration. In TypeScript, `['user','admin']` widens to `string[]`
unless preserved with `const`/`as const`. The tuple must survive every hop without
widening:

```
enumType (const generics) → EnumType (literal tuple captured)
  → domain enum node type → field valueSet → narrowed codec Output → query I/O types
```

Each hop needs a type-test asserting the tuple has not widened (e.g.
`expectTypeOf(Role.values).toEqualTypeOf<readonly ['user','admin']>()`), so widening is
caught where it happens.

*Satisfies:* R4, R5.

### 7. JS value is the value, not the name

`db.enums.Role.members.User` evaluates to the **value** (`'user'`) — the literal the
database stores and the codec ingests — usable directly in the raw-SQL and
query-builder lanes, not only the ORM. The **name** is a compile-time key. A field's
input and output types are the **value** union.

*Satisfies:* R4, R5, R6.

### 8. Authoring API — `enumType` + `member`

Hand-rolled, order- and literal-preserving; the codec is required and constrains member
value types.

```ts
interface EnumMember<N extends string, V> { readonly name: N; readonly value: V }

function member<const N extends string, const V>(name: N, value: V): EnumMember<N, V>
function member<const N extends string>(name: N): EnumMember<N, N>   // value defaults to name

function enumType<const C extends Codec, const Ms extends readonly EnumMember<string, CodecInput<C>>[]>(
  name: string, codec: C, ...members: Ms
): EnumType<C, Ms>
```

`EnumType` derives, with order preserved: `members` (accessor map, namespaced under
`.members` to avoid colliding with `.values`/`.has` — the `table.columns.x` precedent),
`names` / `values` (ordered tuples), `has` / `nameOf` / `ordinalOf`. `enumType` asserts
well-formedness at construction (non-empty, unique names, unique values) and throws
otherwise.

*Satisfies:* R1, R6.

### 9. Default — resolved literal in storage, member intent in domain

(Reworked 2026-06-10 — the original `enumMember` `ColumnDefault` variant carried a
storage → domain reference, which violates the directional invariant: storage must be
plannable in isolation. The TML-2851 carrier is removed/redesigned before TML-2855
persists any default.)

The storage column carries the **resolved literal default** — `DEFAULT 'admin'` is
plannable from storage alone, with no domain resolution. The member-level intent
("this default is `Role.Admin`"), where recorded, lives on the **domain field** — a
domain-side reference, the legal direction. Member-only-ness is enforced where the
value is written: the TS DSL `.default(Role.members.Admin)` accepts only members and
lowers to the member's value; PSL `@default(member)` is checked against the enum
during lowering (diagnostic otherwise) and lowers the same way.

*Satisfies:* R3.

### 10. Persistence strategy is structural; ordering is declared

There is **no strategy marker** (consistent with polymorphism and ownership, where the
shape declares the strategy). The check realization *is* the structure: a text column
whose `valueSet` names a value-set, plus a check referencing it. A future native
realization would be a structurally different shape — the column's `nativeType` is a
named enum type, the type carries the values, no check — so switching realizations is a
visible structural diff.

Order is preserved by the ordered arrays (enum `members`, value-set `values`). `ORDER BY`
on an enum column follows declaration order, rendered per target from the ordered values
(Postgres `array_position(ARRAY[…]::text[], <column>)`; others `FIELD(…)` / a `CASE`
ladder). A general value-set iteration helper is a future want, not built here.

*Satisfies:* R7, R8, and the structural-seam requirement in R9.

## Requirements

Numbered requirements the design satisfies; each is the acceptance check for its
behavior.

- **R1 — Declare (both surfaces).** PSL declares the codec as a required block attribute
  and each member's value with `=`:

  ```prisma
  enum Role {
    @@type("pg/text@1")
    User  = "user"
    Admin = "admin"
  }
  ```

  `@@type(<codecId>)` is required (validation error if absent — never inferred). Each
  member's right-hand side is the codec's **JSON-encoded value** (`encodeJson`): the
  literal is `JSON.parse`d and validated with `codec.decodeJson`, reusing the existing
  PSL-extension `value`-parameter path (`PSL_EXTENSION_INVALID_VALUE` on a non-JSON
  literal or a codec-rejected value). The value defaults to the member name for
  string-input codecs (`{ User Admin }` → `"User"`/`"Admin"`) and is required for other
  codecs; `=` carries any codec-input type (`Low = 1` for an int codec). The TS
  equivalent is `enumType(name, codec, …members)`. The static type carries the ordered
  literal tuple (`expectTypeOf(Role.values).toEqualTypeOf<readonly ['user','member','guest']>()`);
  `EnumValues<typeof Role>` is the value union. Malformed declarations (empty, duplicate
  name, duplicate value) throw at construction.
- **R2 — Reference as a column type.** The contract carries the enum once in the domain
  plane and a value-set once in storage; the field and column each carry a `valueSet`
  restriction alongside their always-present `codecId`; the check references the same
  value-set.
- **R3 — Member default.** `field.namedType(Role).default(Role.members.member)` compiles
  only with members; PSL `@default(member)` lowers to the member's **resolved literal**
  on the storage column (member intent recorded domain-side, per component 9); DDL is
  `DEFAULT '<value>'`. Non-members fail (compile error / lowering diagnostic).
- **R4 — Typed output.** `findOne(...).role` is statically the value union, not `string`,
  in both the ORM and the query builder (type-tests on each).
- **R5 — Typed input.** Write payloads accept only the value union; an invalid literal is
  a compile error (negative type-test); a valid one compiles.
- **R6 — Runtime introspection.** `db.enums.Role.values` returns the ordered tuple at
  runtime and is literal-typed; `.members.<Name>` and `.ordinalOf` work. The literal
  typing must hold **through the emitted contract**, not only on the no-emit path: the
  emitter types the domain `enum` block in `contract.d.ts` so that an emitted-contract
  consumer gets `db.enums.<ns>.<Name>.values` as the literal tuple and
  `.members.<Name>` as the literal value — not `JsonValue`. (Gap found 2026-06-10
  during TML-2882: the emitter narrows enum *column/field* types but omits the domain
  `enum` block from `contract.d.ts`, so emitted-path accessor members type-widen to
  `JsonValue` while runtime values are correct. Same verify-through-emit failure class
  as the TML-2852 D4 escape; the fix is the same pattern applied to the enum entity.)
- **R7 — Migration & verification.** Adding/removing a value is a check + value-set
  drop/recreate (no type rebuild); verification compares the contract's expected check
  against the live database and reports a mismatch (replacing the deleted native-enum
  verification).
- **R8 — Declaration-order sort.** `ORDER BY` on an enum column orders by declared
  position, not lexically (verified against a database where the two differ).
- **R9 — Native machinery removed; references uniform.** The items in § What this
  replaces are gone; build, type-checks, and `fixtures:check` pass with enums realized as
  value-set + check; no new `as` casts (no-bare-cast ratchet); no `postgres-enum`
  discriminator or `PostgresEnumType` remains. `valueSet` and default references use the
  same coordinate convention as every other reference site.
- **R10 — Mongo enums, end-to-end.** The domain enum is realized for the Mongo family as a
  single **complete vertical**: a Mongo `enumType` / `member` authoring API (target-bound to
  Mongo codecs) and PSL `enum` lowering populate `domain.namespaces[ns].enum`; the field
  carries the `valueSet` restriction; the collection's `$jsonSchema` validator gains an
  `enum` keyword for that field at `validationLevel: strict` (so the database rejects
  out-of-set writes); reads narrow to the value union in the Mongo client (R4/R5 parity);
  and `db.enums.<ns>.<Name>` is exposed on the Mongo facade (R6 parity). Proven end-to-end
  against `mongodb-memory-server` in an example/integration test — author → write-rejected →
  typed read → `db.enums`. R1–R6 hold for Mongo with the Mongo realization substituted for
  SQL's; R7 (migration verification) applies via the validator; R8 (declaration-order sort)
  does not (no schema-level enum-ordinal sort — the ordinal stays runtime metadata).
  Independent of every SQL slice and of the cutover; Mongo's `enum` is the domain concept
  from day one (no native to replace, no transitional keyword).

## Non-goals

- **Native Postgres enum types** — removed. They can return as an alternative storage
  realization (a different structure under the same domain enum), but not in this project.
- **Reconstructing a domain enum from an introspected database** — adopting an existing
  schema is scoped to exclude native enums; we do not infer an enum from an arbitrary
  `CHECK (col IN (…))`. (Verifying the contract's own expected check against the live DB
  is in scope — R7.)
- ~~**Mongo enums**~~ — **now in scope (R10).** Originally deferred on the (mistaken)
  premise that "Mongo has no native enum" — but this project's whole thesis is that an enum
  *isn't* a native type. The domain enum is framework-level, and Mongo enforces a value-set
  the same structural way SQL does, via a `$jsonSchema` collection validator. See R10.
- **A general raw-SQL check-constraint surface** — only the structured value-set check.
- **Per-enum runtime value validators** — enforcement is the compile-time union plus the
  database check; a runtime re-check is redundant defense
  (`prefer-assertions-over-defensive-checks`). Only declaration well-formedness is
  validated (R1).
- **Stable entity ids / cross-space `valueSet` authoring** — references are name-based on
  the full coordinate, following PR #745. The carrier admits `spaceId` so a cross-space
  enum reference is *representable*, but authoring a cross-space enum restriction is not a
  goal here; it rides whatever TML-2500 ships.

## What this replaces (deletion)

Removed once the value-set + check realization (components 4–5, 9–10) covers their cases:

- `PostgresEnumType` and `postgres-enum-storage-entry.ts`; the storage `enum` namespace
  slot
- the bespoke value-blind enum codec (`pg/enum@1`)
- migration ops `CreateEnumTypeCall`, `AddEnumValuesCall`, `DropEnumTypeCall`,
  `RenameTypeCall`
- `enum-planning.ts` (diff + rebuild recipe)
- `operations/enums.ts` (`CREATE TYPE` / `ALTER TYPE ADD VALUE` / `DROP TYPE` DDL)
- `nativeEnumPlanCallStrategy` in `planner-strategies.ts`
- native enum introspection (`pg_enum`) and `verifyEnumType`
- the `postgresAuthoringEntityTypes.enum` contribution and its serializer hydration

Kept: all generic parameterized-codec infrastructure and the ordinary scalar codecs.

## Decomposition (refined at plan time)

Test-first throughout; type-tests are the decisive evidence and must go red if any
propagation hop regresses.

1. **Authoring value** — `enumType` / `member` (component 8): type, runtime, and
   well-formedness tests. Pure; no contract.
2. **Domain enum + storage value-set in the contract** — components 1–4; PSL and TS-DSL
   lowering populate both planes; the field/column carry `valueSet`; the scalar codec is
   used directly.
3. **Check constraint** — component 5; `CheckConstraint` IR + `StorageTable.checks`;
   per-target check DDL (add/drop on value changes); verification (R7).
4. **Defaults** — component 9.
5. **Typing & runtime surface** — components 6–7; codec-narrowed-by-valueSet in both
   lanes (R4/R5); `db.enums.<Name>` (R6); declaration-order `ORDER BY` (R8).
6. **Deletion** — § What this replaces; switch fixtures to the value-set + check form;
   confirm `fixtures:check` and the cast ratchet.

Build before delete: phase 6 lands only once 1–5 cover every case the deleted code
served.

## Deferred to plan

- Whether the value-set + check realization is implemented at the SQL-family layer
  (MySQL/SQLite inherit it) or Postgres-only now with a lift later. Leaning family-layer;
  the structured check is dialect-agnostic.
- Whether `db.enums` is scoped here or is the first instance of a broader domain-client
  surface for IR-modelled entities.
- Tracking dependency: the `valueSet` and default reference shapes follow TML-2500 /
  PR #745; if that carrier convention shifts before this lands, these refs shift with it.

## Alternatives considered

- **Keep the enum in the storage plane (the original approach).** A native
  `PostgresEnumType` under `storage…enum`, referenced by a column `typeRef`, with a
  value-blind shared codec. Rejected: it puts the source of truth in the wrong plane, so
  every application-facing feature reaches from the domain/runtime layer down into
  storage and threads the values back. That reach is the breakage this project removes.
- **Native `CREATE TYPE … AS ENUM` as the storage realization.** Rejected: Postgres-only;
  cannot remove a value without a rebuild; `ADD VALUE` could not run in a transaction and
  the new value is unusable in the same one; text-only (cannot host non-string values).
  Value-set + check makes add/remove/rename ordinary `ALTER TABLE`s on every SQL target.
  Because the strategy is structural, native can return later as a different storage
  shape under the same domain enum.
- **Field/column type as a `codec | enum` union.** Rejected: it breaks the
  "every field/column has a codec, always" invariant, a foundational change that ripples
  everywhere. A codec *is* the type; an enum is an additive restriction on top of it.
- **A named enum entity in the storage plane.** Rejected: once native types are gone
  there is no physical database object to name, so a storage "enum" would be a domain
  concept in a plane meant for concrete artifacts. The bare, named *value-set* is the
  storage-legitimate version: it states permitted physical values and nothing else.
- **Inlining the permitted values on each column/check.** Rejected: it duplicates the
  list across every using site. The named storage value-set, referenced intra-plane,
  keeps the values once per plane while leaving storage self-contained (the reference
  resolves without leaving the storage plane).
- **An `enumMember` `ColumnDefault` variant in storage instead of the resolved
  literal.** Originally chosen ("the contract should record member intent"), then
  **reversed 2026-06-10**: the variant is a storage → domain reference, which breaks
  the directional invariant — storage must be plannable in isolation, and resolving a
  member through the domain plane breaks planner isolation. The storage column carries
  the resolved literal (component 9); member intent, where recorded, lives on the
  domain field (the legal direction).
- **An explicit persistence-strategy marker.** Rejected: the project's convention
  (as in polymorphism and ownership) is that the structure declares the strategy. The
  shape — text column + value-set + check, versus a named-type column — is the strategy;
  a marker would be a second source of truth to keep in sync.
- **Bare-name references.** Rejected: names alone collide and require lexical context.
  References use the full space-aware coordinate from PR #745.
- **Authoring the enum as a `Map`, a bare object, or an array of pairs.** Rejected: a
  `Map` erases literal types; a bare object reorders integer-like keys and collides the
  member accessor with the type's own properties; an array of pairs is unergonomic. The
  `member()` variadic preserves order and literals and reads as a declaration.
- **A per-enum runtime validator (e.g. arktype) from the values.** Rejected: the
  compile-time union and the database check already enforce membership; a third check is
  redundant defense.
- **An ecosystem enum library** (Zod `z.enum`, Effect `Schema.Enums`, enumify, …):
  surveyed. Each either collapses name into value (the Zod/TypeBox/Valibot family,
  string-only) or uses runtime classes (enumify/ts-enums), which the no-runtime-codegen
  posture rules out. None offers ordered + independent name/value + literal inference, so
  the ~30-line `enumType` is hand-rolled.
