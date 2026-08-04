# Consolidate the migration graph model

## Purpose

The migration graph logic was written assuming a single canonical linear history — one genesis at the empty contract, one well-defined tip, a "golden path" the system walks. Prisma Next does not work that way: there is no canonical history, the on-disk graph has no structural guarantees, users are encouraged to prune old migrations, and a developer can initialise an environment at whatever state they want. This project consolidates the scattered, golden-path-assuming graph code into one graph model that treats arbitrary, multi-rooted, prunable, possibly-cyclic graphs as the normal case — so every migration command reasons about the graph the same correct way.

## At a glance

Today there are effectively **two** migration-graph models in the tree, and they disagree about what a valid graph is.

The **strict model** (`migration-tools/migration-graph.ts`) assumes a golden path. Its tip-discovery helper hard-fails when the graph doesn't start at the empty contract, and treats more than one tip as an error to be resolved:

```ts
// migration-graph.ts — findLeaf()
if (!graph.nodes.has(EMPTY_CONTRACT_HASH)) {
  throw errorNoInitialMigration([...graph.nodes]);   // ← "history must start at ∅"
}
const leaves = findReachableLeaves(graph, EMPTY_CONTRACT_HASH);
if (leaves.length > 1) {
  throw errorAmbiguousTarget(/* ... */);              // ← ">1 tip is a problem"
}
```

Its callers inherit the assumption by defaulting every traversal origin to `∅`:

```ts
// status / log / graph-migration-mapper / aggregate graph-walk, paraphrased
const from = markerHash ?? EMPTY_CONTRACT_HASH;        // ← "no marker ⇒ start at genesis"
const path = findPath(graph, EMPTY_CONTRACT_HASH, target);
const rootId = EMPTY_CONTRACT_HASH;                    // hardcoded spine root
```

The **tolerant model** (`migration-tools/migration-list-graph-topology.ts`, shipped for `migration list --graph`) already does it right: roots are *any* forward-in-degree-0 nodes (zero, one, or many), `∅` is just one possible root, cycles are partitioned deterministically, and it never throws on a "malformed" graph because — under pruning and init-anywhere — there is no malformed graph.

The end state: **one** model, founded on the tolerant view, with targeting made **explicit** (refs / marker / `--to` / `--from`) rather than derived from a presumed-unique tip. "Which contract do I act on?" stops being a graph-shape inference and becomes an input the user or a ref supplies.

## Non-goals

- **Not** changing the on-disk migration package format, `refs/` format, or marker/ledger format. This is about in-memory graph reasoning, not storage.
- **Not** adding a new `migration apply` command or reworking apply execution. Apply runs through the control API (`migrate`, `db init`, `db update`); this project changes the *graph reasoning* those paths consume, not the apply mechanics.
- **Not** changing the tolerant `--graph` rendering contract (`docs/reference/migration-list-graph-rendering.md`). That view is the model we are generalising *from*; its output is fixed.
- **Not** building automated pruning, garbage-collection, or "forget old migrations" tooling. Pruning is a user activity we must *tolerate*, not a feature we ship here.
- **Not** introducing target/adapter-specific graph behaviour. The graph model stays target-agnostic (`.agents/rules/no-target-branches.mdc`).
- **Not** a rename-only pass. Deleting/refounding `findLeaf` et al. is in scope, but the deliverable is a coherent model, not cosmetic API churn.

## Place in the larger world

**Owning package.** `@internal/migration-tools` (`packages/1-framework/3-tooling/migration`) owns the graph model (`migration-graph.ts`, `graph.ts`, `graph-membership.ts`, `migration-list-graph-topology.ts`, `errors.ts`, `constants.ts`).

**Graph sourcing is the aggregate's job, not the consumer's.** `ContractSpaceAggregate` (`aggregate/types.ts`, `aggregate/aggregate.ts`) is the tolerant per-invocation snapshot of on-disk migration state; each member's `graph()` memoises `reconstructGraph(packages)`, and the aggregate's contract is that consumers get graphs *from it* rather than re-deriving them from disk. The consolidated reasoning model therefore operates on the aggregate-provided `MigrationGraph` (recommended: hung off the member as a memoised `topology()` facet beside `graph()`/`contract()`), and **no consumer calls `reconstructGraph` directly.** See [`design-notes.md`](./design-notes.md) § "Where the graph comes from".

**Consumers that bake in the golden-path assumption** (all in `packages/1-framework/3-tooling/cli`, plus aggregate strategies in migration-tools):

- `commands/migrate.ts` — `findLatestMigration` for marker-mismatch diagnostics; targeting via `--to` ref resolution.
- `commands/migration-status.ts` — multiple `findPath(graph, ∅, …)`; `findReachableLeaves(graph, ∅)`.
- `commands/migration-log.ts` — applied path is `findPath(graph, ∅, markerHash)`.
- `commands/migration-new.ts`, `commands/ref.ts`, `utils/plan-resolution.ts` — `findLatestMigration` for "the" graph tip.
- `utils/formatters/graph-migration-mapper.ts` — `migration graph` spine hardcodes `rootId = ∅`.
- `migration-tools/aggregate/strategies/graph-walk.ts` and `compute-extension-space-apply-path.ts` — origin defaults to `∅` when no marker.

**Consumers that bypass the aggregate and build their own graph** (the "wires its own logic" cases — re-read disk + call `reconstructGraph`): `utils/command-helpers.ts` (`loadMigrationPackages`), `compute-extension-space-apply-path.ts`, and `commands/migration-check.ts`. These are migrated to source their graph from the aggregate member.

**Prerequisite: TML-2716.** `migration list` / `list --graph` / `log` source from `enumerateMigrationSpaces`, not the aggregate; moving them is [TML-2716](https://linear.app/prisma-company/issue/TML-2716/adopt-contractspaceaggregate-in-migration-list-graph-log-delete-hand) (in flight). It lands before this project starts, so every view — including the classifier we generalise *from* — is already aggregate-backed when slice 1 founds the single model. This project does not begin until TML-2716 has merged.

**Sibling already-correct surface:** `migration list` / `migration list --graph` (tolerant classifier). This project promotes that view's model to be *the* model.

**Architectural shift ⇒ ADR.** Changing the migration-graph model from "single canonical history" to "arbitrary prunable multi-rooted graph + explicit targeting" is a durable architectural decision. The project commits to authoring an ADR (under `docs/architecture docs/adrs/`) and updating `docs/architecture docs/subsystems/7. Migration System.md` at close-out, with the rendering reference (`docs/reference/migration-list-graph-rendering.md`) cross-linked.

**Contract-impact:** none. The graph reasons over contract *hashes*; it does not read, emit, or change the contract surface (`packages/0-shared/contract/**`, framework-core).

**Adapter-impact:** none intended. The model is target-agnostic; apply continues to flow through the control API unchanged. Any adapter-visible change would be a scope violation to flag.

## Cross-cutting requirements

- **One model, one vocabulary.** After this project, there is a single graph-reasoning module with a single vocabulary for roots (forward-in-degree-0), tips (forward-out-degree-0), reachability, and edge-kind classification. The strict `findLeaf`/`findLatestMigration`/`NO_INITIAL_MIGRATION`/`AMBIGUOUS_TARGET` golden-path constructs are either deleted or refounded on the tolerant base — no surface still asserts "history starts at `∅`" or "there is exactly one tip."
- **Graphs come from the aggregate, never re-derived from disk.** Every consumer obtains its `MigrationGraph` (and the derived root/tip/edge-kind facts) from the `ContractSpaceAggregate` member, not by calling `reconstructGraph` or re-reading the migrations directory. `reconstructGraph` remains the aggregate's internal builder only. Any consumer that genuinely must run before an aggregate exists is documented as a named exception, not an ad-hoc rebuild.
- **Targeting is explicit, never inferred from graph shape.** Every command resolves "which contract do I act on" from a ref, the live marker, `--to`, or `--from` — not from a presumed-unique leaf. Where no target is supplied and none can be unambiguously defaulted, the command asks the user to name one (actionable error), rather than guessing or throwing a "your history is malformed" error.
- **No command treats a pruned / multi-root / cyclic graph as corruption.** Partial graphs (a `from` whose producing migration was pruned), multiple roots, multiple tips, and rollback cycles are all *normal*. Diagnostics phrased as "your migration history is broken" for these shapes are removed or reworded.
- **Every merged slice keeps the workspace green** (`pnpm typecheck`, `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint:deps`) and leaves the CLI behaviourally coherent — no slice may leave `migrate`/`status`/`log`/`graph` in a half-migrated state on `main`.
- **Behaviour parity on the golden-path case.** For the common, well-formed `∅ → … → single-tip` graph, user-visible output of every touched command is unchanged (the new model must reduce to the old answers on the inputs the old model handled).

## Transitional-shape constraints

- Slices land in **consumer-safe order**: introduce the consolidated model alongside the existing helpers, migrate consumers onto it, then delete the golden-path helpers last. No slice deletes `findLeaf`/`findLatestMigration` while a consumer still calls them.
- Each slice is a coherent, independently reviewable PR that keeps `main` green (no breaking intermediate state across the `migration-tools` → CLI boundary).
- If the consolidated model changes any user-facing error code or message (e.g. retiring `NO_INITIAL_MIGRATION` / `AMBIGUOUS_TARGET`), the slice that does so updates the corresponding tests and any docs in the same PR.

## Project Definition of Done

Inherits the team-DoD floor ([`drive/calibration/dod.md`](../../drive/calibration/dod.md)) — not restated. Project-specific conditions:

- [ ] A single graph-reasoning surface in `migration-tools` is the only model the migration commands consume; no second model with conflicting "valid graph" assumptions remains.
- [ ] `findLeaf`, `findLatestMigration`, and the `NO_INITIAL_MIGRATION` / `AMBIGUOUS_TARGET` golden-path error paths are either removed or demonstrably refounded so they no longer assume a `∅` genesis or a unique tip. A repo grep shows no surface defaulting a traversal origin to `EMPTY_CONTRACT_HASH` as a stand-in for "the start of history."
- [ ] No consumer calls `reconstructGraph` directly: a repo grep finds `reconstructGraph` only as the aggregate's internal builder (and tests). The three current bypassers (`command-helpers.ts` `loadMigrationPackages`, `compute-extension-space-apply-path.ts`, `migration-check.ts`) source their graph from the aggregate, or are documented as named pre-aggregate exceptions.
- [ ] `migrate`, `migration status`, `migration log`, `migration graph`, `migration new`, `ref`, and `plan-resolution` resolve their target/origin explicitly and behave correctly on at least: a pruned-root graph, a multi-tip graph, and a rollback-cycle graph — each pinned by a test.
- [ ] Golden-path inputs produce byte-identical user-visible output to pre-project behaviour (regression-pinned).
- [ ] An ADR records the model change; `docs/architecture docs/subsystems/7. Migration System.md` reflects it; the rendering reference is cross-linked. (Migrated into `docs/` at close-out.)

## Settled design decisions

The initial design forks were resolved with the operator (2026-05-30); recorded here so the plan and slices inherit them:

1. **Delete the golden-path helpers.** `findLeaf` / `findLatestMigration` and their golden-path semantics (the `∅`-required throw, the single-tip throw) are removed — not refounded as wrappers. Tip discovery returns the *set* of tips; "the latest" is no longer a graph-derived concept.
2. **No silent default on multiple tips.** When a command gets no explicit target and the graph has more than one tip, it emits an actionable error listing the tips and the refs pointing at them, directing the user to pass `--to <ref|hash>`. This retires `AMBIGUOUS_TARGET`'s "your history diverged" framing.
3. **Refs + marker + explicit `--to`/`--from` are the *only* targeting inputs.** Graph shape is never a targeting oracle. This is the load-bearing decision that makes "no canonical history" hold end-to-end.
4. **The `migration graph` dagre spine roots at the graph's actual roots** (forward-in-degree-0 nodes), drawing multiple roots when present, mirroring the tolerant classifier. The hardcoded `rootId = ∅` is removed.
5. **Slice decomposition is the planner's call** (operator deferred). Working shape for `drive-plan-project`: model consolidation in `migration-tools` → read-only consumer migration → planning/apply origin migration + golden-path helper deletion.

## Open Questions

_None at the design level._ The list-view / [TML-2716](https://linear.app/prisma-company/issue/TML-2716/adopt-contractspaceaggregate-in-migration-list-graph-log-delete-hand) sequencing fork is resolved: TML-2716 (adopt the aggregate in `list` / `graph` / `log`) is in flight and **lands before this project starts**, so the list views are already aggregate-backed when slice 1 founds the single model on the aggregate-provided `MigrationGraph`. TML-2716 is a hard prerequisite, not in-scope here — see [`plan.md`](./plan.md) § Dependencies and [`design-notes.md`](./design-notes.md) § Open questions.

The earlier design forks (delete golden-path helpers; no silent multi-tip default; explicit targeting; dagre roots at actual roots) are resolved — see § Settled design decisions. Residual implementation-level questions (exact disposition of `isGraphNode`'s `∅` special-case, precise new error code/shape for the multi-tip case) are settled in the slice that touches them.

## References

- Linear Project: [Consolidate the migration graph model](https://linear.app/prisma-company/project/consolidate-the-migration-graph-model-0c0b3177de35) — umbrella ticket [TML-2739](https://linear.app/prisma-company/issue/TML-2739/consolidate-the-migration-graph-model-drop-golden-path-assumption); slices TML-2740 / TML-2741 / TML-2742
- Rendering reference (the model we generalise from): [`docs/reference/migration-list-graph-rendering.md`](../../docs/reference/migration-list-graph-rendering.md)
- Subsystem doc to update at close-out: [`docs/architecture docs/subsystems/7. Migration System.md`](../../docs/architecture%20docs/subsystems/7.%20Migration%20System.md)
- Tolerant model (prototype): `packages/1-framework/3-tooling/migration/src/migration-list-graph-topology.ts`
- Strict model (to consolidate): `packages/1-framework/3-tooling/migration/src/migration-graph.ts`, `graph.ts`, `graph-membership.ts`, `errors.ts`
- Design notes: [`./design-notes.md`](./design-notes.md)
