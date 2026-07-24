# functional-indexes — Plan

**Spec:** [spec.md](spec.md) · **Linear:** ticket TBD (operator creates; do not create unprompted)

Each slice is named for what a developer can **rely on** when it merges. Slice numbering starts after the external dependency. The spec's scenario letters (A–J) and design decisions (D1–D10) are the vocabulary; every slice DoD points at them.

## Dependency (not ours to build here)

| # | Slice | Where | Status |
| --- | --- | --- | --- |
| 0 | `unify-unique-and-index-nodes` (postgres-rls 2.6) — reconciliation pass deleted; unique constraints and indexes settled as **two** structural nodes (not the merged shape this plan originally assumed — see spec § Dependencies) | [#947](https://github.com/prisma/prisma-next/pull/947) | ✅ merged 2026-07-10 |

## Slices

| # | Slice | Delivers | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | `indexes-are-name-identified` | Every index node (declared and FK-backing, unique indexes included; unique *constraints* stay tuple-identified — spec D5) is name-identified with managed wire names; introspection is full-fidelity (expression/partial capture, skip+dedup hacks deleted); planner renders expression DDL; both rename-pairing phases work; existing databases converge via renames (scenario I). No new authoring surface yet. | 0 | ⬜ |
| 2 | `expression-index-authoring` | Ciphers can author their index: `@@index` expression/where/unique/name/map matrix in PSL + TS with exact diagnostics and the D9 warning; DoD-1 e2e green (scenarios B, D, E, G, H, J). | 1 | ⬜ |
| 3 | `rls-exact-names` | Policies adoptable: `@@map` on policy blocks, optional `prefix`, exact-policy content comparison, policy content-pairing rename (scenarios C, F for policies). TS policy authoring does not exist; its `map` lands with that future work (spec § Dependencies). | 1 | ⬜ |
| 4 | `infer-round-trip` | `contract infer` emits policies, `@@rls`, and full-fidelity indexes with managed re-detection; sign-the-database e2e (DoD-2), transition e2e (DoD-3), upgrade e2e (DoD-4) all green. | 2, 3 | ⬜ |

## Slice boundaries (what goes where)

### 1 — `indexes-are-name-identified`

The identity switch, done entirely beneath the authoring surface (existing `@@index([fields])` / `constraints.index(fields)` inputs are unchanged for users; their lowering now produces wire names).

- D4: `@prisma-next/sql-schema-ir/naming` gains `formatWireName` / `parseWireName` / `normalizeSqlBody` / `computeIndexContentHash`; the RLS `wire-name.ts` module is deleted and its call sites updated; `canonicalize.ts` imports `normalizeSqlBody`.
- D1: contract `Index` reshape (name required, `prefix`, `expression`, `where`, `unique`) + canonicalization/serializer/`contract.d.ts`; existing lowerings compute default-prefix wire names. Fixtures and example contracts re-emitted (storage hashes move — one sweep, this slice).
- D5: `SqlIndexIR` reshape — id = name, equivalence matrix, dependsOn rules (incl. the all-columns over-approximation for expression nodes).
- D6: Postgres introspection rewrite (per-position `pg_get_indexdef`, `pg_get_expr(indpred)`, hacks deleted, prefix stamping); SQLite adapter name-keying.
- D7: `mapIndexNodeIssue` name handling, `CreateIndexCall` elements union + `where`/`unique` rendering, `RenameIndexCall` + op, rename post-pass phases 1 and 2 for indexes.
- Tests: scenario I upgrade fixture (old-scheme database → renames-only plan); scenario J twins; byte-exact op assertions per the repo's planner-op discipline (target/adapter suites + `migration plan` e2e, NOT `fixtures:check` — see the recurring-trap note in the postgres-rls handoff).

### 2 — `expression-index-authoring`

- D3 for `@@index`/`constraints.index`: parameter matrix, three PSL diagnostics, TS overloads with lowering-time enforcement, PSL/TS parity test (`@@unique`/`constraints.unique` unchanged — spec D3).
- D9 warning with the exact spec wording.
- DoD-1 ciphers e2e (PSL and TS variants); scenario-row tests B, D, E, G, H.

### 3 — `rls-exact-names`

- D1 (policy half): optional `prefix` on `PostgresRlsPolicy` + `PostgresPolicySchemaNode`.
- D3 (policy half): `@@map` block attribute on the five `policy_*` blocks. (No TS half — TS policy authoring was never built; spec § Dependencies.)
- D5 (policy half): exact-policy `isEqualTo`.
- D7 (policy half): content-pairing phase 2 added to the existing policy rename pass.
- D9 warning for policies. Scenario tests C and F, policy edition.

### 4 — `infer-round-trip`

- D8 in full: index managed re-detection (recompute-and-match), `map:` fallback, policy block emission (head sanitization + dedup, `@@map` always, verbatim bodies), `@@rls` emission.
- Slice-1 carry-over (dispatch-3 review): the authoring-time duplicate-content index guard (`validateStorageSemantics`) rejects byte-identical twins under different names. Legal in Postgres, so a database carrying them must still be signable — key the guard by name for exact-mode indexes (or equivalent) when infer starts emitting them.
- Slice-1 carry-over: infer currently skips expression-carrying AND `where`-carrying index nodes (self-consistency — no authoring surface could hold the bodies); both skip sites are comment-marked for this slice. The Supabase reference contract re-adopts its partial indexes here.
- DoD-2 sign-the-database e2e, DoD-3 transition e2e, DoD-4 upgrade e2e; scenario A coverage completes the A–J matrix (DoD-5 sweep test list checked off here).
- Release-notes draft for the breaking change + upgrade instructions (per the `record-upgrade-instructions` skill).

## Close-out (required)

- [ ] All DoD items in [spec.md](spec.md) verified.
- [ ] ADR migrated from [specs/adr-name-identified-indexes.md](specs/adr-name-identified-indexes.md) to `docs/architecture docs/adrs/` (next free number at merge time), ADR 234's forward-applicability section updated to point at it.
- [ ] `docs/` references updated; repo-wide references to `projects/functional-indexes/**` stripped.
- [ ] `projects/functional-indexes/` deleted in the final PR.
