# Slice 1 — plan (dispatch decomposition)

Three dispatches, each leaving the tree **compiling and green**. One implementer (sonnet) resumed across all three; one reviewer (opus) after each. Rationale in `wip/unattended-decisions.md`.

## D1 — add `dependsOn`, differ mirrors it, stamp at derivations (additive, green, zero behavior change)

**Outcome:** `DiffableNode` and `SchemaDiffIssue` gain an optional `dependsOn` (a `readonly SchemaNodeRef[]`, where `SchemaNodeRef = readonly { nodeKind: string; id: string }[]` — the root-anchored chain the differ keys siblings with). The differ copies each in-diff node's `dependsOn` onto the issue it emits, dropping any ref whose target produced no issue. Both derivations stamp `dependsOn` for the edges whose target node already exists in the tree: **foreign key → its referenced table** (from `SqlForeignKeyIR.referencedTable` / `resolvedReferencedNamespace`), and **policy → its table and roles** (from `PostgresPolicySchemaNode.tableName` / `roles`). `isEqualTo` ignores `dependsOn`. Nothing consumes the field yet; `reason` and `nodeIssueOrder` are untouched.

**Files in play:** `framework-components/src/control/schema-diff.ts` (interface + the 3 emission sites); the two derivations (`contract-to-postgres-database-schema-node.ts`, family `contract-to-schema-ir.ts`, the two control-adapters' introspect paths); the node classes that gain the field (`SqlForeignKeyIR`, `PostgresPolicySchemaNode`). **Out of scope:** column→extension/custom-type edges — the entity coordinate is discarded at derivation today (grounding surprise #3); that new resolution path is slice 2's, when the extension node exists.

**Gate:** build · typecheck --force · `test:packages` for framework-components + target-postgres + target-sqlite · `lint:deps`. Behavior-neutral, so `fixtures:check` clean and no example regen.

## D2 — graph replaces the integer table (green; output order may change)

**Outcome:** both issue-planners (`postgres/…/issue-planner.ts`, `sqlite/…/issue-planner.ts`) build a DAG over issues — containment edges from path prefixes, `dependsOn` cross-links — and topologically sort under the ordering law (up: dependency's op first; down: dependent's op first; direction from `expected`/`actual` presence), deterministic path tiebreak, assert acyclicity. `nodeIssueOrder` + its `.sort()` comparator are **deleted** from both files (and the two `node-issue-planner` / `issue-planner` tests updated). The ordering property test lands (create-from-empty, drop-all, mixed alter, cross-table FK pair, policy+role). `reason` still present (per-kind mappers still read it — untouched here).

**Files in play:** the two issue-planners + their tests; a new shared topo-sort helper if the two would otherwise duplicate it (prefer one helper in a shared SQL location); the ordering property test; regenerated example/fixture migrations whose order changed.

**Gate:** build · typecheck --force · `test:packages` (both targets) · `test:integration` · `fixtures:check` · the ordering property test · `pnpm migrations:regen:examples` (or the repo's equivalent) then review the diff.

## D3 — drop `reason`, migrate consumers to presence, amend ADR 235 (green; mechanical sweep)

**Outcome:** `reason` removed from `SchemaDiffIssue`; `ExpectationFailureReason` deleted. Every consumer discriminates on presence (create = `expected` only, drop = `actual` only, alter = both). The grounding map's site list is authoritative — mechanical at every site **except** `cli/…/formatters/errors.ts` (replace the `issue.reason` label read with a presence→`"missing"|"extra"|"mismatch"` derivation) and the Mongo **producer** `2-mongo-family/9-family/src/core/schema-diff.ts` (remove `reason:` from its 9 emitted literals). ADR 235 amended (its interface listing + worked example show `reason` / no `dependsOn`). Full test sweep across the grounding map's file list, incl. `test/integration` + `test/e2e`.

**Files in play:** every `.reason` consumer + producer from the grounding map (both planners' per-kind mappers, `retainUnownedExtras`, `coalesceSubtreeIssues`, SQL-family `schema-verify.ts`, `verifier-disposition.ts`, Mongo `schema-diff.ts` + disposition + `scope-verify-result.ts`, aggregate `unclaimed-elements.ts`, `formatters/verify.ts` + `errors.ts`); the test-fixture builders (`sqlite/…/node-issue-helpers.ts` `issue()` + Postgres ad-hoc literals); ADR 235.

**Gate:** the full slice validation gate (spec § Validation gate) — build, forced typecheck, lint set incl. `lint:framework-vocabulary` + `lint:casts`, `fixtures:check`, all three suites, the property test, and grep-clean for `\.reason` (on issues) + `ExpectationFailureReason` + `nodeIssueOrder`.

## Close (after D3 SATISFIED)

Slice DoD = spec ACs 1–7. Open the PR (`create-pr` skill), rebase-verify base, then merge via the queue. Hands `dependsOn`-carrying nodes/issues + the graph to slices 2 and 3.
