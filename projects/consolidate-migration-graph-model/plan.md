# Consolidate the migration graph model — Plan

**Spec:** `projects/consolidate-migration-graph-model/spec.md`
**Linear Project:** [Consolidate the migration graph model](https://linear.app/prisma-company/project/consolidate-the-migration-graph-model-0c0b3177de35) — umbrella [TML-2739](https://linear.app/prisma-company/issue/TML-2739/consolidate-the-migration-graph-model-drop-golden-path-assumption)

## At a glance

Three slices delivered as a **stack** (1 → 2 → 3). Slice 1 builds the consolidated tolerant model in `migration-tools`; slice 2 migrates the read-only commands onto it; slice 3 migrates the plan/apply origin paths and deletes the golden-path helpers once they have no callers left. The stack is forced by one join: the helper deletion can't land until every consumer is migrated.

## Composition

### Stack (deliver in order)

1. **Slice `migration-graph-model-core`** — Linear: [TML-2740](https://linear.app/prisma-company/issue/TML-2740/migration-graph-model-tolerant-multi-rootmulti-tipcycle-core)
   - **Outcome:** `@internal/migration-tools` exposes one graph-reasoning surface with the tolerant vocabulary — roots = forward-in-degree-0 nodes (zero/one/many), tips = forward-out-degree-0 nodes (zero/one/many), edge-kind = forward/rollback/self via the deterministic 3-colour DFS, reachability over the forward subgraph — promoted from the shipped `migration-list-graph-topology.ts` classifier. The vocabulary operates on the `MigrationGraph` the `ContractSpaceAggregate` already provides (recommended: a memoised `member.topology()` facet beside `graph()`/`contract()`), so there is one implementation reachable through the aggregate. Multi-root, multi-tip, dangling-parent, and cycle inputs are handled and unit-tested. No `∅`-genesis assumption anywhere in the new surface.
   - **Builds on:** [TML-2716](https://linear.app/prisma-company/issue/TML-2716/adopt-contractspaceaggregate-in-migration-list-graph-log-delete-hand) (prerequisite — every view, incl. the list classifier, is on the aggregate before this slice starts) plus the shipped tolerant classifier it generalises.
   - **Hands to:** The consolidated model API (root/tip/edge-kind/reachability) that slices 2 and 3 consume. The golden-path helpers (`findLeaf`/`findLatestMigration`) still exist, untouched, so no consumer breaks.
   - **Focus:** Model + tests in `migration-tools` (`migration-graph.ts`, `migration-list-graph-topology.ts`, `graph.ts`, `graph-membership.ts`), plus the aggregate-member facet placement (`aggregate/types.ts`, `aggregate/aggregate.ts`). No CLI consumer changes. Decide the `isGraphNode` `∅` special-case disposition and the model-surface shape (free functions vs member facet) here.

2. **Slice `migrate-read-only-consumers`** — Linear: [TML-2741](https://linear.app/prisma-company/issue/TML-2741/migrate-read-only-migration-commands-onto-the-consolidated-graph-model)
   - **Outcome:** `migration status`, `migration log`, `migration graph` (dagre spine), `migration new`, `ref`, and `plan-resolution` reason about the graph via the consolidated model — explicit-origin reachability instead of `findPath(graph, ∅, …)`; the dagre spine roots at the graph's actual roots instead of hardcoded `rootId = ∅`; tip lookups go through the new tolerant helper. Byte-identical output on golden-path inputs; correct on pruned/multi-root/multi-tip graphs (each pinned by a test).
   - **Builds on:** Slice 1's model API.
   - **Hands to:** A migrated read-only consumer set and the explicit-targeting precedent (how a command resolves origin/target from marker/ref without graph-shape inference) that slice 3's plan/apply paths follow. After this slice the golden-path helpers are referenced **only** by the plan/apply paths.
   - **Focus:** Read-only CLI surfaces only (`migration-status.ts`, `migration-log.ts`, `graph-migration-mapper.ts`, `migration-new.ts`, `ref.ts`, `plan-resolution.ts`). Also route the read-only graph bypassers onto the aggregate: `migration-check.ts` (drop its direct `reconstructGraph`) and `command-helpers.ts` `loadMigrationPackages` (callers obtain the graph from the aggregate member; final placement follows its caller set). The plan/apply origin paths and the helper deletion are slice 3.

3. **Slice `migrate-plan-apply-and-delete-helpers`** — Linear: [TML-2742](https://linear.app/prisma-company/issue/TML-2742/migrate-planapply-origin-delete-golden-path-graph-helpers)
   - **Outcome:** `migrate`, aggregate `graph-walk`, and `compute-extension-space-apply-path` resolve origin/target explicitly (live marker, `--to`, `--from`) with no silent `∅` fallback standing in for "the start of history"; a multi-tip situation with no explicit target produces an actionable error listing the tips and the refs pointing at them (retiring `AMBIGUOUS_TARGET`'s "your history diverged" framing). `findLeaf`, `findLatestMigration`, and the `NO_INITIAL_MIGRATION` / `AMBIGUOUS_TARGET` error paths are deleted. One model remains; a repo grep finds no surface defaulting a traversal origin to `EMPTY_CONTRACT_HASH` as "the start of history."
   - **Builds on:** Slice 1 (model) **and** Slice 2 (read-only consumers migrated, so the golden-path helpers have no remaining callers and can be deleted safely).
   - **Hands to:** Project close-out — the ADR + subsystem-doc update.
   - **Focus:** Plan/apply consumers (`migrate.ts`, `aggregate/strategies/graph-walk.ts`, `compute-extension-space-apply-path.ts` — including dropping the latter's direct `readMigrationsDir` + `reconstructGraph` in favour of the aggregate member), the new multi-tip error, and the deletion. Storage formats and apply mechanics are out of scope.

## Dependencies (external)

- [x] Shipped tolerant classifier (`migration-list-graph-topology.ts`) — merged; this is the model slice 1 generalises.
- [ ] **Hard prerequisite — [TML-2716](https://linear.app/prisma-company/issue/TML-2716/adopt-contractspaceaggregate-in-migration-list-graph-log-delete-hand) (adopt aggregate in list/graph/log).** In flight; lands before this project starts. Once merged, every migration view — including the list classifier this model generalises from — sources from the aggregate, so slice 1 founds the single model on the aggregate-provided `MigrationGraph` with no coexisting second model. This project does not begin until TML-2716 has merged.

## Sequencing rationale

The dependency graph is **not** permissive enough to parallelise, despite slices 2 and 3 touching disjoint consumer files. The forcing constraint is the golden-path helper **deletion** in slice 3: it is only safe once *every* consumer — read-only (slice 2) and plan/apply (slice 3) — no longer calls the helpers. Splitting the deletion into its own trailing micro-slice was considered and rejected (a deletion-only slice is too thin to carry its own review, and `≤4` slices is the target). So slice 3 owns both the last consumer migration and the deletion, which forces 2 → 3. Slice 1 → 2 is a hard model-then-consumer dependency.

Transitional-shape constraint honoured: the consolidated model lands **alongside** the existing helpers (slice 1), consumers migrate (slices 2–3), helpers delete last (slice 3) — so `main` stays green and behaviourally coherent across every merge.

## Close-out (required)

- [ ] Verify all acceptance criteria in `projects/consolidate-migration-graph-model/spec.md`.
- [ ] Author the ADR (model change: golden-path → tolerant multi-rooted graph + explicit targeting) under `docs/architecture docs/adrs/`; surface the number to the operator before assigning.
- [ ] Update `docs/architecture docs/subsystems/7. Migration System.md` to reflect the consolidated model; cross-link `docs/reference/migration-list-graph-rendering.md`.
- [ ] Migrate long-lived design notes into `docs/`; strip repo-wide references to `projects/consolidate-migration-graph-model/**`.
- [ ] Delete `projects/consolidate-migration-graph-model/`.
