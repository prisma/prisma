# Contract-free migration planning — Spec

**Linear:** [Contract-free migration planning](https://linear.app/prisma-company/project/contract-free-migration-planning-0608cf26e2ff) ([TML-3026](https://linear.app/prisma-company/issue/TML-3026)) · **Branch:** `tml-3026-contract-free-migration-planning`

## Purpose

Make the migration planner a pure function of two schema IRs. Today `plan()` still reads the contract for things the schema tree should already carry, and it orders operations with a hand-maintained integer table that conflates real dependencies with cosmetic grouping. This project finishes the one-differ thesis ([ADR 235](../../docs/architecture%20docs/adrs/ADR%20235%20-%20The%20schema%20differ%20walks%20two%20derived%20schema%20IRs.md)): the planner reads the expected and actual trees, and nothing else, and derives operation order from dependencies expressed *in* those trees.

## At a glance

A pgvector column needs the `vector` extension installed before the column can be created. Today that dependency is invisible — it lives inside a codec's plan-time hook that conjures `CREATE EXTENSION vector` as a side effect. Nothing in any schema declares the extension, and the planner reads `contract.storage.types` to discover it.

After this project, the extension is a first-class authored entity, and the dependency is data in the tree:

```prisma
// PSL — the extension is declared, like a model or an enum
extension vector {}

model Embedding {
  id  Int      @id
  vec Vector   // pg/vector@1 codec; its descriptor declares: requires [extension vector]
}
```

The Postgres derivation projects an `extension` node and an `Embedding` table node; the column node carries a resolved `dependsOn` edge to the extension node. When the extension is `managed`, the differ produces two `not-found` issues (extension, column), copies the edge onto the column's issue, and the planner topo-sorts: `CREATE EXTENSION vector` before the column. When it is `external` — the norm for extensions installed by a pack's shipped baseline migration, or by a platform — the plan assumes it present and creates nothing; the declaration still feeds `db verify` and the requirement check. Either way: no contract read, no integer rank, no codec consulted at plan time.

Using the `pg/vector` codec **without** declaring `extension vector` is a load-time error naming both ends — the same explicit-declaration rule roles already follow.

## The three strands

The project delivers one outcome through three interlocking pieces:

1. **Dependency-ordered planning.** Each schema node declares `dependsOn` — resolved references to the nodes that must exist before it. The differ mirrors those edges onto the issues it emits; the planner builds a DAG over issues and topo-sorts. This replaces `nodeIssueOrder` (the per-node-kind integer table in each target's `issue-planner.ts`).
2. **Codec-contributed operations ride the differ.** Postgres extensions and custom types become diff nodes populated by both derivations; `storageTypePlanCallStrategy` and its `planTypeOperations` hook are **deleted, not migrated** — the hook has zero implementers (none in-repo; the one known external extension, CipherStash, uses only `onFieldEvent`). The field-lifecycle planner ([ADR 213](../../docs/architecture%20docs/adrs/ADR%20213%20-%20Codec%20lifecycle%20hooks.md)) consumes the differ's column issues instead of running its own per-field contract diff, under two constraints: the SQL `FieldEventContext` shape is preserved (existing hooks — CipherStash's `add_search_config` emission — keep working after a mechanical re-feed), and each hook's emitted ops **anchor at their column issue's position in the dependency graph** (they land as a unit after the column and, transitively, after everything the column depends on). `native_enum` already made the nodes-not-hooks move; extensions and custom types follow its precedent.
3. **Extensions and custom types are declared entities; creation is governed by control policy.** An `extension` (and a codec-defined custom type) is declared in PSL/TS, emitted as a Postgres-pack contract entity, and derived to a diff node — so `db verify` checks it exists and codec requirements resolve against it. Whether the *planner creates it* is its control policy: **`external`** (the norm — installed by the extension pack's shipped baseline migration in its own contract space, per the pattern every real extension uses: pgvector, postgis, paradedb, and CipherStash's indivisible 7,650-line EQL bundle; the app plan assumes it present, and a `dependsOn` edge to it is satisfied cross-migration by the migration graph) or **`managed`** (the planner emits `CREATE EXTENSION` inline, viable only for the trivially-inlinable single-statement case). A codec declares which entities it requires; the framework validates the requirement generically either way.

Strand 1 is the mechanism; strand 2 is the load that justifies it (extension → type → column edges the integer buckets cannot express); strand 3 makes those edges declarable rather than implied.

## Locked decisions

These are settled at the system level; slice specs inherit them.

- **Control policy is authored state, read from storage.** A model carries a control policy; lowering mirrors it onto the storage table entity (redundant but unambiguous). The migration system decides based only on the contents of the contract's storage block. The expected-side schema node carries the resolved control policy, stamped at derivation (excluded from `isEqualTo`); the subject resolvers read the node, not `entityAt(contract.storage, …)`.
- **`defaultControlPolicy` is a planner parameter.** It is a policy input, not schema state, so it rides the plan options alongside `policy` and `ownership` — not the tree. This is what a live *extra* (no expected node) resolves its control from, and what the `external` safety floor ([ADR 224](../../docs/architecture%20docs/adrs/ADR%20224%20-%20Control%20Policy%20—%20framework-locked%20vocabulary%20and%20family-owned%20dispatch.md)) reads.
- **`dependsOn` is a node attribute, both sides, structural.** A node holds resolved references (a `(nodeKind, id)` chain from the root — the vocabulary the differ already keys siblings with, since ids are only unique per-kind among siblings) to nodes it needs. Both derivations stamp it structurally by the same target-agnostic rules (FK → its table, policy → its table, column → its required extension/type); the actual side never reads `pg_depend`. `isEqualTo` ignores it — a dependency change is always caused by a state change that already fires a difference.
- **A codec declares required entities as opaque coordinates.** A codec descriptor may declare `requires: [{ entityKind, entityName }]`. `entityKind` is an opaque string to the framework — `extension` is spelled only in the Postgres pack. Load validation is a generic coordinate-membership check ("codec X requires entity Y; the contract declares none") that names both ends; it knows nothing about Postgres.
- **`SchemaDiffIssue` carries `dependsOn` and drops `reason`.** The differ copies each in-diff node edge onto the issue as an issue-to-issue reference, reason-free — an edge is dropped when its target produced no issue (the dependency is satisfied by reality). `reason` is deleted: an issue is a create when `expected` is set and `actual` is not, a drop in the reverse case, an alter when both are set — presence is the single source of truth, and caching it as `reason` only invited drift.
- **The ordering law.** `A dependsOn B` means "A needs B to exist." On the way up (B created, or A altered) the op that brings B into existence precedes A's op; on the way down (both removed) the op removing A precedes B's. The edge never encodes direction — the planner derives it from presence. An edge fires only when both endpoints are in the diff, so "a column stops needing an extension that stays declared" produces no edge, an `external` prerequisite installed by an ancestor migration produces no edge (satisfied cross-migration), and a declared entity's lifecycle is driven by the contract, never by whether something still references it.
- **Codec-emitted ops anchor at their issue's graph position.** A field-lifecycle hook's ops are not diff nodes; they attach as a unit to the column issue that produced them and inherit its ordering — after the column's own op on the way up, before it on the way down. No hook op ever needs its own bucket or rank.
- **Generic at the vocabulary layer, family-owned at the context layer.** The differ, `DiffableNode`, `SchemaDiffIssue`, and `dependsOn` are framework-plane and name no family concept. The codec-lifecycle seam (`CodecControlHooks`, `FieldEventContext`) stays SQL-family-owned — "column" is family vocabulary the framework is banned from naming — and the reproducible cross-family recipe is: derive nodes → generic issues → the family adapts its own node issues into its own hook context. (ADR 224/236 precedent: framework locks the vocabulary, the family owns dispatch.)
- **Order is correct and deterministic, not byte-stable.** The planner's contract is that every dependency edge's op precedes its dependent, deterministically (a path-based tiebreak among independent ops). This is proven by a property test over a representative migration set, not by a byte-identical golden comparison — a byte comparison over-specifies the total order and churns on cosmetic change. The integer table is deleted, not demoted. Example migrations regenerate because output legitimately changed.
- **A dependency cycle is a bug.** The graph is a DAG by construction (every edge points from a dependent to its dependency; tables never depend on each other because FKs are their own nodes). A cycle is a derivation or authoring error — the topo-sort asserts acyclicity and throws, naming the cycle.

## Non-goals

- **Mongo on the differ architecture.** A follow-up project moves the Mongo family onto the generic tree-walk differ (and, when a Mongo codec first needs lifecycle hooks, replicates the family-owned hook seam). This project only guarantees the recipe is replicable — nothing it builds binds the mechanism to SQL beyond the family-owned context types.
- **Extension/type versioning.** Requirements are name-only; a codec requires that an entity *exist*, not that it be at some version. A version field on the authored entity, and version-constrained requirements, are a later concern.
- **`pg_depend` introspection.** The actual side derives dependencies by the same structural rules as the expected side; it does not read Postgres's dependency catalog. (Extensions are Postgres-specific, but the *mechanism* — nodes carry `dependsOn`, both sides derive it — is family-agnostic.)
- **Codec rotation.** Altering a column's codec id remains an ADR-213 non-goal; this project does not add it.
- **Cross-space codec operations.** Codec-emitted ops stay app-space-bound, as ADR 213 fixes them; making a codec op target another space is out of scope.

## Cross-cutting requirements

- **Framework interface change.** `SchemaDiffIssue` (in `packages/1-framework/1-core/framework-components/src/control/schema-diff.ts`) drops `reason` and gains `dependsOn`. Every consumer — `db verify`, the Postgres and SQLite planners, the Mongo planner, the migration runner's post-apply check — moves to presence-based discrimination. This is a mechanical sweep but touches the framework plane, so it lands before the strands that build on it.
- **Explicit declaration is a breaking change for every prerequisite-creating extension.** Once a codec's required entity must be declared, every extension whose codecs imply a database prerequisite — in-repo (pgvector, postgis, paradedb) and external (CipherStash) — must declare the entity (typically `external`, matching their shipped install migrations) and add `requires` to its codecs. The load diagnostic must name the exact entity to declare; `contract infer` generates declarations for existing databases; and the change ships with extension-author upgrade instructions (`record-upgrade-instructions`) covering both the declaration and the `onFieldEvent` re-feed — the roles playbook.
- **The three verticals stay green.** RLS policies/roles and native enums already ride the substrate this project extends; their behavior is unchanged, proven by their existing suites.

## Definition of Done

Inherits the team-DoD floor (`drive/calibration/dod.md`). Project-specific close conditions, each verifying a decision above:

- The SQL planner's `plan()` no longer takes a contract parameter: subject resolution, ownership DDL-schema mapping, and default-namespace resolution all read node state or the `defaultControlPolicy` parameter. `entityAt(contract.storage, …)` is grep-clean from the planner. *(strands 1–2, control decision)*
- An app declares `extension vector` in **both** PSL and TS; it emits to a Postgres-pack contract entity and derives to a diff node. Declared `managed`, a migration creates it (and drops it on removal); declared `external`, the plan emits nothing for it and `db verify` confirms it exists. Using a `requires`-bearing codec without the declaration is a load error naming the codec and the missing entity. *(strand 3)*
- A field-lifecycle hook authored against today's `FieldEventContext` (the CipherStash shape: per-flag ops off `prior/newField.typeParams`) produces identical ops when fed from the differ's column issues, and those ops execute after the column's own op and its transitive prerequisites. *(strand 2 constraints)*
- Operation order is produced by a dependency graph + topo-sort; `nodeIssueOrder` is deleted from both target issue-planners. A property test over a representative migration set asserts every dependency edge's op precedes its dependent, and that identical input yields byte-identical output. *(strand 1)*
- `SchemaDiffIssue` carries `dependsOn` and no `reason`; `db verify`, both SQL planners, the Mongo planner, and the runner consume the new shape; verify verdicts are unchanged. *(interface decision)*
- The pgvector/postgis examples and every existing migration fixture are regenerated to the graph's order and reviewed; the RLS and native-enum suites are green. *(cross-cutting)*
- The two ADRs below are authored and promoted at close-out.

## Contract-impact

- **New authored entity kinds** on the Postgres pack: `extension`, and a codec-defined custom-type entity (its relationship to the existing `native_enum` entity is an open question below). Authored through the pack block-descriptor / `entities` channels shipped by the RLS and native-enum work.
- **Codec descriptor** gains an optional `requires: Coordinate[]`. Additive; codecs without it are unaffected.
- `StorageTable`/`StorageColumn` already carry `control`; no contract-shape change there — the change is that the planner reads the *derived node's* copy instead of re-looking-up the entity.

## Adapter-impact

- **Postgres** (primary): extension/custom-type nodes, both derivations, the planner shedding its contract reads, and the dependency graph.
- **SQLite**: adopts the dependency graph and deletes its `nodeIssueOrder`; has no extensions, but shares the planner substrate and the `SchemaDiffIssue` interface change.
- **Mongo**: consumes the `SchemaDiffIssue` interface change only (drop `reason`, ignore `dependsOn`); no ordering-graph or codec-entity work.

## ADR pointer

Two durable decisions, authored at close-out:

1. **Contract-free planning and dependency-graph ordering** — extends [ADR 235](../../docs/architecture%20docs/adrs/ADR%20235%20-%20The%20schema%20differ%20walks%20two%20derived%20schema%20IRs.md); records `dependsOn` on nodes and issues, the ordering law, `reason`'s removal, and the deletion of the integer ranking.
2. **Codec-required entities; extensions and custom types as authored diff nodes** — the generic `requires` coordinate mechanism and the explicit-declaration rule.

## Open questions

Deferred to the slice that resolves them; none blocks project shaping.

- **Extension authoring syntax.** `extension X {}` block vs an attribute form; the TS helper shape. Settled in the authoring slice's spec, following the RLS/native-enum precedent.
- **Custom types vs native enums.** Whether a generic authored custom-type entity subsumes `native_enum`, or the two stay distinct kinds sharing the codec-required-entity mechanism.
- **`dependsOn` reference form.** The full root-chain `(nodeKind, id)[]` vs a lighter `(namespaceId, coordinate)` form — settled at the framework-interface slice, driven by what the planner needs to index issues.

## References

- [ADR 235 — The schema differ walks two derived schema IRs](../../docs/architecture%20docs/adrs/ADR%20235%20-%20The%20schema%20differ%20walks%20two%20derived%20schema%20IRs.md) — the substrate this project completes.
- [ADR 234 — Content-addressed wire names](../../docs/architecture%20docs/adrs/ADR%20234%20-%20Content-addressed%20wire%20names%20for%20Postgres-normalized%20objects.md), [ADR 236 — Target-contributed model attributes](../../docs/architecture%20docs/adrs/ADR%20236%20-%20Target-contributed%20model%20attributes.md) — the RLS/native-enum authoring precedents strand 3 follows.
- [ADR 224 — Control Policy](../../docs/architecture%20docs/adrs/ADR%20224%20-%20Control%20Policy%20—%20framework-locked%20vocabulary%20and%20family-owned%20dispatch.md) — the policy vocabulary the control decision preserves.
- [ADR 213 — Codec lifecycle hooks](../../docs/architecture%20docs/adrs/ADR%20213%20-%20Codec%20lifecycle%20hooks.md) — the field-lifecycle hook strand 2 rewires. (`planTypeOperations`, the type-lifecycle hook, is undocumented — this project's ADR 1 covers it.)
- [ADR 195 — Planner IR with two renderers](../../docs/architecture%20docs/adrs/ADR%20195%20-%20Planner%20IR%20with%20two%20renderers.md), [ADR 192 — ops.json is the migration contract](../../docs/architecture%20docs/adrs/ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md) — the planner output and its identity hash.
- [cipherstash/stack `packages/prisma-next`](https://github.com/cipherstash/stack/tree/main/packages/prisma-next) — the external extension used as the compatibility case throughout: vendored indivisible EQL bundle as a baseline migration (validates external-policy prerequisites), `onFieldEvent`-emitted per-column ops (validates issue-anchored hook ordering), zero `planTypeOperations` use (validates deleting the hook).
