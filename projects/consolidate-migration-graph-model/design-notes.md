# Design notes: consolidate the migration graph model

> Synthesized design for the migration-graph-model consolidation. Read this to understand **what the consolidated model is**, **what principles it serves**, and **what alternatives were rejected**. It captures the settled design, not a chronological decision log.
>
> Owned by the Orchestrator. Authored directly. Cross-linked from [`./spec.md`](./spec.md).

## Principles this design serves

- **There is no canonical history.** The migration set is a graph of `from → to` edges over contract hashes. No edge, node, or path is privileged as "the real history."
- **The graph has no structural guarantees.** It may have zero, one, or many roots; zero, one, or many tips; dangling parents (a `from` whose producer was pruned); and cycles (rollbacks). All of these are normal, not corruption.
- **Pruning is expected.** Users are encouraged to delete migrations that no longer serve. Any model that treats "missing genesis" or "missing ancestor" as an error is wrong by construction.
- **Init-anywhere.** A developer can stand up an environment at any contract state. Walking forward from the empty contract is one workflow among many, not *the* workflow.
- **Targeting is explicit.** "Which contract do I act on?" is an input (ref / marker / `--to` / `--from`), never an inference from graph shape.
- **One model.** Every command reasons about the graph through one module with one vocabulary, so behaviour is consistent and the golden-path assumption can't creep back in via a second code path.

## The model

### Entities and vocabulary

The graph itself — nodes are the contract hashes appearing as any edge's `from`/`to` (with `from: null` canonicalised to `EMPTY_CONTRACT_HASH`), edges are migrations — is produced by `reconstructGraph`, which stays as-is (it is already neutral). But **consumers never call `reconstructGraph` directly**: the graph is obtained from the `ContractSpaceAggregate` (see § Where the graph comes from). On top of the aggregate-provided graph the consolidated model defines, in one place, the tolerant vocabulary currently living only in `migration-list-graph-topology.ts`:

- **Root** — a node with forward-in-degree 0. There may be zero, one, or many. `EMPTY_CONTRACT_HASH` is *one possible* root, never assumed present.
- **Tip** — a node with forward-out-degree 0. There may be zero, one, or many. "The latest migration" is not a well-defined singular concept; "the set of tips" is.
- **Edge kind** — `forward` / `rollback` (DFS back-edge) / `self`, partitioned by a single deterministic 3-colour DFS with neighbour order pinned to `dirName`-descending, seeded from roots first then any unvisited remainder. This is exactly the tolerant classifier's algorithm.
- **Forward subgraph** — edges classified `forward`; reachability, root/tip degree, and convergence/divergence are all computed over this subgraph.
- **Dangling parent** — a `from` with no producing edge present (pruned ancestor). The model treats it as a root, not an error.

### Where the graph comes from: the `ContractSpaceAggregate`

The consolidated model is graph *reasoning*; it does **not** own graph *sourcing*. Sourcing already has a home: `ContractSpaceAggregate` (`aggregate/types.ts`, `aggregate/aggregate.ts`) is the tolerant, queryable snapshot of a project's on-disk migration state, built once per CLI invocation by `loadContractSpaceAggregate`. Each `ContractSpaceMember` exposes a memoised `graph()` that lazily calls `reconstructGraph(packages)` and caches it. The aggregate's documented contract is explicit: *"every consumer obtains spaces / packages / refs / graphs from this one value rather than re-deriving them from disk."*

So the consolidation has **two axes**, and the aggregate is load-bearing on both:

1. **Graph sourcing — always via the aggregate.** A consumer that needs a graph calls `member.graph()`. It never calls `reconstructGraph` itself and never re-reads the migrations directory. Most commands already comply (`migrate`, `status`, `show`, `new`, `migration-apply`, aggregate `graph-walk`, `planner`, `check-integrity`). Three surfaces still bypass it and re-derive from disk — `command-helpers.ts` (`loadMigrationPackages`), `compute-extension-space-apply-path.ts`, and `migration-check.ts` — and are migrated onto the aggregate as part of this work (see § Disposition).

2. **Graph reasoning — one model, ideally hung off the aggregate member.** The tolerant root/tip/edge-kind/reachability vocabulary is a small set of pure functions over a `MigrationGraph` in `migration-tools`. To make "one model, one place" literal (and to avoid every caller re-running a DFS), the recommended shape is to expose the derived topology as an additional **memoised facet on `ContractSpaceMember`** — e.g. `member.topology()` returning `{ roots, tips, edgeKinds, … }` — sitting beside the existing `graph()` / `contract()` facets. Whether the vocabulary ships as free functions, member facets, or both is a slice-1 model-surface decision; the invariant is that there is exactly one implementation and consumers reach it through the aggregate.

The payoff: "consolidate the graph model" and "stop re-deriving graphs from disk" become the *same* change. The aggregate is where the single model is anchored, so a second code path can't reintroduce the golden-path assumption — there is only one graph per space, built once, reasoned about one way.

> **Prerequisite — [TML-2716](https://linear.app/prisma-company/issue/TML-2716/adopt-contractspaceaggregate-in-migration-list-graph-log-delete-hand) lands first.** Today `migration list` / `list --graph` source from `enumerateMigrationSpaces` and the classifier consumes `MigrationListEntry[]`, not a `MigrationGraph`. TML-2716 (in flight) moves those views onto the aggregate, deleting the hand-rolled I/O. This project starts only after it lands, so the list views are already aggregate-backed when slice 1 founds the single model — see § Open questions (resolved).

### What targeting becomes

Targeting moves out of the graph and into explicit inputs:

| Question | Old (golden-path) answer | Consolidated answer |
|---|---|---|
| "Where does history start?" | `EMPTY_CONTRACT_HASH`, or throw `NO_INITIAL_MIGRATION` | There is no single start; roots are forward-in-degree-0 nodes |
| "What is the latest migration?" | `findLeaf` from `∅`; throw `AMBIGUOUS_TARGET` if >1 | There is no single latest; tips are forward-out-degree-0 nodes; the user names the target via ref/`--to` |
| "What's the planning origin?" | `markerHash ?? ∅` | The live marker, or an explicit `--from`; never a silent `∅` fallback that implies "start of history" |
| "What does the graph spine root at?" | hardcoded `∅` | the graph's actual roots |

The graph still answers **structural** questions — *is X reachable from Y?* (`findPath`/reachability over the forward subgraph), *what tips exist?*, *what are the edge kinds?*, *are there cycles?* (`detectCycles`, already neutral). It no longer answers **intent** questions ("which one did you mean?") — those are the user's to supply.

### Disposition of the existing surface

- **Keep, already neutral:** `reconstructGraph` (stays the aggregate's internal builder — not called by consumers), `findPath`, `findPathWithInvariants`, `findPathWithDecision`, `findReachableLeaves` (takes an explicit origin), `detectCycles`.
- **Refound or remove (golden-path semantics):** `findLeaf` (throws on missing `∅`, throws on >1 tip), `findLatestMigration` (walks `∅ → the leaf`), and the `NO_INITIAL_MIGRATION` / `AMBIGUOUS_TARGET` / `NO_TARGET` error paths. Replace "the tip" with "the set of tips"; replace the throws with actionable "name your target" errors at the command boundary.
- **Promote to canonical:** the tolerant classifier's root/tip/edge-kind vocabulary becomes the shared model API (free functions over `MigrationGraph`, and/or a memoised `member.topology()` facet on `ContractSpaceMember`), consumed by both the list views and the rest of the commands.
- **Route through the aggregate (stop re-deriving from disk):** three surfaces currently read the migrations directory and call `reconstructGraph` themselves, bypassing the aggregate's single-snapshot contract:
  - `cli/utils/command-helpers.ts` `loadMigrationPackages` (`readMigrationsDir` + `reconstructGraph`).
  - `migration-tools/compute-extension-space-apply-path.ts` (`readMigrationsDir` + `reconstructGraph`, then `findPathWithDecision`).
  - `cli/commands/migration-check.ts` (`reconstructGraph(bundles)`).

  Each is migrated to obtain its graph from the relevant `ContractSpaceMember.graph()`. Where a command genuinely runs before an aggregate exists (e.g. a pre-load health check), that is called out explicitly rather than left as an ad-hoc `reconstructGraph` call.
- **`isGraphNode`/`assertHashIsGraphNode`:** revisit the `EMPTY_CONTRACT_HASH`-is-always-a-node special-case — under init-anywhere, `∅` is only a node if an edge actually references it.

### Consumer migration shape

Read-only consumers (`status`, `log`, `graph`, `new`, `ref`, `plan-resolution`) move first: they replace `findPath(graph, ∅, …)` and `findLatestMigration` with explicit-origin reachability and ref/marker-based targeting. The planning/apply origin paths (`migrate`, aggregate `graph-walk`, `compute-extension-space-apply-path`) move last, since they carry the apply semantics and the marker-defaulting logic. The golden-path helpers are deleted only once no consumer references them.

## Alternatives considered

- **Make the strict path tolerant in place, leave two modules.** Patch `findLeaf` to not throw, leave `migration-graph.ts` and `migration-list-graph-topology.ts` as separate models. **Rejected because:** the whole problem is *two models with conflicting assumptions*. Patching one to limp along on partial graphs without unifying the vocabulary leaves the next contributor to rediscover which module to trust. The deliverable is one model.
- **Keep golden-path as the default; tolerate only when a flag is passed.** A `--tolerant` / `--allow-partial` escape hatch. **Rejected because:** it inverts the truth. Partial/multi-root/cyclic graphs are the *normal* case in this system, not an opt-in edge case. Per the explicit-opt-in rule, the footgun would be the *default* (golden-path), which is backwards.
- **Treat refs as a full DAG-history store (git-like reflog).** Make the system track canonical history out-of-band so "the tip" is always defined. **Rejected because:** it reintroduces canonical history through the back door, contradicting the core principle and the pruning workflow. Refs are *pointers the user maintains*, not an authoritative history.
- **Delete `migration graph` (dagre) instead of refounding its spine.** **Rejected because:** it is a shipped, separate drawing contract that answers "show me the whole topology"; it just needs its root model corrected, not removal.

## Open questions

All design-level forks are resolved (operator, 2026-05-30) and folded into § The model and § What targeting becomes above:

- **`findLeaf`/`findLatestMigration`:** deleted, not refounded. Tip discovery returns the set of tips.
- **Multiple tips:** no silent default; actionable "name your target" error listing tips + refs.
- **Targeting:** refs + marker + explicit `--to`/`--from` are the only inputs; graph shape is never a targeting oracle.
- **Dagre spine:** roots at actual forward-in-degree-0 nodes; hardcoded `∅` removed.

Residual implementation-level questions (the `∅` special-case in `isGraphNode`, the precise new error code/shape for the multi-tip case) are decided in the slice that touches them, not here.

**Resolved (operator, 2026-05-30) — the list-view / TML-2716 fork.** [TML-2716](https://linear.app/prisma-company/issue/TML-2716/adopt-contractspaceaggregate-in-migration-list-graph-log-delete-hand) (adopt the aggregate in `list` / `graph` / `log`, deleting hand-rolled I/O) is **in flight and lands before this project starts**. So by the time slice 1 begins, every migration view — including the list views — already sources from the `ContractSpaceAggregate`. The decision is therefore **option (1)**: found the canonical reasoning on the aggregate-provided `MigrationGraph`, and have the (now aggregate-backed) list views consume that one model. The transient-duplication risk of deferring is avoided because TML-2716 has already moved the list views onto the aggregate; reconciling the classifier's `MigrationListEntry[]` shape against the `MigrationGraph` it now derives from is a slice-1 implementation detail, not a coexisting second model. TML-2716 is recorded as a hard prerequisite (not folded into this project's scope) — see [`plan.md`](./plan.md) § Dependencies.

## References

- Project spec: [`./spec.md`](./spec.md)
- Project plan: [`./plan.md`](./plan.md) (authored by `drive-plan-project`)
- Rendering reference (model prototype): [`docs/reference/migration-list-graph-rendering.md`](../../docs/reference/migration-list-graph-rendering.md)
- Strict model under consolidation: `packages/1-framework/3-tooling/migration/src/migration-graph.ts`
- Tolerant model (canonical-to-be): `packages/1-framework/3-tooling/migration/src/migration-list-graph-topology.ts`
