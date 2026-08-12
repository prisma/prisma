# Slice: application-read-surface

Parent project: `projects/enums-as-domain-concept/`. Contributes the project's
**application payoff**: an enum-typed field/column is typed as its value union in
application code, `db.enums.<ns>` exposes enums at runtime, and `ORDER BY` on an enum
column sorts by declaration order.

## At a glance

Today an enum-restricted column reads and writes as `string`, and there is no runtime
enum surface. This slice narrows enum I/O to the value union in both the ORM and
query-builder lanes (`FieldOutputType` resolves the field's `valueSet` to the enum's
literal value tuple), adds `db.enums.<ns>.<Name>` (ordered values tuple + member
accessors) on the `db` facade, and makes Postgres `ORDER BY` on an enum column sort by declaration
order via `array_position`. All exercised by `enumType`-authored contracts; PSL `enum`
stays native until the cutover.

## Chosen design

Three surfaces, one theme — enums usable idiomatically in application code. All read off
slice-1's already-merged shapes (the domain `enum` entity, the field/column `valueSet`
ref, the storage value-set's ordered `values`).

**1. Typed I/O — narrow the codec output by the field's value-set (R4, R5).**
`FieldOutputType` (`packages/2-sql/2-authoring/contract-ts/src/contract-types.ts`, ~line
612) maps a column's `codecId → CodecTypes[codecId].output` today, with no value-set
awareness. Extend it: when the field/column carries a `valueSet`, resolve the referenced
enum in the authored `Definition` and narrow both the read **output** and the write
**input** from the codec's `string` to the enum's **value union** (`'user' | 'admin'`).
The type flows from the authored `Definition` — which carries `enumType`'s literal
members via const generics — so the literal tuple is available at the type level without
round-tripping through emitted JSON. Both lanes inherit the narrowing through the emitted
`FieldOutputTypes` TypeMap; `ComputeColumnJsType` (relational-core) and `ExtractOutputType`
(query-builder) are the fallback hook points only if a lane bypasses `FieldOutputTypes`.

```ts
const Role = enumType('Role', text, member('User', 'user'), member('Admin', 'admin'))
// model field: role: field.namedType(Role)

const u = await db.user.findOne(/* … */)
u.role                                       // before: string  →  after: 'user' | 'admin'
db.user.create({ data: { role: 'nope' } })   // after: compile error (not in the union)
```

Each hop carries an `expectTypeOf` type-test so a widening to `string`/`string[]` is
caught where it happens (the project spec's literal-propagation chain: `enumType`
const-generics → `Definition` → `FieldOutputType` → query I/O types).

**2. `db.enums.<ns>.<Name>` runtime surface (R6).**
Enums are lane-agnostic contract metadata, so `db.enums` is a top-level **`db` facade**
member — a namespace-keyed map projected per target exactly like `db.sql` / `db.orm`,
built from `contract.domain.namespaces[ns].enum[Name]` (slice-1's ordered
`{ name, value }` members). On postgres this is `db.enums.public.Priority`; on
unbound-namespace targets (sqlite, mongo) the per-facade unbound projection surfaces it as
`db.enums.Role`. It exposes the shape slice-1's `enumType` handle already derives:
`.values` (ordered literal tuple), `.members.<Name>` → the **value** (`'user'`),
`.names`, `.has`, `.nameOf`, `.ordinalOf`. This is the first client-side "IR-entity
accessor map" (the `table.columns.x` precedent), hung on the facade so a later
generalization is non-breaking. The namespace-keyed map keeps same-named enums in
different namespaces independent. (D2 first shipped this as a flat root `db.enums`; D5
moved it into the orm namespace facet after TML-2816 made the root namespace-keyed; D6
relocated it to the facade as lane-agnostic metadata — see `design-notes.md`.)

**3. Declaration-order `ORDER BY` — Postgres (R8).**
In the Postgres renderer (`packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts`,
~line 194), the ORDER BY clause renders each item's expression then its direction.
Intercept a column-ref item whose column carries a `valueSet`: emit
`array_position(ARRAY[v1, v2, …]::text[], <col>)` from the storage value-set's ordered
`values` (`contract.storage.namespaces[ns].entries.valueSet[name].values`) instead of the
bare column reference. Implicit — any `ORDER BY` on an enum column sorts by declaration
order; no query-builder / AST / ORM API change.

## Coherence rationale

One outcome a reviewer holds in one sitting: *"an enum is now first-class in application
code — typed in and out, introspectable at runtime, and sorted by declaration order."*
The three surfaces are the read/write face of the same value-set: all consume slice-1
shapes, all stay dark (no fixture changes; only `enumType`-authored contracts exercise
them), and they touch disjoint code from the migration/planner surface (slice 2) and the
cutover (slice 4). The literal-narrowing typing is the part with execution risk and pulls
the other two along, so they review together.

## Scope

**In:** `FieldOutputType` value-union narrowing for read output **and** write input
(R4/R5) with literal-propagation type-tests; `db.enums.<ns>.<Name>` on the `db` facade
+ the enum accessor object (R6); Postgres `array_position` ORDER-BY
rendering for enum columns (R8). Type-tests (`*.test-d.ts`) per hop; runtime tests for
`db.enums`; a PGlite integration test for declaration-order sort.

**Out:**
- Server-side enforcement / check constraints — slice 2 (merged).
- Member defaults (`@default(member)`) — TML-2855.
- PSL `enum` repoint / native deletion — TML-2853 (cutover). PSL `enum` stays native;
  only `enumType`-authored contracts exercise this slice.
- Non-Postgres ORDER BY (MySQL `FIELD(...)` / SQLite `CASE` ladder) — future. The
  structured intent is dialect-agnostic, but only the Postgres realization ships now.

## Contract-impact

No new contract entities — reuses slice-1's domain `enum`, the field/column `valueSet`
ref, and the storage value-set. The change is to **emitted type computation**:
`FieldOutputType` narrows enum-using fields to their value union in `contract.d.ts`.
Additive/dark: no contract authored with `enumType` exists yet (PSL `enum` is still
native), so `fixtures:check` stays zero-diff and non-enum field types are unchanged.

## Adapter-impact

**Postgres only.** A new ORDER-BY rendering branch in the Postgres `sql-renderer`
(`array_position(ARRAY[…]::text[], col)`) for enum columns. The SQLite and Mongo adapters
are untouched (declaration-order sort for those targets is future work).

## ADR pointer

`db.enums` introduces the first client-side **IR-entity accessor map**, hung on the
`db` facade as a per-target-projected namespace-keyed map — the broader pattern the
project's `design-notes.md` flags as an open question (ship here, generalize later). No
ADR is authored in this slice; if the
pattern generalizes beyond enums,
capture it at project close-out. The typed-narrowing and ORDER-BY mechanisms sit within
existing patterns — no architectural shift.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| Literal tuple widens to `string`/`string[]` at a type hop | Type-test each hop | The project spec's named risk. `enumType` const-generics → `Definition` → `FieldOutputType` → query I/O. An `expectTypeOf` at each hop localizes any widening. |
| Nullable enum field | Union with `null` after narrowing | `status?: enum` → `'active' \| 'inactive' \| null`; mirror the existing nullable handling already in `FieldOutputType`. |
| `ORDER BY` an enum column over `NULL` rows | `array_position` returns `NULL`; sorts per the default `NULLS LAST` (ASC) | Matches a bare-column `ORDER BY` on a nullable column; assert it in the integration test rather than special-casing. |

## Slice-specific done conditions

- [ ] Type-tests assert the value union (not `string`) on read output **and** write input
  in **both** the ORM and query-builder lanes, and that the literal tuple survives each hop.
- [ ] A PGlite integration test confirms `ORDER BY` on an enum column sorts by declaration
  order, not lexically.

## Open Questions

1. **Where the value-union narrowing lands.** Working position: in `FieldOutputType`
   (contract-ts), so both lanes inherit it through the emitted `FieldOutputTypes` TypeMap;
   fall back to per-lane `ComputeColumnJsType` / `ExtractOutputType` edits only if a lane
   bypasses `FieldOutputTypes`.
2. **Literal availability at the type level.** Working position: narrow from the authored
   `Definition` (which carries `enumType`'s literal members), not from emitted JSON (which
   widens the value-set `values` to `string[]`). If a consumer path types off emitted JSON,
   emitting the value-set `values` as a literal tuple is the fallback — confirm at dispatch
   time.
3. **`db.enums` accessor keys.** Working position: keys are member **names**
   (`db.enums.<ns>.Role.members.User`); the accessor resolves to the member **value**
   (`'user'`), matching slice-1's `enumType` handle.

## References

- Parent: `projects/enums-as-domain-concept/spec.md` (components 6, 7, 8, 10; R4, R5, R6,
  R8) + `design-notes.md`; `plan.md` (parallel group B).
- Linear: [TML-2852](https://linear.app/prisma-company/issue/TML-2852)
- Surfaces (grounded): `contract-ts/src/contract-types.ts` (`FieldOutputType`);
  `sql-orm-client/src/orm.ts` (client Proxy) + slice-1's `enum-type.ts` handle;
  `postgres/src/core/sql-renderer.ts` (ORDER BY); `value-set-ref.ts`;
  `storage-value-set.ts` (ordered `values`).
- Slice-1 (merged) authoring: `enumType` / `member`, the domain `enum` entity, the
  field/column `valueSet` ref.
