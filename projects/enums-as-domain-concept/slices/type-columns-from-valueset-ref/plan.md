# type-columns-from-valueset-ref — Slice plan (baked storage column lookup)

**Spec:** `./spec.md` · **Linear:** [TML-2886](https://linear.app/prisma-company/issue/TML-2886)
**Branch:** `tml-2886-baked-storage-column-lookup` (fresh, off `main`; supersedes closed PR #833)

Fresh implementer + reviewer (the prior agents are anchored to the rejected
ref-following design). Test-first throughout. The acceptance criteria force the two
failure modes the first attempt missed into the gate: **A4** (no ref-following
expression in the emitted `.d.ts`) and **A9** (no excessively-deep instantiation).

## Dispatch units (in order)

### D1 — SQL emitter: bake the storage column lookup + derive the field maps from it

The whole emitter change, since the field maps derive from the storage lookup in the
same pass.

- SQL family emitter (`packages/2-sql/3-tooling/emitter`): emit a new top-level
  `StorageColumnTypes` map (literal types), keyed `[table][column]`, each entry = codec
  output narrowed by the column's `valueSet` (enum → the literal union; non-enum →
  codec output / params). Baked literals — no type expressions.
- Derive `FieldOutputTypes`/`FieldInputTypes` from `StorageColumnTypes` at emit time:
  for each domain field, look up its storage column (via the model's `storage.fields`
  mapping) and bake that literal. Composite (value-object / relation) fields keep their
  existing handling.
- Framework emitter (`packages/1-framework/3-tooling/emitter`): remove the enum/
  value-set render that leaked in (`renderEnumRefUnion`/`EnumValuesResolver` if present
  from a prior state — note this branch is off clean `main`, so confirm what's there);
  delegate per-field type rendering to a family hook so SQL value-set knowledge stays in
  the SQL family.
- **Test-first:** emitter unit tests — `StorageColumnTypes` renders literal entries
  (enum union + non-enum); `FieldOutputTypes[ns][M][enumField]` is the literal union
  derived from the column; `__unbound__` + int-codec enum; a column with no domain field
  appears in `StorageColumnTypes` but not the field map.
- **Verify:** `contract.json`/hashes byte-identical; `fixtures:emit`/`fixtures:check`
  show only `.d.ts`; A5 (no column/value-set strings in framework emitter output);
  **A4** (emitted maps are plain literals — no `ContractBase[...]` expression).

### D2 — Lanes read the baked lookups (delete ref-following + cross-plane walk)

Depends on D1.

- Query builder (`query-builder/src/selection.ts`): `ExtractOutputType` indexes
  `StorageColumnTypes[table][column]` (O(1)); delete `FieldOutputOverride` and the
  column→model→field walk. Raw-value-set column types from the storage lookup.
- ORM (`relational-core/src/types.ts` `ComputeColumnJsType`): read
  `FieldOutputTypes[model][field]` with a single index — revert any ref-following /
  fallback chain. `sql-builder/src/types/table-proxy.ts` output+input likewise.
- **Test-first:** per-surface type tests asserting the union, each non-vacuous (drop the
  lookup entry ⇒ red). Cover: query builder `select` (A1), ORM row (A1), direct
  `FieldOutputTypes[ns][M]` index (A1), input rejection (A2), raw value-set column (A3),
  int-codec enum. Confirm the `.test-d.ts` files are actually compiled (tsconfig/vitest
  include).
- **Verify:** `demo-dx.types.test.ts` asserts the union on all three surfaces; no-emit
  `enum-surface.*` green (A6); no new `as` (A8).

### D3 — Guards + final gate + PR

- Add the **A4 guard** (a test or `fixtures:check`-adjacent assertion that the emitted
  `FieldOutputTypes`/`FieldInputTypes`/`StorageColumnTypes` contain no ref-following
  expression) and an **A9** sanity check (typecheck a wide multi-column selection; no
  "excessively deep").
- Full gate: `pnpm build`, `pnpm typecheck`, `pnpm fixtures:check`, affected suites,
  `lint:deps` (A5), `lint:casts` (A8), `check:upgrade-coverage --mode pr`.
- Open the PR (decision-led body; title `TML-2886:`), base `main`.

## Review focus (every unit)

The reviewer verifies ACs by **reading test assertions** and, for the enum types, by a
**break-and-revert** (zero a lookup entry, confirm the test goes red) — the check the
first attempt skipped. Plus: A4 (no traversal in emitted output), A5 (no SQL in
framework), A9 (type-eval cost). A green suite is not sufficient evidence on its own.

## Notes

- Supersedes PR #833 (closed). TML-2917 (no-emit ref-following) is closed — wrong
  direction. `spaceId`/TML-2500 residual unchanged.
- Observable types must not change; the whole slice is `.d.ts`-text + emitter-code.
