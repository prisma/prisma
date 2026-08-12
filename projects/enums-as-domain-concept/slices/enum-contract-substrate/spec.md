# Slice: enum-contract-substrate

Parent project: `projects/enums-as-domain-concept/`. Contributes the project's foundation — the contract can **represent and round-trip** a domain enum + storage value-set, authored through a new TS API, **without changing any existing behavior**.

## At a glance

Adds the new enum representation to the contract IR and a `enumType`/`member` TS authoring API that produces it, plus serializer/validator/round-trip support — all **additive**. The native Postgres enum path, PSL `enum`, the default authoring, and every fixture stay exactly as they are. This unblocks the realization (TML-2851) and typing (TML-2852) slices, which build against the new shape; the cutover that makes this shape the meaning of `enum` is the later slice-4 flip (TML-2853).

## Chosen design

The full design is in the project spec (`../../spec.md`, components 1–4) and `../../design-notes.md`. This slice lands the **additive subset**: the IR shapes, the TS authoring API, and round-trip. Grounded shapes (see `## References`):

**Domain plane — a new `enum` entity kind (direct slot).** The foundation domain namespace (`packages/1-framework/0-foundation/contract/src/domain-envelope.ts`, `ApplicationDomainNamespace`) carries direct slots `models` / `valueObjects?`. Add `enum?: Record<string, ContractEnum>` parallel to them:

```ts
interface ContractEnum {
  readonly codecId: string;                                    // explicit, required
  readonly members: readonly { readonly name: string; readonly value: string }[];  // ordered
}
```

**Domain field — an optional `valueSet` restriction.** `ContractField` (`domain-types.ts`) is `{ nullable, type, many?, dict? }` where `type` is a discriminated union whose scalar arm carries `codecId`. Add an optional restriction reference at the `ContractField` level:

```ts
type ContractField = { /* …existing… */ readonly valueSet?: ValueSetRef };
```

`codecId` stays where it is (on the scalar `type`) — the field keeps its codec always; `valueSet` is the additive narrowing.

**Storage plane — a new `valueSet` entity kind (under `entries`).** `SqlNamespace` (`packages/2-sql/1-core/contract/src/ir/sql-storage.ts`) wraps kinds under `entries: { table: … }`. Add a `valueSet` slot:

```ts
entries: { table: Record<string, StorageTable>; valueSet?: Record<string, StorageValueSet> }
// StorageValueSet: { kind: 'value-set'; values: readonly string[] }   // ordered, codec-encoded
```

`StorageColumn` (`storage-column.ts`, currently `{ nativeType, codecId, nullable, typeParams?, typeRef?, default?, control? }`) gains `valueSet?: ValueSetRef`.

**`ValueSetRef` — the space-aware coordinate.** Matches the `ForeignKeyReference` carrier convention (`foreign-key-reference.ts`): `{ kind, namespaceId, name, spaceId? }`, where `kind` names the source entity-kind (`'enum'` resolves in the domain plane, `'value-set'` in storage), `namespaceId` admits the `UNBOUND_NAMESPACE_ID` (`__unbound__`) sentinel, and the **presence** of `spaceId` is the cross-space discriminator (no tag field). The domain field references a domain enum (intra-plane); the storage column references a storage value-set (intra-plane).

**TS authoring — `enumType` / `member`.** A new helper (target-agnostic; the codec is passed in):

```ts
const Role = enumType('Role', pgText(), member('User', 'user'), member('Admin', 'admin'));
// → domain enum `Role` { codecId: 'pg/text@1', members: [...] }
//   + storage value-set `Role` { values: ['user','admin'] }
//   + field.namedType(Role) sets the field/column valueSet ref to Role
```

`member(name, value?)` (value defaults to name); `enumType(name, codec, ...members)` with `const` generics preserving the literal value tuple, a `.members` accessor (namespaced to avoid collisions), `.values` / `.names` ordered tuples, and `has`/`nameOf`/`ordinalOf`. Asserts well-formedness (non-empty, unique names, unique values) at construction.

**Serializer + validator + round-trip.** Register the storage `value-set` kind for hydration in the SQL family serializer base (`hydrateSqlNamespaceEntry` walks the new `valueSet` slot alongside `table`); add an arktype `StorageValueSet` validator fragment and a `ContractEnum` domain validator; the domain `enum` slot round-trips through the domain serializer. JSON ↔ in-memory round-trip is the primary test.

**Additive discipline.** The native path is untouched and coexists: `PostgresEnumType` keeps living under the storage `type` slot (`kind: 'postgres-enum'`); the new value-set lives under the storage `valueSet` slot (`kind: 'value-set'`) — different slots, different discriminators, no collision. PSL `enum` keeps lowering to native via `processEnumDeclarations`. The new shape is reachable only through `enumType` + direct-IR construction.

## Coherence rationale

One reviewer holds a single story: *"a new, additive enum representation that can be authored through `enumType` and round-trips through the contract."* It matches the repo's blessed **"one new authoring surface end-to-end"** slice pattern (type-side authoring → IR → serializer → round-trip tests). It is large by surface count (foundation + sql-core + ts-authoring + family-serializer) but coherent by outcome and, crucially, **purely additive** — there are no call-site migrations, no fixture churn, and no behavior change to hold in tension; the diff adds new slots/types/helpers and their tests.

## Scope

**In:**
- Domain `ContractEnum` + the `enum` slot on `ApplicationDomainNamespace`.
- `ValueSetRef` type; `valueSet?` on `ContractField` (domain) and `StorageColumn` (storage).
- `StorageValueSet` + the `valueSet` slot on `SqlNamespace.entries`.
- `enumType` / `member` TS authoring API and its lowering into both planes via `field.namedType`.
- Serializer hydration + arktype validators for the new kinds; JSON round-trip.
- Tests: authoring→structure, direct-IR construction, round-trip, well-formedness; type-tests for the literal-tuple propagation through `enumType`.

**Out:**
- Server-side enforcement, `CheckConstraint`, migration/verification (TML-2851).
- Read/write typing narrowing, `db.enums`, `ORDER BY` (TML-2852).
- `enumMember` `ColumnDefault` variant (TML-2851).
- **Repointing PSL `enum`** to the new shape, regenerating fixtures, deleting native (TML-2853).
- Cross-space `valueSet` authoring (representable via `spaceId`; not authored here).

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| Two namespace representations | Handle in design | Foundation domain uses direct slots (`models`); SQL storage wraps kinds under `entries`. The domain `enum` is a direct slot; the storage `valueSet` goes under `entries`. Confirmed in survey; don't mirror one onto the other. |
| Literal-tuple widening | Type-test each hop | `['user','admin']` widens to `string[]` without `const`/`as const`. `enumType` needs `const` generics; a type-test asserts `Role.values` is `readonly ['user','admin']`, not `string[]`. |
| Slot/discriminator collision with native | Verified non-issue | Native enum = storage `type` slot, `kind:'postgres-enum'`; new value-set = storage `valueSet` slot, `kind:'value-set'`. Coexist cleanly. |
| Directional reference invariant (ADR 221) | In-bounds | This slice's refs are intra-plane (domain field→domain enum; storage column→storage value-set); neither crosses planes, so the storage→domain-only rule isn't exercised. |

## Slice-specific done conditions

- [ ] **No regression in the native path:** `pnpm fixtures:check` is clean with **zero fixture changes** (the new representation is dark; PSL `enum` and default authoring still emit native). A diff in any `contract.*` / `expected.contract.json` is a defect, not expected output.
- [ ] **Round-trip + literal-propagation type-tests** for the new shape pass (JSON ↔ in-memory; `expectTypeOf(Role.values)` is the literal tuple).

## Open Questions

1. **Where `enumType` is contributed** — framework/SQL-family level (the domain enum is target-agnostic) vs the target pack (like `postgresAuthoringEntityTypes.enum`). Working position: family-level, since the enum concept is target-agnostic and the codec is passed in; the dispatch grounds the exact wiring against `composed-authoring-helpers.ts`.
2. **`ValueSetRef` reuse vs new type** — reuse/extend the domain `CrossReference` (`{namespace, model}`) shape or introduce a `ValueSetRef` carrying `kind` + `spaceId`. Working position: a dedicated `ValueSetRef` matching the `ForeignKeyReference` carrier (it needs `kind` and `spaceId`, which `CrossReference` lacks).
3. **Does `StorageValueSet` carry `codecId`?** Working position: no — the column already carries `codecId`; the value-set holds only the permitted values. The domain enum is the codec's owner.
4. **`field.namedType(Role)` reuse** — extend the existing `field.namedType` to accept an `enumType` handle and set the field/column `valueSet`, or a new `field` helper. Working position: extend `namedType` (it already resolves named-type refs); confirm at dispatch against the field-helper surface.

## References

- Parent project: `projects/enums-as-domain-concept/spec.md` (components 1–4, R1/R2) + `design-notes.md`
- Plan (option-A sequencing): `projects/enums-as-domain-concept/plan.md`
- Linear issue: [TML-2850](https://linear.app/prisma-company/issue/TML-2850)
- Surfaces (current shapes): `domain-envelope.ts`, `domain-types.ts`, `sql-storage.ts`, `storage-column.ts`, `foreign-key-reference.ts`, `framework-authoring.ts`, `composed-authoring-helpers.ts`, `sql-contract-serializer-base.ts`, `validators.ts`
- ADR 221 (uniform entity coordinate; directional reference invariant); TML-2500 / PR #745 (reference carrier convention)
