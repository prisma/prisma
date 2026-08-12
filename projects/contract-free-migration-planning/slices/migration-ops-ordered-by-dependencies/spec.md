# Slice 1 — migration ops ordered by dependencies

**Project:** [`../../spec.md`](../../spec.md) (locked decisions govern) · **Linear:** [TML-3028](https://linear.app/prisma-company/issue/TML-3028) · **Branch:** `tml-3026-contract-free-migration-planning` (this slice is the project's first; later slices branch from its merge).

## Outcome

A developer can rely on migration operation order being **derived from dependencies declared in the schema trees**, not from a hand-maintained per-node-kind rank table. This slice also carries the framework interface change (`SchemaDiffIssue` drops `reason`, gains `dependsOn`; `DiffableNode` gains `dependsOn`) that slices 2 and 3 build on — it lands here rather than standing alone because presence-based discrimination is only provably complete once the graph consumes the new field.

## Acceptance criteria

Each is binary and verifiable at PR-merge time.

1. **`reason` is gone.** `SchemaDiffIssue` has no `reason` field; `ExpectationFailureReason` is deleted. Every consumer discriminates on presence of `expected` / `actual` (create = expected-only, drop = actual-only, alter = both). Grep for `\.reason` on issue values and for `ExpectationFailureReason` is clean across `packages/**` and `test/**`.
2. **Nodes and issues carry `dependsOn`.** `DiffableNode` and `SchemaDiffIssue` each expose `dependsOn` (a resolved reference to the node(s) an entity requires, as the root-anchored `(nodeKind, id)` chain the differ already keys siblings with). Both derivations — project-from-contract and project-from-database, Postgres and SQLite — stamp it structurally by target-agnostic rules (foreign key → its referenced table; policy → its table; and any node whose identity already carries a referenced-entity coordinate). `isEqualTo` ignores `dependsOn`.
3. **The differ mirrors edges onto issues.** `diffSchemas` copies each in-diff node's `dependsOn` onto the issue it emits, as an issue-to-issue reference; an edge whose target produced no issue is dropped (satisfied by reality). The differ reads `dependsOn` structurally and never interprets direction.
4. **The planner orders by graph, not by rank.** Both target issue-planners build a DAG over issues (containment edges from path prefixes + `dependsOn` cross-links), topologically sort under the ordering law (up — dependency's op first; down — dependent's op first; direction from `expected`/`actual` presence), break ties deterministically by path, and assert acyclicity (a cycle throws, naming it). `nodeIssueOrder` and its `.sort()` comparator are deleted from both the Postgres and SQLite issue-planners.
5. **Ordering is proven by invariant, not bytes.** A property test over a representative migration set (create-from-empty, drop-all, mixed alter, a cross-table FK pair, a policy+role case) asserts: for every dependency edge, the dependency's op precedes its dependent's on the way up and follows it on the way down; and that identical input yields byte-identical output (determinism). No byte-golden comparison against a frozen blob gates this slice.
6. **Nothing else moves.** `db verify` verdicts and output are unchanged (it consumed `reason` only for presentation — now presence). All three test suites pass. Example/fixture migrations that change order are regenerated and the diff is reviewed as intended output change.
7. **The ADR matches the code.** [ADR 235](../../../docs/architecture%20docs/adrs/ADR%20235%20-%20The%20schema%20differ%20walks%20two%20derived%20schema%20IRs.md) is amended in this PR: its `DiffableNode` / `SchemaDiffIssue` listings and worked example show `reason` and no `dependsOn`; update them to the shipped shape.

## Edge cases the tests must pin

- **Mutual foreign keys** (`A.fk → B`, `B.fk → A`) stay acyclic because FK nodes depend on tables, and tables depend on nothing — no table→table edge. Both tables create first, both FKs after.
- **Alter needing a new prerequisite** (a column altered to a type requiring a not-yet-present entity) orders the prerequisite's create before the alter (up rule; the alter issue has both `expected` and `actual`).
- **Drop ordering reverses** — dropping both a dependent and its dependency drops the dependent first.
- **Edge to a non-diffed node is inert** — a create whose dependency already exists (equal on both sides, no issue) produces no ordering constraint.
- **Determinism under independent ops** — two unrelated `CREATE TABLE`s come out in a stable, path-sorted order every run.

## Non-goals (this slice)

- No new authored entity kinds (extensions/custom types are slice 2).
- No removal of the planner's contract parameter (slice 3). `dependsOn` for a column→extension edge is exercised only where such a node already exists; the extension node itself arrives in slice 2.
- Mongo gains the interface change (drop `reason`, ignore `dependsOn`) only — no ordering graph.

## Validation gate

`pnpm build` · forced `pnpm typecheck` · `pnpm lint:deps` + `lint:code` + `lint:framework-vocabulary` + `lint:casts` (delta ≤ 0) · `pnpm fixtures:check` · `pnpm test:packages` + `test:integration` + `test:e2e` · the new ordering property test · grep-clean for `\.reason` (on issues) and `nodeIssueOrder` across `packages/**` + `test/**`.

## Adapter-impact

- **Framework:** `schema-diff.ts` (`SchemaDiffIssue`, `DiffableNode`, `diffSchemas`).
- **Postgres + SQLite:** both derivations stamp `dependsOn`; both issue-planners swap `nodeIssueOrder` for the graph.
- **Mongo:** interface change only.
