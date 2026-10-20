# Dispatch f: journeys, the golden test's retirement, docs

Read `common-rules.md` first. Plan "Dispatches" row f, decision 4, and design "Tests for slice 3" (which is this slice).

## Build

1. A test-only extension in `test/integration` declares `testext/thing` with one integer parameter, a codec and a constructor marked `inferred`. A journey creates a PGlite domain or type for it by raw SQL (whatever PGlite allows that reports a base-type text the extension can claim; explain your choice), a table with a column of it and a list of it, then `db verify` against a contract that declares it (clean), `contract infer` (prints the extension's constructor). A second run without the extension in the config expects verify's unclaimed-type mismatch and infer's `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED`.
2. A matrix journey per target (PGlite and SQLite): every data type with a constructor marked `inferred`, as a column and as a list where the target supports lists, created by a planned migration, then `db verify` clean, then each column's type changed by raw SQL to another type and verify names exactly that column. Fold into the existing marked-types round trip if that fits better.
3. Enum cases against PGlite: in `public`, in another schema (on and off the search path), a quoted name, an enum list.
4. Retire the golden planner test: delete `test/integration/test/planner-golden/planner-ddl-golden.test.ts` and `manifest.json`. The fixture contracts, their configs and `planned.golden.json` stay, because the contract-parity tests and two released upgrade-instruction tests read them. Keep `emit-fixture-configs.mjs`'s fixture root and the `biome.jsonc` globs if the fixtures still need them; say which you kept and why. Update `drive/calibration/dod.md` and `failure-modes.md` mentions if they describe the test as live.
5. Docs: ADR 254's sections on comparing and verify say what this slice built; I edit the ADR, so list for me the statements that no longer hold rather than editing it. Update package READMEs and `docs/reference/error-reference.md` for any new code.

## Done when

The journeys pass; the slice 4 grep checks pass; root `typecheck:agent`, `lint:agent`, `lint:deps`, `lint:docs`, `fixtures:check:agent`, `check:error-reference`, `check:upgrade-coverage --mode pr`, and `mise exec -- pnpm test --coverage` in every package the slice touched, against each package's thresholds. Report the full results.
