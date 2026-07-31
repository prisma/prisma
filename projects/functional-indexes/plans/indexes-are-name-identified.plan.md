# Plan — Slice 1: `indexes-are-name-identified`

**Spec:** [indexes-are-name-identified.spec.md](../specs/indexes-are-name-identified.spec.md). Dispatches are sequential; each lands with the full verification set green (build, typecheck, whole Lint job, `fixtures:check`, three test suites — reds discovered in a dispatch are that dispatch's to fix). Implementers write tests before implementation (repo golden rule) and run slow commands foreground via the `:agent` wrappers.

## Dispatch sequence

### 1 — Shared naming module

**Outcome:** `@internal/sql-schema-ir/naming` exports `formatWireName`, `parseWireName`, `normalizeSqlBody`, `computeIndexContentHash` (D4 tuple, `String()`-coerced options, 54-char prefix cap); `rls/wire-name.ts` is deleted and every call site (`authoring.ts`, `planner.ts`, adapter `control-adapter.ts`, `exports/rls-canonicalize.ts`) imports the shared module; `rls/canonicalize.ts` imports `normalizeSqlBody`. RLS wire names are byte-identical before/after (existing RLS suites prove it — no fixture moves).

**Builds on:** nothing. **Hands to:** hash + name helpers importable family-wide; RLS behavior pinned unchanged.

**Focus:** mechanical hoist + one new function; the index-hash tuple's unit tests (order sensitivity, options coercion, cap enforcement) are the only new behavior.

### 2 — Contract carries full index names

**Outcome:** contract `Index` has the D1 shape (required `name`, `prefix?`, `columns?` xor `expression?`, `where?`, required `unique`); constructor invariants throw; `IndexSchema`, canonicalization, emitter `contract.d.ts` literals, `factories.ts`, `storage-table.ts` follow; the three lowering paths emit names per the spec's table (unnamed → default-prefix wire name, PSL `map:` → exact, TS `name:` → managed prefix, FK-backing → default-prefix wire name); all fixtures/example contracts re-emitted in one sweep (`pnpm fixtures:emit` — storage hashes move, expected). Diff-tree identity is **not** switched yet: `SqlIndexIR` still pairs by tuple, so every suite stays green with the new names flowing through unused.

**Builds on:** dispatch 1's helpers. **Hands to:** every emitted contract carries a full physical name + mode encoding; fixtures at their post-reshape steady state.

**Focus:** the lowering table and the sweep. The Supabase fixture must regen via its checked-in generator path and stay zero-drift (spec edge-case row) — hand-editing generated artifacts is prohibited.

### 3 — Name identity in the diff tree + full-fidelity introspection

**Outcome:** `SqlIndexIR` per D5 (id = name, equivalence matrix, `expression`/`where`, optional `columns`, dependsOn over-approximation); Postgres introspection captures expression/partial indexes per D6 with `indexNamesWithExpressionKey` and `bestByColumnTuple` deleted and `prefix` stamped; SQLite nodes key by name; `contract-to-schema-ir.ts` passes `unique` and the new fields through; `contract infer` skips expression-carrying nodes (marked for slice 4) and its round-trip suite stays green. Scenario J (same-tuple twins) is representable and tested. `SqlUniqueIR` untouched.

**Builds on:** dispatch 2 (contract names exist, so expected-side nodes always carry one). **Hands to:** the differ pairs indexes by name end-to-end; drift verdicts are name-grounded; no rename capability yet (missing+extra pairs surface as create/drop).

**Focus:** the introspection rewrite (per-position `pg_get_indexdef`, `pg_get_expr(indpred)`) and the equivalence matrix tests; `control-adapter.test.ts` index sections flip from dedup-pinning to twin-preserving.

### 4 — Planner: expression DDL and index renames

**Outcome:** `CreateIndexCall` takes `{ columns } | { expression }` elements plus `where?`/`unique?` and renders the spec's DDL byte-exactly; `RenameIndexCall`/`renameIndex` exist (modeled on the policy rename op: widening class, prechecks, `renderTypeScript`, factory registration); `mapIndexNodeIssue` and all planner-side `?? defaultIndexName(...)` fallbacks are deleted (postgres `issue-planner.ts:479/821/832`, `control-instance.ts:1115` if identity-deriving, sqlite `issue-planner.ts`/`planner-strategies.ts`); the rename post-pass runs phases 1 (hash pairing) and 2 (content pairing) for indexes beside the policy pass, widening-only, sorted-name-deterministic. Policy pass unchanged.

**Builds on:** dispatch 3 (name-identified nodes are what the pass pairs). **Hands to:** scenario C/D/I op mapping complete; expression indexes plannable via factory-authored contracts.

**Focus:** port `rls-rename-planner.test.ts` cases to indexes; byte-assert ops in target/adapter suites + `render-typescript` round-trips.

### 5 — Scenario acceptance and repo-wide convergence

**Outcome:** the slice-DoD list is proven: scenario I e2e (raw-SQL pre-slice database + re-emitted contract → renames-only widening plan → apply → verify clean), expression-index `migration plan` e2e, exact-mode adoption round-trip e2e (infer → emit → verify zero issues / plan zero ops on custom-named fields-only indexes), and full `test:integration` + `test:e2e` sweeps green (rename fallout hunted by grep, not luck). Any doc/rulecard touched by moved modules updated (`doc-maintenance` rule).

**Builds on:** dispatches 2–4 all feed the e2e journeys. **Hands to:** slice-DoD met; PR-open.

**Focus:** e2e journeys and the cross-tree sweep; no new mechanisms.

## Sizing notes

Five dispatches, each one outcome. Dispatch 2 is the largest by diff (fixture sweep) but mechanical past the lowering table; dispatch 3 is the deepest judgment (equivalence + introspection) and deliberately excludes planner work. Renames arrive only after identity exists (4 after 3), and identity only after names exist (3 after 2) — each joint is a stable, green, shippable state.
