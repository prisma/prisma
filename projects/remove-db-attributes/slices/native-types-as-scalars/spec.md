# Slice: native-types-as-scalars

Parent project: `projects/remove-db-attributes/`. Outcome contributed: every former `@db.*` native type is a first-class bare scalar type; `Json`/`Jsonb` carry their decreed codecs.

## At a glance

The postgres target contributes the eleven `@db.*` native types as top-level type-constructor descriptors (`VarChar(191)`, `Uuid`, `Numeric(10,2)`, …), bare `T` becomes sugar for `T()` (so `VarChar` sans parens stays authorable, as `@db.VarChar` was), and `Json` re-binds to `pg/json@1` with new `Jsonb` carrying `pg/jsonb@1`. `@db.*` keeps working — removal is slice 4.

## Chosen design

**Contributions** (postgres adapter, beside `postgresScalarAuthoringTypes` — same channel slice 1 built):

| Name | Args | Output |
| --- | --- | --- |
| `VarChar` | 1 optional int ≥ 1 (`length`) | `sql/varchar@1`, `character varying`, `typeParams.length` when given |
| `Char` | 1 optional int ≥ 1 (`length`) | `sql/char@1`, `character` |
| `Numeric` | 2 optional ints (`precision` ≥ 1, `scale`) | `pg/numeric@1`, `numeric` — minimum corrected 2026-07-14: legacy `@db.Numeric` rejects precision < 1; parity is the law |
| `Timestamp` / `Timestamptz` / `Time` / `Timetz` | 1 optional int ≥ 0 (`precision`) | `pg/timestamp@1` / `pg/timestamptz@1` / `pg/time@1` / `pg/timetz@1` |
| `Uuid` / `SmallInt` / `Real` | none | `pg/uuid@1` / `pg/int2@1` / `pg/float4@1` |
| `Date` | none | **explicit** `{ codecId: 'pg/date@1', nativeType: 'date' }` (updated by TML-3086) |
| `Jsonb` | none | `pg/jsonb@1`, `jsonb` (new) |
| `Json` (re-bind) | none | `pg/json@1`, `json` (was jsonb) |

Codec ids and no-arg emission shapes must match `NATIVE_TYPE_SPECS` (`packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts`) exactly — parity is the gate. Omitted optional args omit the typeParams key (as `@db.VarChar` bare did).

**Bare-name sugar (`T` ≡ `T()`)**: the scalar projection (`collectScalarTypeConstructors`) and/or plain-name resolution broadens from "declares zero args" to **"instantiable with an empty argument list"** (all args optional, literal-or-defaultable output template). Bare `VarChar` then resolves exactly like `VarChar()`. Constructors with required args or `entityRefArg` stay excluded. Both syntactic positions (named-type declaration and field position) resolve the new names — field position already flows through `resolveFieldTypeDescriptor`'s constructor path; named-type constructor declarations (`Slug = VarChar(191)`) through `resolvePslTypeConstructorDescriptor`.

**⛔ Operator gate (operator-mandated 2026-07-11; carried from project plan):** this slice must evaluate **retiring `scalarTypes` from `buildSymbolTable`** (`psl-parser/src/symbol-table.ts`) — its sole use is the `isScalarBinding` ScalarSymbol/TypeAliasSymbol split for `types {}` declarations, which `resolveNamedTypeDeclarations` re-classifies authoritatively. **Halt condition on the owning dispatch:** if the implementer or slice author concludes the simplification should NOT be done (split proves load-bearing, or cost disproportionate), HALT and escalate to the operator with rationale. Silently keeping the parameter is forbidden; only the operator may waive.

**Generator storage override retired (operator-decided 2026-07-15, in-slice).** `@default(<generator>)` never mutates storage — the type position is the only storage decider (the project's own purpose applied to defaults). Retired wholesale: `generatedColumnDescriptor` / `resolveGeneratedColumnDescriptor` in `@prisma-next/ids` and its threading (`mutation-default-types.ts`, adapters), the override block in `psl-field-resolution.ts`, and the transitional `baseScalar` marker shipped by this slice's F-1 fix. Semantics after: `String @default(uuid())` = target's String storage (pg: text) + generated values; explicit storage spellings (`Uuid`, `Char(36)`) are the way to pin storage. Generator applicability validation (`applicableCodecIds`) survives — it validates, it does not mutate. TS field presets untouched (explicit bundles). Breaking change → upgrade-instructions entry; TS↔PSL parity fixtures re-pair preset spellings with explicit PSL storage spellings.

## Coherence rationale

One outcome — "the native types exist as bare scalar types with exact storage parity" — delivered by contributions + the bare-name sugar they require + the parity tests that prove it. The JSON re-bind rides along because `Jsonb`'s existence and `Json`'s meaning are one decision.

## Scope

**In:** postgres adapter contributions; `collectScalarTypeConstructors` / plain-name resolution broadening (framework-components + SQL contract-psl); symbol-table `scalarTypes` retirement evaluation (gated above); parity tests (bare vs `@db.*`, both positions); `Json`/`Jsonb` re-bind incl. updating in-repo tests/fixtures that assumed `Json` = jsonb (transitional constraint: slice stays green).

**Out:** consumer migration of examples/extension contracts (slice 3); psl-infer printing (slice 3); `@db.*` removal + migration diagnostic (slice 4); any TS-builder surface change (non-goal); new native types beyond the table above.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| TS↔PSL parity tests pairing `field.json()` (jsonb) with PSL `Json` | Re-pair with `Jsonb` | Non-goal forbids changing `field.json()`. Parity fixtures switch the PSL side to `Jsonb` where the TS side means jsonb. If a case can't be satisfied this way, **halt and escalate** (I12) — do not re-bind the TS preset. |
| In-repo `Json` fields expecting jsonb (fixtures, interpreter/LSP/adapter tests) | Update within this slice | The re-bind is deliberate semantics; affected assertions/fixtures move to `Jsonb` or expect `json`. Unexplained drift outside JSON columns = halt. |
| `@db.*` on a base whose meaning changed (`Json @db.Json`) | Keep legacy path byte-stable | `NATIVE_TYPE_SPECS` untouched this slice; `@db.Json` still yields `pg/json@1`. Base-type validation (`baseType: 'Json'`) must keep accepting `Json` — verify, since the scalar map entry it checks against changed codec. |
| Name collision: target contributes `Timestamp` while an extension contributes the same top-level name | Existing collision rejection covers it | Slice-1 attribution errors at assembly; add no new mechanism. |
| Bare `Numeric` (both args omitted) | Legal, no typeParams | Matches `@db.Numeric` bare. |

## Slice-specific done conditions

- [ ] Parity tests: for each of the eleven mappings, bare-type authoring (both positions, with and without args where optional) emits the identical `{ codecId, nativeType, typeParams }` as the `@db.*` equivalent — including omitted-optional-arg forms.
- [ ] `Json` → `pg/json@1` and `Jsonb` → `pg/jsonb@1` test-covered.
- [ ] Operator gate resolved: symbol-table simplification either done, or an escalation with rationale is on the operator's desk — no third state.
- [ ] Generator storage override fully retired: `rg 'generatedColumnDescriptor|resolveGeneratedColumnDescriptor|baseScalar' packages --type ts` returns zero production hits; `String @default(uuid())` emits text storage (test-pinned); upgrade entry covers the storage change.
- [ ] `pnpm fixtures:check` clean; `pnpm lint:deps` clean.

## Open Questions

None — design settled at project level; the symbol-table evaluation is a gated decision point, not an open question.

## References

- Parent project: `projects/remove-db-attributes/spec.md` · plan: `projects/remove-db-attributes/plan.md` (slice-2 entry carries the operator gate)
- Linear issue: [TML-2986](https://linear.app/prisma-company/issue/TML-2986)
- Key surfaces: `psl-column-resolution.ts` (`NATIVE_TYPE_SPECS` — parity oracle, untouched), `framework-authoring.ts` (`collectScalarTypeConstructors`), `symbol-table.ts` (`isScalarBinding`), postgres adapter `control-mutation-defaults.ts` (`postgresScalarAuthoringTypes`), `psl-authoring-arguments.ts` (`mapPslHelperArgs` — optional-arg machinery)
- Calibration: failure modes F1, F3, F13 (parity tests must discriminate), F14, F17 (property statements); grep-library § Test-literal hygiene
