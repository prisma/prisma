# Native Postgres enums — authoring design (exhaustive)

**Status:** settled. This is the design of record for how a native Postgres enum is
authored, represented, typed, cast, and enforced. It is deliberately exhaustive so the
design does not have to be re-derived. Parent: [`../spec.md`](../spec.md).

Grounded in the current machinery (all verified on `main`):
- pack-contributed entities: `postgresAuthoringEntityTypes` + `postgresAuthoringPslBlockDescriptors` + a lowering factory ([postgres/src/core/authoring.ts](../../../packages/3-targets/3-targets/postgres/src/core/authoring.ts)) — the RLS `policy`/`role` pattern.
- the PSL generic extension block `kw [name] { key = value }` ([psl-parser syntax-kind.ts](../../../packages/1-framework/2-authoring/psl-parser/src/syntax/syntax-kind.ts)).
- the codec plumbing (ADR 208 codecs / `AstCodecResolver`) for registration + decode, and the `pg.enum(Ref)` function-call field-type resolved in postgres-specific lowering (§3.3).
- the SQL cast policy `renderTypedParam` reading **static** `meta.db.sql.postgres.nativeType` per codec-id ([adapter-postgres sql-renderer.ts](../../../packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts), ADR 205).
- the value-set → codec typing machinery (TML-2952, merged): `computeColumnType` → `renderValueSetType` → `renderValueLiteral`.

## 0. One construct, not two

A native Postgres enum is authored with **one construct**: a pack-contributed
`native_enum` **entity** plus a `pg.enum(<ref>)` **codec** on the fields that use it. There
is **no "domain enum realized as native"** path — a native enum is a Postgres *type*, not a
domain enum (see `../spec.md` "Decision"). The `native_enum` entity provides everything the
app needs: its members drive a new **`db.nativeEnums`** facade root (a Postgres-only sibling
of `db.enums`, §5), and they **derive a value-set** that drives typing — the same value-set →
codec path a check enum uses (§5); the managed phase renders `CREATE TYPE` from them.

The two cases differ only in **control grade** and **who owns the type**, not in the
authoring surface:

| | declares | grade | PN emits DDL? |
| --- | --- | --- | --- |
| **Externally-managed (Supabase) / adopted** — phase 1 | the extension (in its `contract.prisma`), or contract-infer on adoption | `external` (the pack's `defaultControlPolicy`) | no — the type already exists |
| **Authored** — phase 2 | a user | `managed` (default) | yes — `CREATE TYPE`, and the cheap in-place ops |

> This supersedes the earlier "phase-2 = realize a domain enum as a native type" framing.
> Converting an existing check-realized domain enum to native (or back) remains a non-goal
> (a realization swap; see `../spec.md`).

## 1. Worked example (the shape everything below elaborates)

Supabase's `auth.aal_level` (`CREATE TYPE auth.aal_level AS ENUM ('aal1','aal2','aal3')`),
used by sessions. **PSL** (in the Supabase extension's `contract.prisma`):

```prisma
namespace auth {
  native_enum AalLevel {        // pack-contributed entity (like a policy/role block)
    aal1 = "aal1"               // variadic `memberName = "value"` list
    aal2 = "aal2"
    aal3 = "aal3"
    @@map("aal_level")          // the Postgres type name (as models @@map to table names)
  }

  model AuthSession {
    id  Uuid            @id
    aal pg.enum(AalLevel)       // field bound to the pg.enum codec; typed via the derived value-set
    @@map("sessions")
  }
}
```

**Emitted contract** (`storage` plane, `public`/`auth` namespace):

```jsonc
"storage": { "namespaces": { "auth": { "entries": {

  "native_enum": {
    "AalLevel": {
      "kind": "postgres-enum",
      "typeName": "aal_level",
      "members": [ { "name": "aal1", "value": "aal1" },
                   { "name": "aal2", "value": "aal2" },
                   { "name": "aal3", "value": "aal3" } ],
      "control": "external"
    }
  },

  "valueSet": {                                   // DERIVED from native_enum.members[].value
    "AalLevel": { "kind": "valueSet", "values": ["aal1", "aal2", "aal3"] }
  },

  "table": { "sessions": { "columns": {
    "aal": {
      "nativeType": "aal_level",                  // → the $N::aal_level cast
      "codecId": "pg/enum@1",
      "valueSet": { "plane": "storage", "entityKind": "valueSet",
                    "namespaceId": "auth", "entityName": "AalLevel" },  // → typing (value union)
      "nullable": false
    }
  } } }
} } } }
```

**Generated read query** (the cast comes from the column's per-instance `nativeType`):

```sql
SELECT "aal" FROM "auth"."sessions" WHERE "id" = $1::uuid
-- and where `aal` is compared/bound: $N::aal_level
```

**Typed surface:**

```ts
const s = await db.auth.sessions.findOne({ where: { id } })
s.aal                                     // 'aal1' | 'aal2' | 'aal3'   (not string)
db.nativeEnums.auth.AalLevel.values      // readonly ['aal1','aal2','aal3']  (Postgres-only facade root)
db.nativeEnums.auth.AalLevel.members.aal1 // 'aal1'
```

## 2. The `native_enum` pack-contributed entity

### 2.1 PSL surface

A generic extension block, keyword **`native_enum`**, inside a `namespace` (native enums are
schema-scoped):

```prisma
native_enum <HandleName> {
  <memberName> = "<value>"   // one or more; `value` is the codec-encoded (text) enum label
  …
  @@map("<pg_type_name>")    // optional; defaults to the block name verbatim
}
```

- `<HandleName>` is the authoring identifier fields reference (`pg.enum(HandleName)`), and the
  contract entity name. Like a model name.
- The body is a **variadic** `memberName = "value"` list — the enum's members, reusing the
  existing variadic block mechanism (the SQL `enum` block, §2.2). `memberName` is the code
  identifier surfaced on `db.nativeEnums.…members`; `"value"` is the string stored in the
  Postgres type and on the wire. Members are **always** authored as explicit `key = value`
  pairs — there is no name-only shorthand (a bare member is a diagnostic), enforced by the
  lowering factory. For all of Supabase's enums `memberName === value`, but both tokens are
  always written.
- `@@map` gives the Postgres type name (snake_case), mirroring how models `@@map` to table
  names. Required for adoption/external where the DB type name is fixed; defaults to the block
  name **verbatim** when omitted — no case manipulation, so a block whose name differs from the
  real Postgres type name must `@@map` it (`db verify` reports the mismatch otherwise).
- **Grade** is *not* a per-block attribute. It comes from the pack's `defaultControlPolicy`
  (the Supabase extension already sets `external`); an authored user contract defaults to
  `managed`. (A per-entity override could ride the generic `control` mechanism later; not
  part of this design.)

### 2.2 The PSL block descriptor (parser)

A new entry in `postgresAuthoringPslBlockDescriptors`, reusing the **existing** variadic-block
mechanism — the same shape the SQL family's `enum` block already ships
([2-sql/9-family/src/core/authoring-entity-types.ts:169](../../../packages/2-sql/9-family/src/core/authoring-entity-types.ts:169)):

```ts
native_enum: {
  kind: 'pslBlock',
  keyword: 'native_enum',
  discriminator: 'postgres-enum',
  name: { required: true },
  parameters: {},              // no fixed keys
  variadicParameters: true,    // open `memberName = "value"` body — EXISTING flag
}
```

**Not new capability.** `AuthoringPslBlockDescriptor.variadicParameters`
([framework-authoring.ts:225](../../../packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts:225))
already opens a block body to an arbitrary `key = value` list: the parser accepts every entry
generically, and the validator skips unknown-key rejection when the flag is set. The SQL/Mongo
`enum` block is a shipping instance. `native_enum` reuses it verbatim; the lowering factory
(§2.3) turns members into the entity — and rejects a bare (value-less) member (§2.1).

### 2.3 The entity type + lowering (interpreter)

A new entry in `postgresAuthoringEntityTypes` (sibling of `role`/`policy`):

```ts
native_enum: {
  kind: 'entity',
  discriminator: 'postgres-enum',
  validatorSchema: PostgresNativeEnumSchema,   // { kind: 'postgres-enum', typeName, members: [{name,value}], control? }
  output: { factory: lowerNativeEnumFromBlock },
}
```

`lowerNativeEnumFromBlock(block, ctx)` produces the `native_enum` IR node:
- `typeName` ← `@@map` or the block name verbatim.
- `members` ← the block's `name = "value"` pairs, **in declaration order** (order is the
  Postgres enum sort order; §6).
- `control` ← `ctx` default control policy (`external` for the Supabase pack).

### 2.4 The IR node + contract representation

`PostgresNativeEnum` — a target-owned top-level `DiffableNode` (the RLS `PostgresRole`
template): `identity()` on the type name, `isEqualTo()` over ordered members, `children()`
none. Lives at `storage.namespaces[ns].entries.native_enum[HandleName]`, kind
`postgres-enum`, carrying `typeName`, ordered `members[{name,value}]`, and `control`.
Composed into the pack via `composeSqlEntityKinds([…, nativeEnumEntityKind])`; validator +
serializer alongside `policy`/`role`. (Phase-2 concern; §3 of `../spec.md`.)

### 2.5 The derived value-set

At contract build/emit the `native_enum` entity's `members[].value` derive a **`StorageValueSet`**
(`storage.entries.valueSet[HandleName]`, ordered values) — the *same* canonical structure a
check enum derives. **This is what drives typing** (§5), via the value-set → codec path. The
value-on-both-sides redundancy (entity members + value-set values) is the intentional,
emitter-guaranteed cross-level redundancy (ADR 172).

### 2.6 TS surface (mirror; byte-identical contract)

PSL and TS must lower to byte-identical contracts (the `authoring.ts` field-preset comment
states this invariant). The TS mirror:
- `helpers.nativeEnum('AalLevel', member('aal1','aal1'), …, { map: 'aal_level' })` — a
  Postgres-target free function (the `helpers.enum`/`helpers.rls` contribution pattern),
  returning a handle.
- the field: `aal: field.column(pg.enum(AalLevel))` — the parameterized-codec column helper
  (ADR 208 `field.column(vector(1536))` pattern), where `pg.enum(handle)` is the column-type
  descriptor.

## 3. The `pg.enum` codec

### 3.1 What it is

A **new text codec**, id `pg/enum@1` (the old value-blind `pg/enum@1` was deleted in the
TML-2853 cutover; this re-introduces a correct one). It does not carry the values itself —
**typing comes from the column's value-set** (§5), not the codec's params:

```
field:  aal pg.enum(AalLevel)
column: { codecId: 'pg/enum@1', valueSet: <ref → derived value-set>, nativeType: 'aal_level' }
```

- **encode/decode:** text passthrough (`encode('aal1') → 'aal1'`, `decode('aal1') → 'aal1'`).
  No runtime value-validation (the type + compile-time union enforce; the parent project
  ruled out a third runtime check).
- **`renderValueLiteral`:** renders a value-set value as its TS literal (e.g. `'aal1'`) — this is
  what the value-set → codec typing path (§5) calls per value to build the union, exactly as
  `pg/text@1` does for a check enum.
- **`typeParams: { typeName }`** — the codec instance's parameter (each enum column is a
  distinct instance of the one `pg/enum@1` codec); the codec's `nativeTypeFor` hook reads it to
  drive the `::type` cast (§4).
- **`nativeType`** = the same type name on the column itself (`StorageColumn.nativeType`) —
  read by `db verify` and (managed phase) DDL.

*(Slice-time decision: a distinct `pg/enum@1` vs. reuse `pg/text@1` — settled distinct, for
identifiability, the per-instance `typeName` param, and the managed phase.)*

### 3.2 What authoring resolution yields

Resolving `pg.enum(AalLevel)` → the `native_enum` entity at authoring time (§3.3) puts three
things on the column:
1. **`typeParams: { typeName }`** (schema-qualified for a non-default namespace) → the codec
   instance → the `::auth.aal_level` cast (§4).
2. the same type name as the column's **`nativeType`** → `db verify` / managed-phase DDL.
3. a **`valueSet` ref** → the derived value-set (its values are the `members[].value`) → the
   value-union typing (§5).

### 3.3 Field-type resolution

- **PSL:** `pg.enum(AalLevel)` is a function-call field type. **Postgres-specific** field
  lowering recognizes the `pg.enum(<ref>)` form, resolves `<ref>` to the `native_enum` block in
  the same document, and produces the column: `{ codecId: 'pg/enum@1', valueSet: <ref → the
  derived value-set>, nativeType, typeParams: { typeName } }`. (Not the generic declarative
  type-constructor template — that only maps scalar literals, not entity refs.)
- **TS:** `field.column(pg.enum(AalLevel))` — `pg.enum(handle)` returns a `ColumnTypeDescriptor`
  carrying `codecId`, the `valueSet` ref, `nativeType`, and `typeParams`.

## 4. The `::type` cast — the codec instance carries its type name

The adapter **already** casts bound parameters by native type: `renderTypedParam`
([sql-renderer.ts:72](../../../packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts:72))
emits `$N::<T>` when a native type is outside the inferrable allow-list. `pg/enum@1` is **one**
codec id serving **many** Postgres types (`aal_level`, `factor_type`, …), so the static
per-codec-id meta (`codecLookup.metaFor(codecId).db.sql.postgres.nativeType`) cannot serve it —
the **per-instance** value must reach the cast.

It does so as a **codec-instance parameter**: the column carries
`typeParams: { typeName: '<qualified>' }` (§3.2), which already flows onto the `CodecRef`
(`codecRefForStorageColumn` forwards `typeParams`). At render time `renderTypedParam` asks the
codec via a codec-owned hook — `CodecLookup.nativeTypeFor(codecId, typeParams)`, the same
delegate shape as `renderValueLiteralFor` — and falls back to the static meta when the hook
returns `undefined`. `PgEnumDescriptor` implements the hook (`nativeTypeFor(params) =
params.typeName`); no other codec does, so every non-enum column renders exactly as before.
`aal_level` is not in `POSTGRES_INFERRABLE_NATIVE_TYPES`, so the renderer emits
`$N::aal_level` (schema-qualified for non-`public` types — the resolution qualifies the name
by the field's namespace at authoring time).

*(A ref-carried per-column `nativeType` was tried and rejected: it rides every column's ref and
shadows static meta for non-enum binds — see querying-design §5 Alternatives.)*

## 5. Typing, `db.nativeEnums`, enforcement — all downstream, all reused/derived

- **Typing (value union) — value-set → codec, the existing post-TML-2952 machinery, unchanged.**
  The column's `valueSet` ref drives typing: `computeColumnType` gates on `if (column.valueSet)`
  → `renderValueSetType(valueSet.values, column.codecId, side, codecLookup)` → the codec's
  `renderValueLiteral` per value → the union. The **same path a check enum uses**; no
  native-specific typing code. Both emitted maps get the union from the value-set — the SQL
  builder's `StorageColumnTypes` and the ORM's `FieldOutputTypes` (post-2952 the latter is
  value-set-driven via `resolveFieldValueSet`, not a domain-enum override). **No-emit**
  (`typeof contract`) column typing is the one gap — TML-2960 (the no-emit path is
  codec-id-keyed, doesn't read the value-set yet). Full detail:
  [`querying-design.md`](querying-design.md) §2.
- **`db.nativeEnums` — a new Postgres-only facade root.** Native-enum members are surfaced
  through a **new `db.nativeEnums`** accessor: a sibling of `db.enums` composed into the
  Postgres client facade only ([3-extensions/postgres/src/runtime/postgres.ts](../../../packages/3-extensions/postgres/src/runtime/postgres.ts)).
  It has the **same shape** as `db.enums` (`values`/`names`/`members`/`has`/`nameOf`/
  `ordinalOf`) and reuses the `EnumAccessor` mechanics, but is built from the `native_enum`
  entities' members rather than the domain `enum` slot. **`db.enums` is unchanged** — it stays
  the real-PN (domain) enum accessor (`buildNamespacedEnums(contract.domain)`) and native
  enums never appear in it. This is the only new read-side code, and it touches nothing outside
  the Postgres facade.
- **Enforcement.** The native **type** enforces membership. External: the type already
  exists. Managed phase: `CREATE TYPE … AS ENUM (<values in declaration order>)`, values taken
  from the entity's members. **No `CHECK` is written to the table** (contrast the check
  strategy).

## 6. Ordering

Postgres enum sort order is the *declaration* order of the values. `native_enum`'s member
order is preserved (ordered arrays) through: block → IR `members` → the derived value-set's
`values` (and, managed phase, `CREATE TYPE … AS ENUM (…)`). Declaration-order
`ORDER BY` on a native-enum column uses the
native type's own ordering (no `array_position` rewrite needed — unlike the text+check
strategy, the native type *is* ordered), so `ORDER BY aal` sorts `aal1 < aal2 < aal3` by the
type.

## 7. What is genuinely new vs reused

**New (small; all via existing mechanisms):**
1. **The `pg/enum@1` codec** (§3) — a parameterized text codec (`typeParams: { typeName }`, encode/decode passthrough, `renderValueLiteral`, `nativeTypeFor`); typing comes from the value-set, the cast from the instance param.
2. **The per-instance cast** (§4) — the codec-owned `nativeTypeFor` hook on `CodecDescriptor`/`CodecLookup`; `renderTypedParam` consults it before static meta. Small, local to the codec surface + the adapter.
3. **The `db.nativeEnums` facade root** (§5) — a Postgres-only sibling of `db.enums`, built from the `native_enum` members; reuses the `EnumAccessor` shape.

Plus the `native_enum` pack-entity contribution itself (an `entityTypes` entry + a lowering factory) — new code, but the *mechanism* (pack entity + variadic block) is entirely reused.

**Reused (the rest):**
- the variadic PSL block mechanism (`variadicParameters`; the SQL `enum` block is the template) — §2.2, **not new**.
- pack-contributed-entity authoring (entityTypes + block descriptors + lowering factory) — RLS template.
- top-level `DiffableNode` + generic differ + `control` grading — RLS template (deferred managed phase).
- parameterized-codec plumbing (ADR 208), `AstCodecResolver` (ADR 212).
- value-set → codec typing (TML-2952, merged — `computeColumnType` / `renderValueSetType` / `renderValueLiteral`), the `EnumAccessor` mechanics, declaration-order arrays.
- **No custom seams.** No bespoke storage-entity registration; the old native-enum validator residue (`postgres-enum-type-schema.ts`) is **deleted, not reclaimed** — `native_enum` rides the generic entity mechanism. (The `ISSUE_KIND_ORDER` `type_*`/`enum_values_changed` keys are live generic infra, kept.)

## 8. End-to-end lowering pipeline

```
PSL  native_enum block ──parser(block descriptor, §2.2)──▶ parsed extension block
     pg.enum(Ref) field ──field lowering (§3.3)───────────▶ column {codecId, valueSet ref, nativeType}
        │
        ▼ interpreter (entity factory §2.3)
   native_enum IR node (typeName, ordered members, control)   [storage.entries.native_enum]
        │
        ▼ contract build/emit (§2.5)
   derived value-set (ordered values)                          [storage.entries.valueSet]
        │
        ├─▶ typing:      value-set → codec renderValueLiteral → union  [emit; no-emit = TML-2960]  (§5)
        ├─▶ db.nativeEnums: native_enum members → EnumAccessor (new Postgres-only facade root; db.enums unchanged)
        ├─▶ cast:        column nativeType → $N::type  (§4)
        └─▶ enforcement: external = pre-existing type · managed = CREATE TYPE from members  (§5)
```

TS path (`helpers.nativeEnum` + `field.column(pg.enum(handle))`) lowers to the byte-identical
contract.

## 9. Phasing

- **MVP (external Supabase, no DDL).** §2 (`native_enum` entity, `external`), §3 (`pg.enum`
  codec), §4 (the cast wiring), §5 (typing / `db.nativeEnums`; enforcement = the pre-existing
  type). Ships **no migration machinery** — external enums are never diffed. See
  [`../plan.md`](../plan.md).
- **Deferred (managed, separate project).** The `PostgresNativeEnum` `DiffableNode` +
  `PostgresSchemaIR` projection + order-aware generic-differ integration + three ops
  (`CREATE TYPE`, `DROP TYPE`, `ALTER TYPE … ADD VALUE`); rename/remove/reorder refused with a
  diagnostic. Plus adoption (contract-infer emits a **`managed`** `native_enum`). Parallel-safe
  with TML-2952/2953. Full design: [`migration-design.md`](migration-design.md).

## 10. Open questions

None — all shaping questions are settled: adopted enums are `managed` (all inference is
managed); the variadic block mechanism is reused, not new (§2.2); members are always
`key = value`, no shorthand (§2.1).
