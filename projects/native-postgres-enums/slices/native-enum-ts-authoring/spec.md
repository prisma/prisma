# Slice — `native-enum-ts-authoring`

**Project:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md) · **Ticket:** [TML-2965](https://linear.app/prisma-company/issue/TML-2965)

## At a glance

A native Postgres enum is authorable in the **TypeScript DSL**, producing a contract byte-identical to the PSL version — including in a non-`public` schema (Supabase's `auth.aal_level`). Today only PSL can:

```prisma
// PSL — works today
native_enum AalLevel { aal1 = "aal1" aal2 = "aal2" aal3 = "aal3" @@map("aal_level") }
model Session { aal pg.enum(AalLevel)? @@map("sessions") }   // in schema `auth`
```

This slice makes the TS equivalent produce the same contract:

```ts
// TS — this slice
const AalLevel = nativeEnum('aal_level', 'aal1', 'aal2', 'aal3');
model('Session', { namespace: 'auth', map: 'sessions',
  fields: { aal: field.column(pg.enum(AalLevel)).nullable() } });
```

Both emit the same `entries.valueSet.AalLevel` and the same column `{ codecId: pg/enum@1, nativeType: 'auth.aal_level', typeParams, valueSet }`, and both type `aal` as the value union `'aal1' | 'aal2' | 'aal3'`.

## Chosen design

The gap is entirely in the `contract-ts` assembler: the underlying `SqlNamespaceInput.entries` is already open, and the Postgres target's `createNamespace` already hydrates `entries.native_enum` / `role` / `policy` generically. TS authoring just has no way to *put* a pack entity there — its author-facing set is the closed `models` / `valueObjects` / `enums`.

**1. Generic pack-entity attachment (the shared substrate).** Extend the TS authoring chain so an author-declared, namespace-scoped pack entity flows into `entries.<kind>`, exactly the way `enums` already flows into `entries.valueSet`. The seam is the `entries: { table, ...valueSet }` literal in `build-contract.ts` (~752-766); the field threads back through `ContractDefinition`, `buildContractDefinition` (`contract-lowering.ts`), and the `defineContract` factory/scaffold type aliases in `contract-builder.ts` — following the `enums` wiring step-for-step. On attachment, the entity's value-set is derived and folded into `entries.valueSet` too (mirroring PSL's `lowerExtensionBlocksForNamespace` `deriveValueSet` fold), so a TS-attached `native_enum` gets its value-set the same way the PSL one does.

**2. Bespoke `nativeEnum(...)` + `pg.enum(handle)` (the Postgres TS surface).** Follow the established `enumType()` / `member()` precedent — a hand-written TS constructor, independent of the PSL block factory, kept honest by a parity test. `nativeEnum(mappedName, ...values)` validates non-empty/unique values, builds a `PostgresNativeEnum`-equivalent entity + derives its value-set inline, and returns a handle. `pg.enum(handle)` returns a **deferred** column descriptor that carries the entity handle; it does **not** compute the column's final type at call time. The generic `type.pg.enum` path (auto-composed from the pack, currently throws because it has no `entityRefArg` awareness) is **bypassed, not repaired** — repairing it generically is a separate change ([TML-2983](https://linear.app/prisma-company/issue/TML-2983)).

**3. Type-name qualification is a build-stage concern, not the codec's — and not the builder's.** In Postgres a named non-`public` type must be schema-qualified (`auth.aal_level`) so the emitted cast is `$N::auth.aal_level`. Today `PgEnumDescriptor.columnFromEntity(entity, namespaceId)` bakes that qualification in eagerly. That is the wrong home twice over: qualifying a type name is a uniform concern (it applies to any namespaced type name, not this codec), and computing it needs the field's owning-model namespace, which a `field.column(pg.enum(handle))` **builder call does not know** — the `fields: {}` object is constructed before the enclosing `model(..., { namespace })` associates one. So:

- `columnFromEntity` returns the **bare** type name (`entity.typeName`) and its `typeParams`; it no longer takes or applies a namespace.
- Qualification becomes a small generic step (`prefix by namespace when non-default / non-unbound`) applied at the **builder→IR assembly**, where every model's namespace is known — for **both** paths: the PSL interpreter (which already holds the namespace at resolution) and the TS `build-contract` assembly (which resolves each deferred `pg.enum` column against its model's namespace).

This is what makes non-`public` TS authoring fall out for free: there is nothing to compute early, so nothing to get wrong. Emitted output is unchanged — the same qualified `auth.aal_level` lands in `contract.json`, just computed one stage later — so PSL fixtures stay byte-identical.

## Coherence rationale (slice-INVEST · _Small_)

One reviewer holds: **"a native enum authored in TS produces the same contract as the PSL one, in any schema."** The pieces are interdependent — the helper needs the attachment to land its entity; deferred qualification is what lets the builder stay a builder; the parity test needs all of it — and split they leave a mechanism with no driver, or an eager-qualification bug. One coherent rollback unit, one new user-facing capability. The generic attachment is shaped so RLS `role`/`policy` can ride it later, but this slice exercises it only with `native_enum`.

## Scope

**In:** the generic pack-entity attachment through the `defineContract` chain (any namespace); the value-set derivation on the TS path; relocating type-name qualification out of `columnFromEntity` into a generic build-stage step shared by PSL and TS; the `nativeEnum(...)` handle constructor + deferred `pg.enum(handle)` descriptor on the Postgres TS surface; a PSL↔TS parity test covering `public` **and** a named schema; `fixtures:check` clean.

**Deliberately out:**
- **RLS `role`/`policy` TS authoring** — the attachment seam is shaped to carry them; this slice does not wire or test them.
- **Repairing the generic `type.pg.enum` / entity-ref composition** for arbitrary packs — bypassed here; [TML-2983](https://linear.app/prisma-company/issue/TML-2983).
- **No-emit (`typeof contract`) column typing** — [TML-2960], unchanged; a native column types via the value-set on the emitted path as it does for PSL.

## Pre-investigated edge cases

- **`native_enum` is not serialized.** It's authoring-time-only, carried non-enumerable on the namespace, so `contract.json` never contains it. The byte-identical bar is therefore the derived `entries.valueSet[name]` entry + the column `{ codecId, nativeType, typeParams, valueSet }` — raw `native_enum` entity equality holds only at the in-memory `Contract` level (`toEqual`, pre-serialization).
- **Qualification must stay byte-identical.** Moving qualification from `columnFromEntity` to the build stage must produce the exact same `nativeType` / `typeParams.typeName` the PSL path emits today (`public`/unbound → bare; named schema → `schema.name`). The retail-store and Supabase fixtures pin this; `fixtures:check` catches any drift.
- **`valueObjects` cautionary tale.** `valueObjects` sits on `ContractDefinition` but was never wired through `defineContract`'s ergonomic factory — only the low-level `buildSqlContractFromDefinition`. The new pack-entity field must be wired through `defineContract(scaffold, factory)`, not just the low-level entry, or authors can't reach it.
- **`helpers.native_enum` / `type.pg.enum` already exist** on the composed helper surface but are non-functional (the former needs a raw PSL-AST input and derives no value-set; the latter throws). Don't mistake them for half-wired — the new `nativeEnum` helper is the real path; these are bypassed.

## Known asymmetries (harvest-from-usage model)

Because a TS native enum reaches the contract only by being referenced in a `pg.enum(handle)` column (harvested into the field's model namespace), two edges differ from PSL — both benign, one a documented follow-up:

- **A handle referenced in N namespaces materializes N native-enum types** (one per schema, each qualified to its namespace). This matches PSL — a Postgres type lives in one schema; PSL can't share a type across schemas either — so it is by design, noted on `nativeEnum`.
- **A `nativeEnum(…)` declared but never used** by any column is absent from the contract, whereas an unused PSL `native_enum` block still lowers a (serialized) `entries.valueSet.<name>`. Minor and only for inert enums; **follow-up**, not fixed here. (Duplicate names within one namespace *are* rejected, matching PSL's `PSL_DUPLICATE_DECLARATION`.)

## Slice-specific done conditions

- A `native_enum` + `pg.enum(handle)` column authored via `defineContract` (TS), in the default schema **and** in a named schema (`auth`), yields a `Contract` that `toEqual`s the PSL-authored equivalent in memory, and an emitted `contract.json` byte-identical to the PSL one (parity test), with the column typed as the value union in QB/ORM on the emitted path and out-of-set input rejected via the existing value-set machinery.
- `pnpm fixtures:check` clean (existing PSL fixtures unchanged by the qualification relocation).

(CI-green, reviewer-accept, project-DoD floor inherited — not restated.)

## Open questions

- **Helper name/signature** — `nativeEnum('aal_level', 'aal1', 'aal2', 'aal3')` (variadic values, `@@map` name first) vs an options object. Lean: variadic, mirroring `enumType()`'s ergonomics and the value-only member model. Settle in the plan against the parity fixture.
- **Where the pack-entity field lands on `ContractDefinition`** — a single generic `packEntities` map (keyed by kind) vs a typed slot. Lean: a generic map, since the framework/`contract-ts` names no specific kind. Settle in D1 against the `enums` precedent.
- **Home of the generic `qualifyTypeName(name, namespaceId)` helper** — it's generic SQL string logic gated on `DEFAULT`/`UNBOUND` namespace ids; lands wherever both PSL resolution and TS build-contract can reach it without a target dependency. Settle in D2.

## References

- Follow-up filed: [TML-2983](https://linear.app/prisma-company/issue/TML-2983) — generic TS composition for reference-taking type-constructors (repair the auto-composed `type.pg.enum` so `entityRefArg` + `columnFromEntity` work generically for every pack).
- Grounding (full file:line map): the scoping pass for this slice (PSL path, TS closed-set seam, helper design, parity harness).
- Attachment seam: [`build-contract.ts`](../../../../packages/2-sql/2-authoring/contract-ts/src/build-contract.ts) (~752-766), [`contract-definition.ts`](../../../../packages/2-sql/2-authoring/contract-ts/src/contract-definition.ts), [`contract-builder.ts`](../../../../packages/2-sql/2-authoring/contract-ts/src/contract-builder.ts), [`contract-lowering.ts`](../../../../packages/2-sql/2-authoring/contract-ts/src/contract-lowering.ts).
- Qualification to relocate: [`codecs.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/codecs.ts) (`PgEnumDescriptor.columnFromEntity`, ~257-268); PSL caller [`psl-column-resolution.ts`](../../../../packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts) (~443-533).
- Bespoke-TS precedent: [`enum-type.ts`](../../../../packages/1-framework/2-authoring/contract/src/enum-type.ts) (`enumType()` / `member()`).
- Parity harness: `test/integration/test/authoring/parity/` + `ts-psl-parity.real-packs.test.ts`.

## Dispatch plan

Sequential, test-first. Each dispatch: write the failing test, then implement.

### D1 — `generic-pack-entity-attachment`
- **Outcome:** an author-declared, namespace-scoped pack entity declared through `defineContract` lands in `storage.namespaces[ns].entries.<kind>` **and** its derived value-set lands in `entries.valueSet`, via a generic seam that names no specific kind — following the `enums` wiring through `ContractDefinition` / `contract-builder` type aliases / `contract-lowering` / `build-contract`.
- **Builds on:** — (main).
- **Hands to:** the attachment + value-set derivation D2 rides.
- **Focus:** the `packEntities`-shaped field threaded through the chain; the `entries` assembly extension; the `deriveValueSet` fold on the TS path. Test: a hand-constructed pack entity input (default and named namespace) → asserts `entries.<kind>` + `entries.valueSet` land.

### D2 — `relocate-type-name-qualification`
- **Outcome:** `PgEnumDescriptor.columnFromEntity` returns the **bare** type name (drops the eager schema-qualification), and a generic `qualifyTypeName(name, namespaceId)` helper (reachable by both PSL and TS authoring without a target dependency) applies the prefix. The **PSL** path calls it at resolution (where it already holds the namespace); emitted contracts stay byte-identical.
- **Builds on:** — (independent refactor; sequenced before D3 so the TS path can reuse the helper).
- **Hands to:** the bare codec + `qualifyTypeName` D3's TS column path reuses.
- **Focus:** codec returns bare name (remove the now-unused namespace param if clean); the generic helper (extract the default/unbound → bare rule); the PSL caller qualifies both `nativeType` and `typeParams.typeName`. Test: `qualifyTypeName` unit test; contract-psl tests green; **`fixtures:check` byte-identical** (the retail-store / Supabase `auth.aal_level` columns unchanged).

### D3 — `native-enum-ts-helper`
- **Outcome:** `nativeEnum(mappedName, ...values)` builds a `native_enum` handle (validates non-empty/unique) + derives its value-set inline; `field.column(pg.enum(handle))` produces a **deferred** column descriptor that `build-contract` resolves against the field's model namespace — via D2's `qualifyTypeName` — into the same column `{ codecId, nativeType, typeParams, valueSet }` the PSL path yields; the declared entity flows into D1's `packEntities`.
- **Builds on:** D1, D2.
- **Hands to:** the TS authoring surface the parity test drives.
- **Focus:** the bespoke `nativeEnum` constructor (Postgres TS surface); the deferred `pg.enum(handle)` descriptor + its build-time resolution + qualification; the ergonomic path that lands the declared entity in `packEntities` (default and named namespace). Test: TS authoring produces the column for `public` and `auth`; out-of-set/type-union type-test.

### D4 — `psl-ts-parity`
- **Outcome:** parity cases — a `native_enum` + `pg.enum` schema in the default schema **and** in `auth`, authored in PSL and in TS — assert in-memory `Contract` `toEqual` and emitted `contract.json` byte-equality; `fixtures:check` green.
- **Builds on:** D1, D2, D3.
- **Hands to:** the shipped capability.
- **Focus:** the parity fixture/test (extend `ts-psl-parity.real-packs.test.ts` and/or a `parity/native-enum/` case) + full gate (build, typecheck, package + integration tests, lint:deps, lint:casts, fixtures:check).
