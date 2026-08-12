# Brief: D7 migrate fixtures and the public record to the type surface

## Task

Migrate every shipped consumer and public explanation of the integer representation authoring surface from field-preset calls to the target-scoped types established by D6. PSL examples and fixtures use bare `BigIntNumber` / `UnboundedInt`; TypeScript guidance uses either a registered `type.BigIntNumber()` / `type.UnboundedInt()` storage type with `field.namedType(...)` or the already-exported per-codec column helper with `field.column(...)`. Preserve the emitted codec IDs, application types, runtime behavior, aggregate typing, and canonical introspection mappings.

## Scope

**In:** PostgreSQL and SQLite integration PSL fixture sources; fixture/test comments and names that describe the old call spelling; `packages/2-sql/2-authoring/contract-psl/README.md`; `packages/2-sql/2-authoring/contract-ts/{README.md,API.md}`; `docs/reference/codec-authoring-guide.md`; affected upgrade instructions and other shipped docs found by exhaustive `rg`; generated fixture artifacts only if canonical regeneration changes them; focused tests needed to prove bare-type optional/default/list composition where the removed preset restrictions were previously observable.

**Out:** Codec implementations/IDs, descriptors, `targetTypes`, aggregate rows, runtime/ORM logic, introspection maps, new DSL helpers, backwards-compatible preset aliases, unrelated doc cleanup, and orchestrator-owned files under `projects/codec-json-projections/`.

## Completed when

- [ ] Every executable PSL fixture/example uses bare `BigIntNumber` / `UnboundedInt`, and targeted PSL/TS/integration tests retain the expected codec and application types without runtime or aggregate changes.
- [ ] Public TS guidance accurately demonstrates both supported forms: registering a composed `type.*` result before `field.namedType(...)`, and direct `field.column(pgInt8NumberColumn() / pgUnboundedIntColumn() / sqliteBigintNumberColumn())`; no new helper is introduced.
- [ ] Exhaustive `rg` finds no remaining `bigIntNumber()` / `unboundedInt()` guidance or lowercase preset names outside explicit historical/rejected-alternative project records; `pnpm fixtures:check`, upgrade coverage, targeted package gates, typecheck, lint, and dependency lint pass.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note in your wrap-up message. Anything that pulls you off the goal — even if it looks useful — halts and surfaces.

## References

- Slice spec: `projects/codec-json-projections/slices/06-integer-representation-codecs/spec.md` — target-contributed-type design and amended slice DoD.
- Slice plan entry: `projects/codec-json-projections/slices/06-integer-representation-codecs/plan.md` § Dispatch 7.
- D6 brief and implementation hand-off: `projects/codec-json-projections/slices/06-integer-representation-codecs/dispatches/06-reclassify-authoring-types.md` plus the current worktree diff.
- Review log: `projects/codec-json-projections/reviews/code-review.md` — read-only for the implementer; AC-1 is PASS.
- Calibration: `drive/calibration/failure-modes.md` F3 (grep before suites), F5 (no destructive Git operations), F12 (docs claim scrub); `drive/calibration/grep-library.md` § Docs claim-scrub and cross-cutting TypeScript hygiene.
- Markdown convention: follow the `markdown-no-artificial-line-wraps` skill when editing prose.

## Validation gates

- Targeted emit/PSL authoring tests and integer-representation integration/type tests covering changed fixture consumers.
- Package typecheck and lint for every touched package.
- `pnpm fixtures:check`.
- `pnpm check:upgrade-coverage`.
- `pnpm lint:deps`.
- `rg -n "bigIntNumber\(\)|unboundedInt\(\)" --glob '!projects/**' --glob '!CHANGELOG.md' .` returns no active guidance or executable examples; inspect any historical changelog hit rather than rewriting history.
- `rg -n "field\.bigIntNumber|field\.unboundedInt|bigIntNumber preset|unboundedInt preset" docs packages test skills --glob '*.md' --glob '*.ts' --glob '*.prisma'` returns no stale public/API claims.
- `git diff --check`.

## Operational metadata

- **Model tier:** mid — the design is settled; this is a mechanical fixture/doc migration across multiple public surfaces with validation-sensitive generated artifacts.
- **Time-box:** 45 minutes wall clock. Overrun halts and surfaces rather than widening scope.
- **Halt conditions:** fixture regeneration changes codec IDs/application types/aggregate rows beyond source-spelling-attributable output; a documented TS form is not accepted by the current API; canonical introspection would need changing; a backwards-compatibility alias appears necessary; an out-of-scope runtime file must change; or any destructive Git operation (`git clean -f*`, `git reset --hard`, `git stash drop/clear`, `git checkout -- .`, forced recursive removal) appears necessary.
