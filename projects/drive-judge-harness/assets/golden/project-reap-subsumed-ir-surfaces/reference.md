# Reference output — project-reap-subsumed-ir-surfaces

The known-good resolution that shipped for this brief. This is the **reference**, not a
required reproduction: a correct run need not be byte-identical, but it should reach the same
end state — the subsumed helpers deleted, family knowledge in the family packs, hashes
unchanged.

## Source of truth

- Linear: **TML-2727** ("S1.D — Reap subsumed surfaces"), a phase within the larger
  `contract-ir-planes` / "Target-Extensible IR + Namespaces" project.
- PRs (three parallel, disjoint slices):
  - **#630** — `delete storage namespace construction shims` — merge
    `22e3dd1d7bfce2053f7e8948e3509b20fe64c173`
  - **#631** — `move SQL/Mongo canonicalizer hooks to family packs` — merge
    `a91c750492acc4c69f0df10649dece5f26b38a42`
  - **#629** — `migrate migration aggregate to elementCoordinates` — merge
    `c37feca2e34485f3a0209fae242c91b131f48e91`
- Base SHA: `ab6eaaaa52a51afa9743858f8d18b6a2ae542866` — the last commit before the S1.D reap
  work was scoped and implemented.

### A note on the base

This is a phase within a larger, still-moving project, and the three slices merged at
different times (#630 first, then #631, then #629) onto a main that also took unrelated work
between them. So there is no single pristine "pre-project" commit. For faithful per-slice
reproduction, run each slice against main as it stood just before that slice's merge SHA. The
recorded `base_sha` anchors the project at the point S1.A–S1.C were done but no S1.D reap
slice had started.

## What the known-good solution did

Three independent slices, each its own PR, each with a deletion grep gate. They touch disjoint
files and carried no ordering dependency between them — the real run ran them in parallel.

1. **Construction-discipline shims (#630).** Deleted `SqlNamespacePayload` /
   `MongoNamespacePayload`, `normaliseNamespaceEntry` (×2), and `DEFAULT_NAMESPACES` (×2).
   `SqlStorage` / `MongoStorage` constructors now require fully-constructed `Namespace`
   instances — no POJO normalisation, no default-singleton injection. Grep gate:
   `normaliseNamespaceEntry|DEFAULT_NAMESPACES|SqlNamespacePayload|MongoNamespacePayload`
   returns nothing under `packages/`.
2. **Canonicalizer family hook (#631).** Removed the framework canonicalizer's inline SQL/Mongo
   storage-path guards and `sortIndexesAndUniques`; added optional `shouldPreserveEmpty` /
   `sortStorage` hooks on `CanonicalizeContractOptions`. Exported
   `sqlContractCanonicalizationHooks` / `mongoContractCanonicalizationHooks` from the family
   packs and threaded them through the serializers, contract-ts builders, and `contract-emit`.
   `computeStorageHash` takes the same hooks so hashing stays aligned with emit.
   **Output-preserving** — no canonical-bytes or hash diffs.
3. **Migration aggregate → `elementCoordinates` (#629).** Migrated `extractStorageElementNames`'s
   callers in the migration tooling to `elementCoordinates`, resolved the `StorageBase`-vs-
   `Storage` type gap (dropping an `as Contract` cast), and deleted the helper.

## Why this is the reference standard

- **Parallel by default.** The three surfaces are genuinely disjoint, and the run treated them
  as parallel slices rather than a serial chain — the planning behaviour PA-2 rewards.
- **Scope discipline.** Three further surfaces with structural prerequisites (namespaced
  `table` coordinate → hash-shape churn, kind-agnostic hashing, the query-builder unbound-tables
  rewrite) were explicitly deferred and recorded, not pulled in.
- **Deletes, not deprecations.** Every reaped symbol is gone, proven by a grep gate, and the
  canonicalizer refactor moved no hashes.
