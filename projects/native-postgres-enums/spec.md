# Native Postgres enums — project spec

**Status.** Phase 1 (external enums) is **shipped** — [PR #906](https://github.com/prisma/prisma-next/pull/906). Phase 2 (managed enums) is the **forward design** in this doc; it is **not built** and is not started without a fresh go-ahead.

**Authoring design of record →** [`specs/authoring-design.md`](specs/authoring-design.md) (the `native_enum` block, the `pg.enum` codec, the lowering). **Querying →** [`specs/querying-design.md`](specs/querying-design.md). **Migration (phase 2) →** [`specs/migration-design.md`](specs/migration-design.md).

## Decision

A native Postgres enum is a database **type** (`CREATE TYPE … AS ENUM`) — a **storage-plane object**, not a domain enum. Prisma Next represents that type in the contract and surfaces it to the app as a **typed value union**. It is authored as **one construct**, bound to a column by **one codec**, and exposed at runtime by **one accessor**:

- a **`native_enum` entity** in storage (`entries.native_enum[Name]`, kind `postgres-enum`): `typeName`, ordered `members[{name,value}]`, optional `control` grade;
- a **derived value-set** (`entries.valueSet[Name]`): the entity's member values — exactly as a check enum derives one. **This drives typing.**
- a **column** bound via `pg.enum(Ref)`: `codecId: pg/enum@1` (a **parameterized** text codec), a **`valueSet` ref** → the derived value-set (typing), **`typeParams: { typeName }`** = the schema-qualified type name as the codec instance's parameter (the cast), and the same name as the column's **`nativeType`** (`db verify` / DDL). **No `CHECK`** — the type enforces membership.
- **`db.nativeEnums`** — a Postgres-only accessor root (a sibling of `db.enums`), built from the entity's members. `db.enums` is untouched and never contains native enums.

Typing is the **existing value-set → codec path** (post-TML-2952, unchanged): a native column carries a `valueSet` ref exactly like a check-enum column, so it reads/writes as the member-value union in the query builder, the ORM, and the emitted contract — **with no native-specific typing code**. Native realization is **Postgres-only**; SQLite and MongoDB have no native enum and keep the check realization.

So there are **two enum realizations sharing one typing path**, differing only in construct, enforcement, and accessor:

| | construct | enforcement | accessor | targets |
| --- | --- | --- | --- | --- |
| **check-realized** (the domain enum) | `enumType` | table `CHECK` | `db.enums` | all (family-agnostic) |
| **native** | `native_enum` block + `pg.enum` codec | the Postgres type | `db.nativeEnums` | Postgres only |

### At a glance

```prisma
namespace public {
  native_enum UserRole {          // pack-contributed entity, variadic members
    admin  = "admin"
    member = "member"
    guest  = "guest"
    @@map("user_role")            // the Postgres type name
  }
  model Profile {
    id   Uuid @id
    role pg.enum(UserRole)        // bound to the pg.enum codec; typed via the derived value-set
    @@map("profiles")
  }
}
```

Emitted `storage.namespaces.public.entries`:

```jsonc
"native_enum": {
  "UserRole": { "kind": "postgres-enum", "typeName": "user_role", "control": "external",
    "members": [{"name":"admin","value":"admin"},{"name":"member","value":"member"},{"name":"guest","value":"guest"}] }
},
"valueSet": {                                    // DERIVED from native_enum.members[].value
  "UserRole": { "kind": "valueSet", "values": ["admin","member","guest"] }
},
"table": { "profiles": { "columns": {
  "role": { "codecId": "pg/enum@1", "nativeType": "user_role", "nullable": false,
    "typeParams": { "typeName": "user_role" },   // the codec instance's parameter → the $N::user_role cast
    "valueSet": { "plane":"storage", "entityKind":"valueSet", "namespaceId":"public", "entityName":"UserRole" } }
} } }
```

```ts
p.role                                  // 'admin' | 'member' | 'guest'   (not string)
db.nativeEnums.public.UserRole.values  // readonly ['admin','member','guest']
```

## The design, part by part (Phase 1 — shipped)

Each element below states what is built and the requirement it satisfies (see the [Requirements](#requirements) table). Phase 1 is representation + typing only; it emits **no DDL**.

**Representation — satisfies R1.** The `native_enum` is a Postgres-target top-level entity kind, contributed through the same generic mechanism as RLS `policy`/`role`: `composeSqlEntityKinds([…, nativeEnumEntityKind])` + an arktype validator + serializer, round-tripping through `entries.native_enum[Name]`. It is a `DiffableNode` (its Phase-2 job; inert in Phase 1). The interpreter derives a `StorageValueSet` (`entries.valueSet[Name]`) from the entity's ordered member values through a generic `deriveValueSet` hook — the value-set, not the enum, is the typing input.

**Authoring — satisfies R2.** A `native_enum <Name> { member = "value" … @@map("pg_type") }` PSL block (a generic extension block with a variadic member list; members are always `key = "value"`, bare rejected) lowers to the entity. A field `pg.enum(Ref)` resolves the ref against the `native_enum` entity and produces the column: `codecId: pg/enum@1`, a `valueSet` ref → the derived value-set, and `nativeType` = the resolved type name. No `CHECK`; no separate domain enum. (TS authoring is deferred — [TML-2965]; the MVP path is PSL, which Supabase uses.)

**Typing — satisfies R3.** The column reads/writes as the value union via `computeColumnType`'s `column.valueSet` branch → `renderValueSetType` → the codec's `renderValueLiteral` → the literal union. This is the **same path a check enum uses** (post-TML-2952, which made column typing value-set-driven and enum-agnostic — *"the domain enum is no longer a typing input"*); there is no native-specific typing code. The `pg.enum` codec is a text codec that also renders value literals. Typed input rejects out-of-set literals; generated SQL casts a bound parameter to the enum's type. (No-emit `typeof contract` column typing is the one gap — [TML-2960]: that path is codec-id-keyed and doesn't read the value-set yet. Emit typing works today.)

**The cast — satisfies R3.** The codec instance drives the `$N::<type>` cast: each enum column carries `typeParams: { typeName }`, and the SQL renderer asks the codec for its per-instance native type through a codec-owned `nativeTypeFor` hook (the `renderValueLiteralFor` delegate shape), falling back to the codec's static metadata — only `pg/enum@1` implements the hook, so every other column renders as before. A type in a **non-`public` schema is referenced schema-qualified** (`$N::auth.aal_level`), which is also what makes `db verify`'s column-type comparison (reading the column's `nativeType`) agree with Postgres `format_type()`; `public`/default and the unbound namespace stay bare — the same qualify-vs-don't split `PostgresSchema.qualifyTable` uses for tables.

**Runtime access — satisfies R4.** `db.nativeEnums.<ns>.<Name>` exposes each native enum's members (name→value, same accessor shape as `db.enums`), built by walking the `native_enum` storage entities and reusing the framework `createEnumAccessor`. It is attached to the Postgres client, and — because a namespace like Supabase `auth` lives in an extension's own contract — to the Supabase client's `.supabase` root. `db.enums` is unchanged.

**External grade — satisfies R5.** `external`/`observed` native enums produce no DDL and no drift reports; the Supabase extension's `external` default applies to its contributed enums. External enums are never diffed, so `db verify` reports nothing for them for free.

**Why the entity lives in storage (the invariant).** The migration planner must derive the expected schema from the **storage segment alone**, never reaching into `domain` — `storageHash` is storage-only (ADR 004), a migration's identity reflects what it does to storage (ADR 199), and a storage entity may not reference a domain entity (ADR 221 §115). So the `native_enum` entity and its derived value-set are physical storage-plane objects (`entries.native_enum`, `entries.valueSet`), captured by `storageHash` and read by the planner with no domain reference. The cross-level value redundancy (entity members ↔ derived value-set) is the self-contained redundancy the emitter guarantees and ADR 172 sanctions.

## Phase 2 — managed native enums (forward design, not built)

A user declares a **`managed`** `native_enum` (the *same* authoring surface as the external case — only the `control` grade differs). Prisma Next then owns the type's lifecycle: it creates and drops it, and migrates **add-value in place**. This is deferred and its own project.

**Why the ops are limited — the constraint that shapes the design.** Postgres makes two enum edits cheap and in-place and forces a full-table rewrite for the rest:

| Operation | Cost | In-place? |
| --- | --- | --- |
| Add a value (`ALTER TYPE … ADD VALUE`) | no rewrite, no data change | yes — but the value is unusable until the adding txn commits |
| Rename a value (`ALTER TYPE … RENAME VALUE`) | no rewrite | yes |
| Remove / reorder | rebuild type + repoint column + drop old | **no** — full-table rewrite under a blocking lock |

So Phase 2 **auto-migrates only add value** (a pure suffix-append). Rename is cheap but skipped too — telling rename from add+remove needs a rename-detection an order-aware diff can't do cleanly; remove and reorder rewrite the table. All three stay user-managed. This keeps the project clear of dependency-aware planner ordering and transaction grouping. User-facing rationale: [`specs/why-native-postgres-enums.md`](specs/why-native-postgres-enums.md).

The Phase-2 design, concretely (detail in [`specs/migration-design.md`](specs/migration-design.md)):

**SchemaIR node — satisfies R7, R10.** A `PostgresNativeEnum` `DiffableNode`: `identity()` on the type name, `isEqualTo()` over the ordered members. Introspection is enriched from the names-only `pg_type typtype='e'` query to also read the **ordered** values (`pg_enum.enumsortorder`).

**Projection + drift suppression — satisfies R5, R10.** Contract→SchemaIR projects the `native_enum` entities into `PostgresSchemaIR` under a new `enumTypes` field (mirroring `rlsPolicies`/`roles`); the generic differ reports missing / extra / value-mismatch. The `external`/`observed` grade suppresses drift, so Phase-1 external enums stay untouched even after Phase 2 lands.

**Order-aware diff — satisfies R8, R9.** The **only** accepted value change is a pure suffix-append → `ADD VALUE`. A rename, removal, or reorder diff is **refused with a diagnostic**, never lowered to an op.

**Migration ops — satisfies R7, R8.** Three `OpFactoryCall`s: create (`CREATE TYPE … AS ENUM`), delete (`DROP TYPE`), add value (`ALTER TYPE … ADD VALUE`). Ordering need is only "type before the column that uses it," which the planner's existing `'type'` dependency bucket already models. `ADD VALUE`'s non-transactional caveat is surfaced to the runner.

**Adoption — satisfies R6.** Contract-infer emits a **`managed`** `native_enum` for an introspected native type (all inference is managed) instead of throwing.

## Requirements

Phase 1 requirements are met by the shipped design above; Phase 2 requirements are met by the forward design.

| # | Requirement | Phase | Met by | Proven by |
| --- | --- | --- | --- | --- |
| **R1** | A `native_enum` entity (type name, ordered members, control) round-trips and derives a value-set | 1 ✓ | Representation | `psl-native-enum-authoring.test.ts`, serializer round-trip |
| **R2** | A field references it via `pg.enum(ref)` → column `{codecId, valueSet, nativeType}`, no `CHECK`, no domain enum | 1 ✓ | Authoring | `psl-pg-enum-column.test.ts` |
| **R3** | The column reads as the value union (not `string`); input rejects out-of-set literals; SQL carries the `::type` cast | 1 ✓ | Typing + the cast | `native-enum.field-output.test-d.ts`, `sql-renderer.cast-policy.test.ts` |
| **R4** | `db.nativeEnums.<ns>.<Name>` exposes members; `db.enums` unchanged | 1 ✓ | Runtime access | `postgres.test.ts`, `supabase-facade.test.ts` |
| **R5** | `external` enums produce no DDL and no drift | 1 ✓ | External grade (+ Phase-2 suppression) | Supabase `db verify` integration tests |
| **R6** | Contract-infer emits a `managed` `native_enum` for an introspected type instead of throwing | 2 | Adoption | (phase 2) |
| **R7** | An author-selected native enum is created and dropped, ordered before its columns | 2 | SchemaIR node + ops | (phase 2, live DB) |
| **R8** | A pure suffix-append migrates in place (`ADD VALUE`), no rewrite | 2 | Order-aware diff + ops | (phase 2, live DB) |
| **R9** | Rename / remove / reorder is refused with a diagnostic, never planned | 2 | Order-aware diff | (phase 2, negative test) |
| **R10** | The differ reports missing / extra / value-mismatch against a live DB | 2 | SchemaIR node + projection | (phase 2, live DB) |

## Non-goals

- **Auto-migrating value removal or reorder** — permanently out; user-managed (full-table rewrites on operations users can do by hand).
- **Native enums on SQLite / MySQL / MongoDB** — no native enum exists there; they keep the check realization.
- **Making native the default Postgres realization** — check is the safe default; native is opt-in (Phase 2) or external-sourced (Phase 1).
- **Migrating an existing check-realized enum to native, or back** — a realization swap; a separate future want.
- **A framework-level "native enum" concept** — native is a Postgres storage realization; the framework holds only the target-agnostic domain enum.

## Alternatives considered

- **Type native columns via a parameterized codec** (`renderOutputType`, the *values* baked into `typeParams`, no value-set). Rejected for **typing**: post-TML-2952 the value-set → codec path is the general, enum-agnostic column-typing mechanism, so a native column just carries a `valueSet` ref (like a check enum) and reuses it with zero new typing code. A bespoke parameterized-codec typing path would duplicate that; it only seemed right pre-2952, when value-set typing was still enum-tangled. (The codec *is* parameterized — but by the type **name** for the cast, not by the values for typing.)
- **Reuse `StorageColumn.typeRef` + `storage.types` for the column→type join.** Rejected: that slot is the codec-alias mechanism (`vector`/`geometry`/`uuid`) — values rendered inline into a column type, never a managed `CREATE TYPE` object. A native enum is a managed schema object (the RLS template) — a different concept.
- **A `codec | nativeEnum` union on the column type.** Rejected: every column always has a codec; native realization is an additive structural fact, not a replacement of the codec.
- **Native as the default Postgres realization.** Rejected: native can't cheaply remove/reorder and forces table rewrites; check is the safe default.
- **Supporting remove/reorder via an automatic temporary-superset rebuild.** Rejected: two full-table rewrites plus a throwaway type, for an operation users can do by hand. We refuse and document.
- **A framework-level native-enum concept.** Rejected: native enums are a Postgres storage realization; the framework holds only the target-agnostic domain enum.
