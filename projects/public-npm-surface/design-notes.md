# Public npm surface — design notes

The system-level design is settled and recorded in [ADR 242](../../docs/architecture%20docs/adrs/ADR%20242%20-%20Public%20npm%20surface%20-%20single%20%40prisma%20scope%20with%20consolidated%20publish%20packages.md); these notes hold only execution-level decisions made while shaping this project.

## Principles

- **Additive until the switchover.** Old package names and imports work at every intermediate commit; the publish list and `private` flags flip in one PR.
- **Shells re-export, never copy.** One module, one published package — the ADR's identity rule is the invariant every slice must preserve.
- **The registry is the deliverable.** Verification runs against packed tarballs, not workspace links, because workspace resolution hides exactly the class of bug (phantom deps, missing exports entries) this project exists to eliminate.

## Execution decisions

- **Internal workspace names stay `@prisma-next/*`.** Private names never reach npm; renaming ~50 packages and every in-repo import buys nothing the `private` flag doesn't provide. Recorded as a spec non-goal; flagged to operator (spec OQ 3).
- **Facades are relocated entry packages, not new code.** Today's per-database entry packages already do the wiring; they move to `packages/9-public/` and gain re-export entrypoints rather than being rewritten.
- **Shim keeps its current name for now** (spec OQ 2); the `prisma` succession is out of scope per ADR 242's deferred decisions.

## Consumer conversion: what the published surface was actually missing (TML-3129)

Driving the consumer trees to zero internal references turned the "is the facade surface complete?" question from a scan into evidence. Four things came out of it.

**Most gaps were the project's fault, not the surface's.** The examples had hand-built control stacks, configs and driver wiring that the facade already collapses into one call — `createPostgresControlClient`, the facade's `defineConfig`, `postgres({ contract, pg })`. Those were fixed in the projects. Two contract-space packages took `MigrationMetadata` from `migration-tools/metadata` while already importing three sibling types from `framework-components/control`, which re-exports it; folding the import removed their migration-tools dependency outright.

**Three new facade entrypoints, all bounded by subpath.** `ShellReexportMapping` gained a `subpaths` allowlist so a facade can carry a corner of a large tooling package without republishing it whole. Forwarding a package costs one published entrypoint per subpath it exports, which is the right price for a surface used as a whole and the wrong one for a slice.

- `migration-tools`, five of seventeen subpaths (`aggregate`, `contract-snapshot-store`, `hash`, `io`, `spaces`). A project that checks its own migrations are intact, or stages an extension's pinned contract-space artifacts before `db init`, reads and writes the on-disk migration format. The other twelve — the graph, the pathfinder, ref resolution, the ledger — are the CLI's working material and publishing them would freeze them.
- `driver` on the SQL facades, two subpaths each. Previously Mongo-only, on the reasoning that only code driving a migration runner itself names a driver. The SQL migration-planner harnesses do exactly that, so the reasoning applied and the exclusion did not.
- `schema-ir`, one subpath (`types`). `SqlSchemaIR` is the schema shape the planner takes and returns, so hand-authored migrations and planner harnesses name it.

**Repo-internal dev packages moved off the brand.** `@prisma-next/{tsconfig,tsdown,test-utils}` became `@repo/*`, and the consumer projects that named themselves `@prisma-next/*` took their bare directory names. These are not module-identity problems — `tsconfig` is consumed via `extends` and never imported — but they left every converted project still naming the old scope. `@repo/*` is what Turborepo calls workspace-internal packages, carries no product brand, and keeps three categories legible: `@repo/*` belongs to the repository, `@prisma-next/*` is the ORM internals, `@prisma/*` is published.

**Emission reads the nearest manifest, so a project measuring two databases needs two project boundaries.** `bundle-size` names both facades; its two halves now each carry a manifest beside their config. The same shape fixed the Mongo CLI journeys, whose temp projects had been inheriting the shared fixture app's whole-workspace manifest.

**`init` now scaffolds published names.** It had been writing workspace names behind a constant, with a note that a later slice would supply a real root. That is a correctness matter, not tidiness: a project scaffolded against unpublished names cannot install. A scaffold is always on the facade root, so the root is a property of the chosen target.

**The check asserts zero.** `scripts/lint-consumer-internal-imports.mjs` lost its thresholds and its config file. It counts both imports and manifest entries (including a project's own `name`) and fails on the first of either. Its scope list is in the script with the reason: the substrate suites under `test/integration` exercise internal packages directly, because those packages are the code under test, and rewriting them onto a database package would replace that coverage with coverage of its re-exports.

## Open questions

Tracked in `spec.md § Open questions` — org readiness, shim interim name, internal-name confirmation, `middleware-cache` naming depth.

## References

- ADR 242 (decision), ADR 211 (shim mechanics), `docs/reference/Package Naming Conventions.md` (to be rewritten at close-out).
