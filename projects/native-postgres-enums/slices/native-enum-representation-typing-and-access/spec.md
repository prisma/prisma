# Slice 1 — `native-enum-representation-typing-and-access`

**Project:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md)
**Designs (of record):** [`../../specs/authoring-design.md`](../../specs/authoring-design.md),
[`../../specs/querying-design.md`](../../specs/querying-design.md).

## At a glance

A native Postgres enum becomes representable, typed, and readable at runtime. A `native_enum`
**PSL block** lowers to a storage `native_enum` entity **and a derived
`StorageValueSet`**; a column bound to it via `pg.enum(Ref)` carries `{ codecId, valueSet ref,
nativeType }` and reads/writes as the **value union** (`'aal1' | 'aal2' | 'aal3'`, not
`string`) in the query builder, ORM, and emitted `contract.d.ts` — via the **existing
post-TML-2952 value-set → codec typing machinery, unchanged**; generated SQL carries the
`$N::<type>` cast; and `db.nativeEnums.<ns>.<Name>` exposes the members at runtime. The enum
is graded `external`; **no migration machinery** ships (external enums are never diffed). This
is the whole read surface — slice 2 (Supabase) consumes it.

## Chosen design

**Typing is value-set-driven**, reusing the machinery check enums already use (TML-2952,
merged). Full detail in the design docs; the shape this slice builds:

- **`native_enum` pack entity** (authoring-design §2) — the generic pack-entity mechanism (RLS
  `role`/`policy` template, no custom seams): a variadic block descriptor
  (`{ parameters: {}, variadicParameters: true }`, the shipping SQL `enum`-block shape); a
  lowering factory requiring `key = "value"` members (rejects bare), stamping `typeName` from
  `@@map` (default: the block name verbatim), preserving member order, setting the `control` grade;
  an IR node (`PostgresNativeEnum`) + arktype validator + serializer at
  `storage.namespaces[ns].entries.native_enum[Name]`.
- **Derived value-set** (authoring-design §2.5) — the entity's members derive a
  `StorageValueSet` at `entries.valueSet[Name]`, exactly as a check enum derives one. This is
  what drives typing.
- **`pg.enum(Ref)` column** (authoring-design §3) — postgres-specific field lowering resolves
  the `Ref` to the `native_enum` block and produces a column `{ codecId, valueSet ref →
  the derived value-set, nativeType = the type name }`. **No CHECK.** The codec is a text codec
  (encode/decode passthrough + `renderValueLiteral`); **open slice-time decision:** a distinct
  `pg/enum@1` codec vs. reuse `pg/text@1` + the per-column `nativeType` (lean: distinct
  `pg/enum@1`, for identifiability + the future managed phase).
- **Typing = value-set → codec, unchanged** (querying-design §2) — `computeColumnType` gates on
  `if (column.valueSet)` → `renderValueSetType(valueSet.values, column.codecId, side,
  codecLookup)` → `codecLookup.renderValueLiteralFor(...)` → the literal union. **Zero new
  typing code**; the same path check enums use. No `renderOutputType`, no domain-enum path.
- **The `::type` cast** (querying-design §4–§5) — the codec instance carries its type name:
  the column bakes `typeParams: { typeName }`, and `renderTypedParam` asks the codec via the
  `nativeTypeFor` hook (static `metaFor(codecId)` meta as fallback). Only `pg/enum@1`
  implements the hook, so other columns render unchanged. (A ref-carried `nativeType` was
  tried first and reverted — it shadowed static meta on every non-enum bind.)
- **`db.nativeEnums`** (querying-design §3) — `buildNamespacedNativeEnums(contract.storage)`
  over the `native_enum` entities, attached to the Postgres client only, reusing
  `EnumAccessor`; typed for emit + no-emit (mirroring the existing `enumAccessors`). `db.enums`
  untouched.

## Coherence rationale (slice-INVEST · _Small_)

One reviewer holds: **"a `native_enum` exists, columns using it read/write as a typed value
union with the correct cast, and its members are reachable at runtime."** The pieces are
interdependent (column needs the entity + value-set; cast needs the per-column type name;
`db.nativeEnums` reads the entity) — splitting yields incomplete verticals. One coherent
rollback unit; the complete read surface. Supabase is the only separate slice.

## Scope

**In:** the `native_enum` block descriptor + entityType + lowering factory + IR node + validator
+ serializer; the derived `StorageValueSet`; the `pg.enum(Ref)` codec + resolution (**PSL**);
the cast wiring; `db.nativeEnums`; tests (emit typing, cast, runtime accessor, negatives).

**Deliberately out:**
- Supabase declarations + example → **slice 2**.
- **TS authoring** (`helpers.nativeEnum` + `field.column(pg.enum(handle))`) → **TML-2965** — it
  needs generic `ContractDefinition` pack-entity attachment (shared with RLS role/policy), unused
  by the MVP's PSL/Supabase path.
- **all** migration machinery (SchemaIR node, projection, diff, CREATE/DROP/ADD-VALUE ops,
  adoption) → the deferred managed project.
- **No-emit (`typeof contract`) column typing** — deferred to **TML-2960** (the no-emit path is
  codec-id-keyed and doesn't read the value-set; a native column types as the codec base type
  in `typeof contract` until 2960 lands). *The `db.nativeEnums` accessor is typed per namespace
  as an open `Record<string, EnumAccessor>` — runtime-correct in emit + no-emit; per-name literal
  accessor typing is deferred (composes with TML-2960).*
- rename/remove/reorder; any change to `db.enums`, the domain-enum path, or the check-enum path.

## Pre-investigated edge cases

- **Schema-qualified cast** — non-`public` enum types cast as `$N::auth.aal_level`; the baked
  type name (`typeParams.typeName` + the column's `nativeType`) must be schema-qualified.
- **`renderTypedParam` callers** (`renderParamRef`, prepared + plain, all in `sql-renderer.ts`)
  — the per-instance hook must be additive; fall back to static meta for codecs without it.
- **`pg/enum@1` id** reuses the deleted-in-TML-2853 codec id — confirm no stale references.
- **Bare members rejected** — the variadic parser accepts a value-less key as `{kind:'bare'}`;
  the lowering factory must diagnose it.
- **Keep the entity out of the domain-enum slot** — a native enum must not create a domain
  `enum` entry (never appears in `db.enums`).

## Slice-specific done conditions

- An authored **PSL** fixture with a `native_enum` + a
  `pg.enum` column: emits `storage.entries.native_enum` + the derived `entries.valueSet` + the
  column `{ codecId, valueSet ref, nativeType, no CHECK }`; types as the value union in QB/ORM
  (emit); rejects out-of-set input and a bare member; generates `$N::<type>` in compiled SQL;
  and `db.nativeEnums.<ns>.<Name>.members` resolves at runtime (Postgres client only).
- `pnpm fixtures:check` clean.

(CI-green, reviewer-accept, project-DoD floor inherited — not restated. No-emit column typing is
explicitly out, per TML-2960.)

## Open questions

- **Distinct `pg/enum@1` codec vs. reuse `pg/text@1`** — settled in dispatch 2 (lean: distinct).

## Dispatch plan

**Status:** D1–D4 delivered and committed (`cbb1f6e50`, `2ffb797d7`, `fbb9609aa`, `a105437f6`).
D5 remaining (PSL-only e2e + slice review). TS authoring moved out → [TML-2965].
**Post-review rework:** the PR #906 review round replaced D3's ref-carried `nativeType` cast
transport with the codec-instance parameter (`typeParams.typeName` + the `nativeTypeFor` hook)
— the D3 entry below records what D3 originally did; the Chosen design above is current.

Sequential, test-first. Each dispatch: write the failing test, then implement.

### D1 — `native-enum-entity-and-valueset`
- **Outcome:** a `native_enum` block (PSL + TS) lowers to `storage.entries.native_enum[Name]`
  (kind `postgres-enum`: `typeName`, ordered `members[{name,value}]`, `control`) **and** a
  derived `entries.valueSet[Name]`, round-tripping through serializer + validator; `key =
  "value"` required (bare rejected).
- **Builds on:** — (foundation).
- **Hands to:** the `native_enum` entity + derived value-set consumed by D2 and D4.
- **Focus:** block descriptor (`variadicParameters`) + entityType + lowering factory +
  `PostgresNativeEnum` IR + validator + `composeSqlEntityKinds` serializer wiring + value-set
  derivation. Test: authored-fixture round-trip + bare-member negative + `fixtures:check`.

### D2 — `pg-enum-column-and-emit-typing`
- **Outcome:** a field `pg.enum(Ref)` (**PSL**) lowers to a column `{ codecId, valueSet ref →
  D1's value-set, nativeType }` (no CHECK), and the column types as the value union in QB/ORM
  (emitted contract) via the existing value-set machinery — zero new typing code.
- **Builds on:** D1.
- **Hands to:** value-set-typed native columns for D3 (cast) and slice 2.
- **Focus:** decide + implement the codec (distinct `pg/enum@1` text codec — encode/decode
  passthrough + `renderValueLiteral` — vs. reuse `pg/text@1`; lean distinct) + registration;
  the `pg.enum(Ref)` postgres field resolver (resolve ref → valueSet ref + nativeType). Test:
  emit type-tests (QB/ORM union) + out-of-set negative +
  column-shape assertion. (No-emit column typing NOT asserted — TML-2960.)

### D3 — `native-enum-param-cast`
- **Outcome:** generated SQL for a bound native-enum param carries `$N::<type>`
  (schema-qualified).
- **Builds on:** D2.
- **Hands to:** correct casts in generated SQL.
- **Focus:** stamp `columnDef.nativeType` onto the `CodecRef` in `codecRefForStorageColumn`;
  `renderTypedParam` prefers ref-carried `nativeType`. Test: sql-renderer cast test
  (`$N::auth.aal_level`), other codecs unaffected.

### D4 — `db-native-enums-accessor`  *(may run parallel to D3 after D1)*
- **Outcome:** `db.nativeEnums.<ns>.<Name>` exposes members at runtime
  (values/names/members/has/hasName/nameOf/ordinalOf), typed per namespace as an open
  `Record<string, EnumAccessor>` (emit + no-emit; per-name literal typing deferred → TML-2960);
  Postgres-only.
- **Builds on:** D1.
- **Hands to:** runtime member access for slice 2's example.
- **Focus:** `buildNamespacedNativeEnums(contract.storage)` + Postgres-client wiring +
  `NamespacedNativeEnums<TContract>` type. Test: runtime + type tests; assert absent on
  Mongo/SQLite.

### D5 — `end-to-end-fixture-and-review`
- **Outcome:** one authored **PSL** fixture exercising entity + value-set +
  typed column + cast + `db.nativeEnums` end-to-end; `fixtures:check` green; slice review.
- **Builds on:** D1–D4.
- **Hands to:** the shipped slice-1 capability.
- **Focus:** the e2e fixture + full gate set (build, typecheck, lint:deps, package + integration
  tests, fixtures:check).
