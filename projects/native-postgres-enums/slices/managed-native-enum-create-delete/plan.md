# Dispatch plan — `managed-native-enum-create-delete`

**Spec:** [`spec.md`](spec.md). Sequential, test-first. **Sequencing:** stacks on `serialize-native-enum-entities` (PR #946, queued) — the expected-side projection reads the hydrated `entries.native_enum`; rebase onto main when #946 lands.

## D1 — `enum-node-and-diff-visibility`

- **Outcome:** enum drift is visible end-to-end: `PostgresNativeEnumSchemaNode` exists (kind-registered, transient, schema-scoped identity, ordered-member `isEqualTo`, carries expected-side `control`); the expected projection replaces the hardcoded `nativeEnumTypeNames: []` by projecting `entries.native_enum` (all grades); the actual projection builds nodes from the adapter's introspected `nativeEnums`; the unified differ reports missing / extra / value-mismatch; dispositions apply grade — `managed` reports drift in `db verify`, `external`/`observed` suppress, and every existing Supabase/external test passes unchanged.
- **Builds on:** — (branch base = #946).
- **Hands to:** diff issues D2 lowers to ops.
- **Focus:** node per the role template; both projection sites; disposition via the existing per-issue control-policy subject resolution (do NOT skip-project external enums); the namespace node's plain `nativeEnums` data stays for infer. Tests: node unit (identity/ordered equality), differ tests (all three issue shapes), verify-level grade tests, the untouched external pins.
- **Completed when:** new tests red→green; target-postgres package tests + typecheck green; zero edits under existing Supabase/external test files.

## D2 — `create-drop-ops`

- **Outcome:** managed enum issues lower to ops: `CREATE TYPE <qualified> AS ENUM (…)` for missing, `DROP TYPE <qualified>` for extra-under-managed-claim (extra-object disposition mirrors the table precedent), with control-policy subject resolution for both factory names, ordering guaranteed (type before dependent column DDL; drop after dependent column removal), and value-mismatch emitting the named unsupported diagnostic — never a silent no-op or a drop-recreate.
- **Builds on:** D1.
- **Hands to:** a plannable managed lifecycle D3 proves live.
- **Focus:** op factory calls + rendering (schema-qualified, quoted, ordered members via the existing DDL-schema resolution); issue→op lowering in the planner strategy layer (RLS precedent); the ordering proof at planner level (one migration containing a new enum + a table using it). Tests: planner unit tests for all four paths (create, drop, ordering, mismatch-diagnostic).
- **Completed when:** planner tests red→green; typecheck + target-postgres tests green; `lint:casts` no increase.

## D3 — `live-proof-and-bookkeeping`

- **Outcome:** the slice DoD holds against a live database (PGlite integration): managed enum + column migrates from empty with `CREATE TYPE` ordered first and verify clean; block removal plans + applies `DROP TYPE`; verify reports the three drift shapes; external (Supabase fixture) yields zero enum ops and no drift. Bookkeeping: project [`plan.md`](../../plan.md) Phase-2 section updated (Slice C shipped via PR #944, Slice A shipped here, Slice B next with the ADD VALUE caveat), and the slice spec's diagnostic wording recorded there for B to replace.
- **Builds on:** D1 + D2.
- **Hands to:** PR-open; Slice B.
- **Focus:** integration test following the migration e2e precedents; full gates rebuilt-first with logs on disk (`build`, `typecheck`, `lint:casts`, `lint:deps`, `lint:framework-vocabulary`, `fixtures:check` — enum-free fixtures must not drift, `test:packages`, `test:integration`); known flake families dispositioned with isolation reruns.
- **Completed when:** all gates green or dispositioned with evidence; orchestrator independently re-runs before PR-open.
