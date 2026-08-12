# Typed DDL migration ops — complete the conversion

**Linear project:** [Typed DDL migration ops — complete the conversion](https://linear.app/prisma-company/project/typed-ddl-migration-ops-complete-the-conversion-9a86e44d4c38)
**Lineage:** Phase 2 of the [Marker/ledger via typed query AST](https://linear.app/prisma-company/project/markerledger-via-typed-query-ast-dc62ab25d151) project. Phase 1 (proved planner DDL adoption on all three targets + the verification-check conversion) shipped; this project completes the exhaustive conversion.

## Purpose

Every Postgres and SQLite migration operation builds a **typed query-AST/DDL node lowered through the adapter** — there is no hand-glued raw SQL Op-builder left in the migration path. The "express, don't concatenate" principle, finished. Plus: `CREATE EXTENSION` becomes a **first-class entity kind** (modeled the way RLS policies are), not a one-off op; and the design seam is documented (ADR + subsystem docs).

## Why now (sequencing driver)

The Postgres RLS project is building a **new migration planner**. The Postgres conversion must land **first** so the ops are fully migrated before that work generates conflicts. Hence PG slices are the priority; SQLite follows.

## Where things stand (grounded 2026-06-16)

- **Mongo:** done (slice 6 / TML-2888). Out of scope here.
- **Postgres:** 21/23 ops on the typed path. Remaining raw: the not-null-with-temporary-default recipe (`buildAddColumnSql`), the data-transform `EXISTS(<user sql>)` precheck/postcheck wrapper, and `CreateExtension`. (TML-2918 op-id/codecRef round-trip already merged, #837.)
- **SQLite:** prechecks/postchecks are typed (TML-2889), but op **execute** steps are still raw strings (AddColumn/DropColumn/CreateIndex/DropIndex/DropTable), and `RecreateTable` + `buildRecreatePostchecks` are wholly raw (the latter needs AST kinds that don't exist yet — `CASE WHEN`, row-tuple `IN`).
- **Native PG enum ops:** deleted by TML-2853 (#817) — not in scope.

## Non-goals

- **Mongo** — already converted.
- **Control-plane adapter/SPI shape, codec-registry interface split, introspection-via-builder, contract-free surface rename** — moved to the separate "Typed query AST — substrate & control-plane cleanup" project (TML-2856/2820/2823/2865/2798). Not migration-op conversion.
- **The un-namespaced-PG→unbound planner bug (TML-2916)** — separately owned/in-flight; not a slice here.
- **New migration ops or capabilities** — this is conversion of existing ops, not new surface.

## Cross-cutting requirements

- **No raw-SQL Op-builder survives** in the PG or SQLite migration path after the relevant slice (`operations/*.ts` free string-gluing builders deleted as their ops convert). The only sanctioned raw remnant is genuinely user-supplied SQL (e.g. the data-transform inner query; `rawSql()` escape hatch).
- **Byte/semantic parity preserved.** Lowered SQL stays byte-stable where it was (golden fixtures green); where a check's shape legitimately changes (literals → bound params), semantic parity via runner integration tests is the bar.
- **`*Call.toOp()` stays the common interface** — both planner-constructed and authored (`Migration` method) paths go through it.
- **Green main between slices; each slice is one independently-mergeable PR.**

## Project Definition of Done

- [ ] Team-DoD floor (repo gates, docs/migration, Linear close-out).
- [ ] Every Postgres migration op builds typed AST lowered through the adapter; `CreateExtension` is a first-class entity kind; all PG `operations/*.ts` raw Op-builders + `planner-ddl-builders.ts` raw helpers are deleted.
- [ ] Every SQLite migration op (incl. RecreateTable) builds typed AST lowered through the adapter; the SQLite raw execute/postcheck builders are deleted; `DdlColumn.type` no longer smuggles column options (TML-2866).
- [ ] The query AST + contract-free builder express `CASE WHEN` and row-tuple `IN` (needed by RecreateTable postchecks).
- [ ] An ADR records "DDL as a target-contributed query-AST kind + adapter DDL-lowering seam"; subsystem docs (Migration System, Adapters & Targets) updated.
- [ ] `grep` for hand-built migration `SELECT`/DDL strings under `*/migrations/` returns only sanctioned user-SQL remnants.

## References

- Predecessor project + design-notes: `projects/migrate-marker-ledger-to-typed-query-ast-commands/` (esp. design-notes "Typed verification queries" + the frozen contract-free builder decisions).
- Slices: `slices/pg-residual-ops/` (TML-2919), then TML-2920 (CreateExtension entity-kind), TML-2921 (SQLite execute), TML-2922 (SQLite RecreateTable + AST growth), TML-2923 (ADR/docs).
- Patterns: three-layer polymorphic IR; frozen-class AST + visitor; adapter SPI. RLS-policy entity-kind modeling (postgres-rls project) — reference for TML-2920.
