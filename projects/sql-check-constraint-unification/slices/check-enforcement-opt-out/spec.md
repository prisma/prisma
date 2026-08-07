# Slice 3 — `check-enforcement-opt-out` — Spec

**Parent:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md) § Slice 3 locked decisions · **ADR:** [ADR 244](../../../../docs/architecture%20docs/adrs/ADR%20244%20-%20Check%20constraints%20are%20opaque%20wire-named%20expressions.md) § "Follow-up: a per-column opt-out"

## Purpose

Let the author of a `managed` table decline enforcement of a generated CHECK constraint on a specific column, and make `contract infer` emit that opt-out for every list column whose live database does not carry the derived check — restoring **pulled schemas verify clean immediately** as the infer default.

Slice 1 scoped derivation to `managed` tables, which fixed the unfixable case (a check declared on a schema the policy forbids ever installing). What remains is the fixable-but-annoying case: a pulled managed schema declares element-non-null checks its source database never had, so it needs one migration before `db verify` is clean. The interim fidelity tests assert convergence instead of cleanliness; this slice flips them back.

## Locked decisions (from slice-1 review, restated verbatim in ADR 244 §131)

1. **Opting out of enforcement does not change declared types.** The enum union and the non-null element type stand; runtime values may diverge from the types once enforcement is waived — the author's accepted risk, stated in docs, never encoded in the type.
2. **Infer emission is conservative.** Opaque introspection cannot classify a live predicate, so `contract infer` emits the enforced form only when a live check's name matches the derived wire name, and the opted-out form otherwise. Hand-written live checks surface separately (as `--strict` extras, exactly as today) and are never inferred into PSL.
3. Interim behavior being replaced: `expectConvergesOnDerivedChecks` in `test/integration/test/cli-journeys/infer-roundtrip-fidelity.e2e.test.ts:134-161`.

## Taxonomy correction (plan language vs code)

The plan names three opt-out kinds — element non-null, scalar enum membership, enum-list membership. The code has **two renderer kinds** crossed with the column's `many` flag (`PostgresCheckKind = 'membership' | 'elementNotNull'`, `packages/3-targets/3-targets/postgres/src/core/check-expressions.ts:9`):

| Column shape | Derived checks (`check-expressions.ts:59-80`) |
| --- | --- |
| domain enum, scalar (`memberValues` set, `many: false`) | `membership` → `"col" IN (…)` |
| domain enum, list (`memberValues` set, `many: true`) | **both**: `membership` → `"col"::text[] <@ ARRAY[…]::text[]` **and** `elementNotNull` → `array_position("col", NULL) IS NULL` |
| plain list (`many: true`, no `memberValues`) | `elementNotNull` only |
| native-enum column (`pg.enum(...)`, no `memberValues`) | scalar: none; list: `elementNotNull` only |

The opt-out surface is therefore **per column, per renderer kind**. The two kind identifiers `membership` and `elementNotNull` are used verbatim at every layer — PSL argument, TS argument, persisted contract value — with zero translation tables. The plan's "scalar enum membership" and "enum-list membership" are the same kind (`membership`); they differ only in the column's `many` flag and cannot be opted out separately (a column is either scalar or list; there is no column with both forms).

## Surface

### PSL

New built-in **field attribute** `@noCheck`, family-level (there is no target-contributed field-attribute seam — `authoring.modelAttributes` has no field twin; grep confirms zero hits for `fieldAttributes` across `packages/1-framework`, `packages/2-sql`, `packages/3-targets` — and inventing one is out of scope):

```prisma
model User {
  id    Int      @id
  role  Role                                  // enforced: membership check derived
  kind  Role     @noCheck                  // no checks derived for this column
  roles Role[]   @noCheck(membership)      // elementNotNull still derived; membership not
  tags  String[] @noCheck(elementNotNull)  // no checks derived (elementNotNull was the only kind)
}
```

Grammar: zero or more arguments, each one of the bare identifiers `membership` or `elementNotNull`; duplicates are a spec-validation error. **Bare `@noCheck` (zero arguments) means "every kind derivable for this column's shape"** and is resolved to the concrete kind list at interpretation time — the persisted contract always carries concrete kinds, never a wildcard.

### TypeScript contract authoring

New builder method on `ScalarFieldBuilder` (`packages/2-sql/2-authoring/contract-ts/src/contract-dsl.ts:162`), inherited by `EnumScalarFieldBuilder`, modeled exactly on `many()` (`:247-279`: returns a new builder with the flag spread into state; no type-level state change — decision 1 forbids type changes):

```ts
noCheck(...kinds: readonly ('membership' | 'elementNotNull')[]): this-shaped builder
```

`f.enum(Role).noCheck()` ≡ bare `@noCheck`; `f.enum(Role).many().noCheck('membership')` ≡ `@noCheck(membership)`. Calling `noCheck()` twice is a build-time error (same rule as duplicate PSL arguments). The runtime state slot is `noCheck?: readonly PostgresCheckKind[]` on `AnyScalarFieldState` (`contract-dsl.ts:36-47`); `ScalarFieldState`'s generic parameters are untouched.

### Not the surface

- **Not column `control`.** `StorageColumn.control?: ControlPolicy` exists (`packages/2-sql/1-core/contract/src/ir/storage-column.ts:23`) and is not consulted by check derivation. It stays not-consulted. Enforcement opt-out is a statement about one derived constraint on an otherwise fully managed column; column control is a policy axis with verify/plan semantics far beyond checks. Conflating them would make "don't derive a check" imply "don't manage this column". No change to column `control` in this slice.
- **Not a model-level attribute.** Kinds attach to columns; a model-wide waiver invites accidental blanket opt-outs and has no infer use case (infer decides per column).

## Persisted contract shape

`StorageColumnInput`/`StorageColumn` (`packages/2-sql/1-core/contract/src/ir/storage-column.ts:15-25, 40-63`) gain:

```ts
/** Generated-check kinds the author declined for this column. Presence means opted out; never an empty array. */
readonly noCheck?: readonly ('membership' | 'elementNotNull')[];
```

- **Wire schema** (`packages/2-sql/1-core/contract/src/ir/storage-entry-schemas.ts:37-53`, `StorageColumnSchema`): add `'noCheck?': '("membership" | "elementNotNull")[]'` plus a `.narrow(...)` asserting non-empty, no duplicates, and sorted ascending (the schema's existing `.narrow` for `typeParams` xor `typeRef` at `:48-52` is the pattern). The schema's `'+': 'reject'` makes this addition mandatory before anything can round-trip.
- **Presence-means-opted-out.** The key is absent for enforced columns — same convention as `many?: true` — so no `preserveEmptyPatterns` entry is needed (`packages/2-sql/1-core/contract/src/canonicalization-hooks.ts:10-23`; the `indexes.unique` preserve entry at `:14-17` is the trap this avoids).
- **Canonical order** of the array is fixed ascending lexicographic: `['elementNotNull', 'membership']`. Producers emit sorted; the schema narrow rejects unsorted input rather than sorting it (matching the contract layer's validate-don't-repair stance).
- **`storageHash`:** contracts that use the flag hash differently; contracts that don't are byte-identical, so no blanket fixture regeneration occurs. Only fixtures/tests added by this slice carry the key.
- **Schema IR is untouched.** The flag never reaches `SqlColumnIR`: its entire effect is spent at contract-build time (checks not emitted). `contract-to-schema-ir.ts` copies columns as today; the differ, verifier, and planner see simply "no check node declared". Do not add the flag to `SqlColumnIRInput`.

## Authoring pipeline changes (exact sites)

### PSL side (`@internal/sql-contract-psl`)

Following the end-to-end registration checklist the codebase already implies:

1. **Spec**: add `noCheckFieldSpec` to `packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts` beside `idFieldSpec`/`uniqueFieldSpec` (`:186-187`), built from the `fieldAttribute()` + `optional()` + `oneOf('membership','elementNotNull')` + `list()` combinators (imports at `:16-32`). A `refine` rejects duplicate kinds — `indexModelSpec`'s refine (`:207-259`) is the validation pattern.
2. **Allowlist**: add `'noCheck'` to `BUILTIN_FIELD_ATTRIBUTE_NAMES` (`packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts:161-167`) or every use is rejected as `PSL_UNSUPPORTED_FIELD_ATTRIBUTE` (`:229, :261`).
3. **Interpretation**: in `collectResolvedFields` (`psl-field-resolution.ts:560-600`), read the attribute via `interpretFieldAttribute`, resolve bare form to the concrete kinds derivable for the column shape (see Validation below — the resolver must know `many` and whether the field's type is a domain enum), and add `noCheck?: readonly PostgresCheckKind[]` to `ResolvedField` (`:569-583`).
4. **Definition tree**: carry it in `interpreter.ts:1432-1445` into `FieldNode`, which gains the same optional slot (`packages/2-sql/2-authoring/contract-ts/src/contract-definition.ts:38-48`). `FieldNode` is the convergence type — the TS builder's `contract-lowering.ts:798-807` writes the same slot from `fieldState.noCheck`.

### Build (`@internal/sql-contract-ts`)

`packages/2-sql/2-authoring/contract-ts/src/build-contract.ts`:

- The per-field emission site (`:951-968`) filters the renderer's candidates: `candidates.filter((c) => !field.noCheck?.includes(c.kind))`. The renderer itself (`postgresRenderCheckExpressions`) is **not** modified — rendering stays a pure function of column shape; the opt-out is a build-time policy applied to its output, exactly parallel to how `derivesChecks` (`:845-852`) already gates the whole call.
- `buildStorageColumn` (`:602`) persists the flag onto the column: `...(field.noCheck !== undefined ? { noCheck: [...field.noCheck].sort() } : {})`.
- Validation (below) runs here for the TS path and in the PSL resolver for the PSL path, both before emission.

### Validation

A kind that can never apply to the column's shape is an authoring error, code **`CONTRACT.CHECK_OPTOUT_INVALID`** (structured-error style of `CONTRACT.ENUM_INVALID`, `build-contract.ts:341, :1279`); the PSL path surfaces the same rule as a spec-validation diagnostic on the attribute node. Exact rules:

| Situation | Outcome |
| --- | --- |
| `membership` on a column with no domain-enum value set (plain scalar, plain list, native-enum column) | error — membership checks are derived only from `enumType()` value sets (`build-contract.ts:945-961`) |
| `elementNotNull` on a non-`many` column | error |
| bare `@noCheck` on a column that derives nothing (plain scalar; native-enum scalar) | error — a no-op waiver is a lie in the schema |
| duplicate kinds, in either surface | error |
| any opt-out on a column of a non-`managed` table (source-declared, either surface) | **tolerated and NOT persisted** — the flag is neither validated nor written to the contract; both surfaces behave identically (the TS build drops it, the PSL resolver skips interpretation when the model declares a non-`managed` `@@control`). A specifier-stamped non-managed table likewise derives nothing, though a flag persisted before stamping remains in the contract bytes — policy may be stamped post-build (`applySqlSpecifierControlPolicy`), so erroring on it would make pack-stamped contracts order-dependent |
| flag on a SQLite contract | unreachable in practice (the Postgres hook is the only check emitter; a column-shape kind can never validate), but the validation rules above are family-level and apply as-is |

Bare-form resolution: `@noCheck` on a scalar domain enum → `['membership']`; on a list domain enum → `['elementNotNull', 'membership']`; on a plain or native-enum list → `['elementNotNull']`.

### The strip pass and the "derived == wire-named" marker

No change to `applySqlSpecifierControlPolicy` / `stripDerivedChecksFromNonManagedTables` / `withoutDerivedChecks` (`packages/2-sql/2-authoring/contract-ts/src/derived-checks.ts:29-173`). The strip identifies derived checks as `prefix !== undefined`, and its comment (`:40-49`) anticipated that identification moving with this slice. It does not move: slice 3 adds no producer of checks — an opted-out check is *never emitted*, so wire-named remains exactly "derived by authoring" and exact-named remains exactly "adopted from a live database". Update the comment to say the marker was re-examined here and stands; it moves only when a user-authored check surface (`@@check`, still a non-goal) exists. Mirror the same one-line update in ADR 244 §129.

## Infer changes (`@internal/target-postgres`)

### Naming composition moves to the shared naming module

Deriving the expected wire name at infer time needs prefix composition + truncation + content hash. The hash and truncation already live in `@internal/sql-schema-ir/naming` (`computeCheckContentHash` at `naming.ts:143`, `truncateToWireNamePrefixBytes` at `:241`); the prefix composition (`CHECK_KIND_SUFFIX`, `` `${table}_${column}_${suffix}` ``) is file-private in `build-contract.ts:352-389` and `@internal/target-postgres` does not depend on `@internal/sql-contract-ts`. **Lift it**: add to `packages/2-sql/1-core/schema-ir/src/naming.ts`

```ts
export function composeCheckWirePrefix(tableName: string, columnName: string, kind: 'membership' | 'elementNotNull'): string
```

returning the truncated prefix (suffix map `{ membership: 'check', elementNotNull: 'elem_not_null' }` moves with it). `build-contract.ts` consumes it; the two hand-rolled duplications in `packages/3-targets/6-adapters/postgres/test/migrations/check-lifecycle-e2e.integration.test.ts:47-58` and `native-array-columns.integration.test.ts:50` are replaced by imports. No new package edge is created (`sql-contract-ts` and `target-postgres` both already depend on `sql-schema-ir`).

### Emission rule in `buildScalarField`

`packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-model-blocks.ts:159-282`, where `column.many`, `column.name`, `table.name`, and `table.checks` are all in scope (introspected checks are preserved through `SqlTableIR` — `infer-psl-contract.ts:147`, `sql-table-ir.ts:84-90` — and merely unread today):

For every **list column** (`column.many === true`):

1. Render the expected expression with the in-package hook (`../check-expressions`, relative import — no dependency change): `postgresRenderCheckExpressions({ tableName, columnName, many: true, memberValues: undefined })` yields the single `elementNotNull` candidate.
2. Compute the expected wire name: `formatWireName(composeCheckWirePrefix(table, column, 'elementNotNull'), computeCheckContentHash(expression))`.
3. If `table.checks` contains a check with **exactly that name** → enforced form: emit no attribute.
4. Otherwise → emit the field attribute node `@noCheck(elementNotNull)`.

The comparison is by full physical name only — never by expression (the live body is a Postgres reprint; comparing it is the mistake slice 1 eliminated). Because step 2 uses the same truncation and hash code as authoring, truncated and multibyte prefixes match by construction.

**`membership` is unreachable at infer time**, and the spec pins that as intended: infer never emits domain enums (`enumType()` is not inferred — pre-existing gap, project non-goal), so no inferred column ever has `memberValues`, so no membership check is ever derived from a pulled schema and no `@noCheck(membership)` is ever emitted by infer. The day domain-enum inference exists, its slice extends this rule to `membership` using the same steps 1–4; note this in the code comment at the emission site.

Hand-written live checks (any check whose name is not the derived wire name): untouched by inference, exactly as today — they remain live extras, visible to `db verify --strict`, dropped only under `destructive`. Infer does not consume, rename, or represent them.

The printer needs no work: `printPsl` renders whatever field attributes the AST carries (`packages/1-framework/2-authoring/psl-printer/src/ast-to-print-document.ts:208`), and the attribute node is built with the same helpers `@id`/`@unique` use in `infer-model-blocks.ts:219-270`.

## What this slice does NOT touch

- **Verifier, differ, planner, ops, DDL: zero changes.** There is no verify-side suppression path for a declared-but-missing check (`classifySqlDiffIssue` returns `declaredMissing` before any granularity lookup — `packages/2-sql/9-family/src/core/diff/schema-verify.ts:100-118` — and `dispositionForCategory` fails it even for `external`), and this slice deliberately does not create one. The opt-out works purely by not declaring the check; an undeclared check produces no issue, no plan call, nothing. This is the "authoring declares, the planner reconciles" invariant doing its job.
- **Declared types** (decision 1): `valueSet`, the generated enum union, `ReadonlyArray` element non-nullability, declaration-order `ORDER BY`, `db.enums` — all unchanged whether or not the column is opted out.
- **`SqlCheckConstraintIR`, wire naming, rename pairing** — untouched.
- **SQLite, Mongo** — untouched (SQLite still refuses check DDL; the flag validates as inapplicable there because no SQLite column shape derives a check).

## Tests

### Unit (`packages/2-sql/2-authoring/contract-ts`, extend `check-constraint.authoring.test.ts`)

1. Scalar domain enum + `noCheck('membership')` → `table.checks` has no membership entry; `valueSet` still present on the column; `unenforced: ['membership']` persisted.
2. List domain enum + `noCheck('membership')` → exactly the `elem_not_null` check remains.
3. List domain enum + bare `noCheck()` → no checks; persisted `['elementNotNull', 'membership']` (canonical order).
4. Plain list + `noCheck('elementNotNull')` → no checks.
5. Each `CONTRACT.CHECK_OPTOUT_INVALID` row from the Validation table (membership on plain scalar; elementNotNull on scalar; bare form on plain scalar; duplicate kinds; double `noCheck()` call).
6. Opt-out on a column of a table stamped non-`managed` by a specifier → builds, no-op, strip pass unaffected.
7. Wire-schema round-trip: contract JSON with `noCheck` hydrates; unsorted / empty / duplicate arrays are rejected by the narrow.
8. Canonicalization: flag ordering is stable under serialize → hydrate → serialize.

### PSL (`packages/2-sql/2-authoring/contract-psl`)

9. Each PSL form in the At-a-glance parses, interprets, and produces the same contract as the equivalent TS authoring (parity assertion).
10. `@noCheck(bogus)` and `@noCheck(membership, membership)` are spec-validation errors; `@noCheck` on an unsupported column shape carries the field/attribute source span.

### Integration (`packages/3-targets/6-adapters/postgres`, extend `check-lifecycle-e2e.integration.test.ts`)

11. Lifecycle of an opt-out **added later**: enforced contract migrated (check live) → author adds `@noCheck(elementNotNull)` → next plan carries exactly one `dropCheckConstraint` (`destructive`) → applied → verify clean.
12. Lifecycle of an opt-out **removed**: opted-out contract (no live check) → author deletes the attribute → next plan carries exactly one `Add check constraint` (`additive`) → applied → verify clean; out-of-set/NULL-element INSERTs now rejected.
13. Opted-out column on a freshly created table: `CREATE TABLE` DDL contains no check for that column; verify clean; INSERT with a NULL element **succeeds** (enforcement genuinely absent, not merely undeclared).

### Infer e2e (`test/integration/test/cli-journeys/infer-roundtrip-fidelity.e2e.test.ts`)

14. Replace `expectConvergesOnDerivedChecks` (`:134-161`) with `expectVerifiesCleanAfterPull`: `db verify --schema-only` exits 0 immediately after infer → emit, zero issues. Flip all three call sites (`:321`, `:431`, `:564`). The emitted PSL for `users.tags` contains `@noCheck(elementNotNull)`.
15. New fidelity case: seed the live database **with** the correctly wire-named `elem_not_null` check (create via `checkExpression` DDL or a first prisma-next migration), then infer → the emitted PSL has **no** `@noCheck` and verify is clean — the enforced form is preserved through a pull.
16. New fidelity case: seed a **hand-written** check on the list column (name not the wire name), infer → `@noCheck(elementNotNull)` emitted; plain verify clean; `--strict` reports the hand-written check as an extra.
17. `brownfield-adoption.e2e.test.ts` continues to pass unchanged (its seed has no list column; assert nothing regressed).

## Fixture and upgrade impact

- `fixtures:emit` / `fixtures:check`: no existing fixture changes (the flag is presence-only and no existing fixture uses it). New fixtures added by tests carry it.
- `migrations:regen`: no changes to existing generated migrations.
- **Upgrade skill entries** (per `check-upgrade-coverage` and the record-upgrade-instructions skill): this PR touches neither `examples/` nor `packages/3-extensions/` unless a test fixture there is added — if the diff stays out of both substrates, no entry is due; if an extension fixture is touched, declare `changes: []` in the then-current in-flight extension transition. The new PSL attribute and TS builder method are **additive** — existing schemas and contracts are untouched — so the user-skill entry, if the release cycle requires one, documents the new surface with `detection` on `@noCheck` and requires no consumer action.

## Docs (rides in the slice PR, per doc-maintenance rules)

- **ADR 244**: §174 (Consequences) — replace "The slice-3 opt-out surface removes that too" with the landed account; §131 — mark the follow-up delivered; §129 — record that the wire-named marker was re-examined and stands (see Strip pass above).
- **`derived-checks.ts:40-49`** comment — same re-examination note.
- **User-facing risk statement** (decision 1): `skills/prisma-8/references/contract.md` enum section (~`:250`) gains the enforcement-waiver paragraph — types still claim what enforcement no longer guarantees; the divergence is the author's accepted risk. `skills/prisma-8/references/quickstart.md:230, :259-262` — brownfield path now states that infer emits `@noCheck` for constraints the database does not carry and that verify is clean immediately.
- **Stale subsystem docs** touched in passing (slice-1 leftovers, fix while in the area): `docs/architecture docs/subsystems/5. Adapters & Targets.md:180` and `1. Data Contract.md:211` still describe the pre-slice-1 structured value-set check model.
- The Migration System subsystem doc's unified-check section remains a **close-out** obligation (project plan), not part of this slice.

## Definition of Done

- All four At-a-glance PSL forms and their TS equivalents build, round-trip through contract JSON, and validate per the Validation table; `CONTRACT.CHECK_OPTOUT_INVALID` covers every inapplicable-kind case.
- An opted-out column derives no check anywhere: not at `CREATE TABLE`, not as a later `ADD CONSTRAINT`, not as a verify issue. Integration test 13 drives the real builder (`defineContract` + `.noCheck()`) against a real database; tests 11–12 pin the planner/DDL lifecycle for a check-less contract; the full authoring-to-infer chain is proven by the infer e2e journeys plus the print-psl emission unit tests.
- `contract infer` emits `@noCheck(elementNotNull)` exactly when the live database lacks the derived wire-named check (tests 14–16); the enforced form survives a pull when the check is live (test 15).
- The three fidelity call sites assert immediate cleanliness; `expectConvergesOnDerivedChecks` is deleted.
- `composeCheckWirePrefix` lives in `@internal/sql-schema-ir/naming`; `build-contract.ts` and both integration-test duplications consume it; the private `CHECK_KIND_SUFFIX`/composition in `build-contract.ts` is gone.
- Declared types are proven unchanged: a type-level test pins that an opted-out enum column still types as the union and an opted-out list still types `ReadonlyArray<NonNullable<…>>`.
- No schema-IR, differ, verifier, planner, op, or DDL code path changed (grep-clean diff outside `contract`, `contract-ts`, `contract-psl`, `psl-infer`, naming, tests, docs).
- ADR 244 amendments and the user-facing docs land in the same PR.

## Non-goals (unchanged from the project spec, restated where this slice borders them)

- `@@check` / arbitrary user-authored checks. The `@noCheck` attribute waives generated checks only.
- Domain-enum inference (`enumType()` from a pulled schema) — which is why `@noCheck(membership)` is never emitted by infer in this slice.
- Any verify- or plan-time suppression mechanism for declared checks.
- Per-column `control` semantics.
