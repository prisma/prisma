# Typed DDL migration ops — Plan

**Spec:** `./spec.md` · **Linear:** [project](https://linear.app/prisma-company/project/typed-ddl-migration-ops-complete-the-conversion-9a86e44d4c38)

## Composition (5 slices, PG-first)

PG slices are the priority — they must land before the RLS project's new migration planner generates conflicts.

### PG stack (priority — deliver first)

1. ✅/▶ **`pg-residual-ops`** — Linear: **TML-2919** — *first slice, in flight*
   - **Outcome:** the last raw-SQL PG ops convert to typed AST lowered through the adapter: the not-null-with-temporary-default recipe (`buildAddColumnSql`) and the data-transform `EXISTS(<user sql>)` precheck/postcheck wrapper. Dead PG raw builders deleted (`planner-ddl-builders.ts buildAddColumnSql`; any now-callerless `operations/*.ts`).
   - **Builds on:** the frozen contract-free builder + adapter DDL-lowering seam (Phase 1).
   - **Out:** `CreateExtension` (slice 2); SQLite (slices 3–4).

2. **`pg-create-extension-entity-kind`** — Linear: **TML-2920**
   - **Outcome:** `CREATE EXTENSION` modeled as a first-class **entity kind** (mirroring RLS-policy entity-kind modeling), with a typed DDL AST node + adapter lowering; `CreateExtensionCall.toOp()` routes through it; `operations/dependencies.ts` deleted. **After slices 1+2: all PG ops typed, all PG raw Op-builders gone — PG done before RLS planner work.**
   - **Builds on:** slice 1 (PG fully on the typed path except extensions). The entity-kind shape is the load-bearing decision — settle vs the RLS-policy pattern in a dispatch-1 spike.

### SQLite stack (after PG)

3. **`sqlite-execute-step-adoption`** — Linear: **TML-2921** (absorbs **TML-2866**)
   - **Outcome:** AddColumn/DropColumn/CreateIndex/DropIndex/DropTable execute steps build typed DDL through `SqliteControlAdapter` (mirror PG slice 7); `sqlite/operations/{columns,indexes}.ts` deleted; `DdlColumn.type` stops smuggling column options (proper SQLite column-options surface).
   - **Builds on:** Phase-1 SQLite CreateTable adoption + typed checks.

4. **`sqlite-recreate-table-and-ast-growth`** — Linear: **TML-2922**
   - **Outcome:** the query AST + contract-free builder grow `CASE WHEN` and row-tuple `IN`; `recreateTable` execute steps + `buildRecreatePostchecks` convert to typed AST; remaining raw SQLite table-rebuild builders deleted. The AST-growth is the load-bearing decision (dispatch-1 spike).
   - **Builds on:** slice 3 (SQLite execute path).

### Parallel

5. **`adr-and-subsystem-docs`** — Linear: **TML-2923**
   - **Outcome:** the "DDL as a target-contributed query-AST kind + adapter DDL-lowering seam" ADR + Migration System / Adapters & Targets subsystem-doc updates. Lands last, once the seam is fully settled by slices 1–4. Parallelisable with implementation but written after the shape stops moving.

## Sequencing rationale

- **PG before SQLite** — operator priority: PG conversion must complete before the RLS project's new migration planner lands, to avoid conflicts. Slices 1→2 are the urgent stack.
- **1→2 stack** — slice 2 (CreateExtension entity-kind) is cleanest once slice 1 has the rest of PG on the typed path and the only PG raw remnant is extensions.
- **3→4 stack** — slice 4's AST growth (CASE + tuple-IN) is the highest-cost item; slice 3 settles the SQLite execute pattern first.
- **Docs last** — the ADR can't be written until the seam stops moving.

## Dependencies (external)

- [x] Frozen contract-free builder + adapter DDL-lowering seam (Phase 1) — present.
- [ ] RLS-policy entity-kind pattern (reference for slice 2) — in the postgres-rls project; confirm the pattern is far enough along to mirror at slice-2 pickup.

## Close-out

- [ ] Verify project DoD in `./spec.md`.
- [ ] ADR + subsystem docs migrated to `docs/` (slice 5).
- [ ] Delete `projects/typed-ddl-migration-ops/` + strip references.
