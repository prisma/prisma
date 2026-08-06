# Brief: D6 reclassify integer representation authoring as target-scoped types

## Task

Replace the `bigIntNumber` / `unboundedInt` field-preset authoring entries with target-scoped, top-level zero-argument type constructors named `BigIntNumber` / `UnboundedInt`, such that PSL resolves them as ordinary bare types, the composed TypeScript callback exposes `type.BigIntNumber()` / `type.UnboundedInt()`, and canonical reverse introspection remains entirely controlled by the existing mappings and codec `targetTypes` claims. Write or modify tests before production definitions.

## Scope

**In:** PostgreSQL and SQLite target authoring type/field contributions; the adapter/control-stack scalar authoring parity expectations reached by those contributions; composed TypeScript authoring helper tests proving the applicable target-scoped `type.*` builders and `field.namedType(...)` result types; removal/replacement of the target field-preset unit tests for these names; preservation of the already-exported per-codec column helpers.

**Out:** PSL fixture source and generated artifacts; integration runtime tests; long-lived docs and API prose; codec implementations, IDs, aggregate rows, JSON projections, canonical introspection maps, and any new DSL helper. D7 owns fixture/doc migration and full fixture validation.

## Completed when

- [ ] Tests prove PostgreSQL contributes bare-eligible `BigIntNumber` and `UnboundedInt`, SQLite contributes only `BigIntNumber`, the matching field-preset entries are absent, and other target composition does not receive inapplicable names.
- [ ] Composed TS authoring tests prove `field.namedType(type.BigIntNumber())` and PostgreSQL `field.namedType(type.UnboundedInt())` preserve the expected codec/application types; existing direct column helpers remain type-safe without a compatibility preset.
- [ ] Target, adapter, and contract-TS targeted tests/typechecks/lints plus `pnpm lint:deps` pass; a focused `rg` confirms production authoring contributions contain no `bigIntNumber` / `unboundedInt` field-preset entries.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/codec-json-projections/slices/06-integer-representation-codecs/spec.md` — amended target-contributed-type design and slice DoD.
- Slice plan entry: `projects/codec-json-projections/slices/06-integer-representation-codecs/plan.md` § Dispatch 6.
- Project design record: `projects/codec-json-projections/design-notes.md` § Integer representation and the aggregate operation split.
- Review log: `projects/codec-json-projections/reviews/code-review.md` — read-only for the implementer.
- Calibration: `drive/calibration/failure-modes.md` F3 (grep before suites), F5 (no destructive git operations); `drive/calibration/grep-library.md` cross-cutting TypeScript hygiene.

## Validation gates

- Targeted tests for the modified PostgreSQL and SQLite target authoring contribution suites.
- Targeted scalar-authoring parity/control-stack tests for both adapters.
- Targeted composed-helper runtime/type tests in `@internal/sql-contract-ts`.
- Package typecheck and lint for every touched package.
- `pnpm lint:deps`.
- `rg -n "bigIntNumber|unboundedInt" packages/3-targets/3-targets/postgres/src/core/authoring.ts packages/3-targets/3-targets/sqlite/src/core/authoring.ts` reviewed to confirm only type-constructor names remain in production authoring contributions.

## Operational metadata

- **Model tier:** orchestrator — this is a narrow but architecture-bearing substrate correction across PSL/TS composition and target ownership.
- **Time-box:** 45 minutes wall clock. Overrun halts and surfaces rather than widening scope.
- **Halt conditions:** a type constructor cannot remain independent from reverse introspection; the TS callback cannot derive a type-safe builder from `authoring.type`; another target must expose an inapplicable constructor; fixture/docs must change to make targeted code tests pass; any codec/runtime/introspection behavior needs modification; or any destructive Git operation (`git clean -f*`, `git reset --hard`, `git stash drop/clear`, `git checkout -- .`, forced recursive removal) appears necessary.
