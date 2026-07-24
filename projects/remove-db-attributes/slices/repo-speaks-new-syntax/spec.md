# Slice: repo-speaks-new-syntax

This slice makes the repository consume and produce the bare-type PSL syntax introduced by the parent project.

## At a glance

Postgres inference prints storage types directly in type position, and every live package, fixture, demo, example, extension contract, and committed migration snapshot is migrated from `@db.*`. The SQL interpreter continues recognizing the legacy channel until the following hard-cut slice.

## Chosen design

The printer represents a resolved PSL storage type as a type-position name plus optional constructor arguments, rather than as a base scalar plus `PslNativeTypeAttribute`. The Postgres type map emits `Uuid`, `VarChar(191)`, `Numeric(10, 2)`, and the other contributed constructors directly; native `json` emits `Json`, and native `jsonb` emits `Jsonb`.

All live consumers use the same spelling:

```prisma
// before
types {
  Id = String @db.Uuid
  Slug = String @db.VarChar(191)
}

// after
types {
  Id = Uuid
  Slug = VarChar(191)
}
```

Committed migration contract sources are regenerated from the migrated source rather than edited as isolated snapshots. Historical release notes and ADR history remain historical. Generic parser coverage for dotted attributes may use a neutral namespace.

## Coherence rationale

The printer contract, inferred output, repository consumers, and generated fixtures are one round-trip migration: splitting them would leave either inference or committed consumers speaking syntax the other side does not prove.

## Scope

**In:** Postgres PSL type-map/printer contracts and tests; contract-PSL, parser, and language-server tests and fixtures; all live `packages/`, `examples/`, and `apps/` PSL consumers; Supabase extension contract; demo and example migration chains; upgrade instructions for the current transition; exhaustive live-usage scrub.

**Out:** Deleting `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, or `allowDbNativeType`; the final migration diagnostic; ADR 231 and the unified-channel ADR; historical release notes and historical ADR prose.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| Native `json` versus `jsonb` | Pin distinct output | `json` prints `Json`; `jsonb` prints `Jsonb`. |
| Parameterless parameterized constructors | Omit empty argument and `typeParams` syntax | Bare `VarChar`, `Numeric`, and temporal constructors remain valid zero-arg forms. |
| Generic dotted-attribute parser fixtures | Preserve grammar coverage under a neutral namespace | Dotted attributes remain valid beyond `db.*`. |
| Existing `@db.Inet` parity mapping | Contribute and print bare `Inet` | Preserve `pg/inet@1` / native `inet`; this was omitted from the original inventory. |
| Historical documentation | Exempt from the live-usage gate | Release notes and ADR history are not rewritten. |

## Slice-specific done conditions

- [x] Postgres infer output re-parses and re-emits with storage parity, including `Json`/`Jsonb` and parameterized constructors.
- [x] `rg '@db\.' packages examples apps test` returns only deliberate legacy-recognition tests reserved for slice 4 or explicitly historical material.
- [x] All committed demo/example/extension contracts and migration chains are regenerated and `pnpm fixtures:check` is clean.
- [x] Current-transition upgrade entries describe the PSL source translation for users and extension authors.

## Open Questions

None. The parent project settles the syntax, JSON bindings, migration breadth, and hard-cut sequencing. Operator clarification on 2026-07-23 confirms that `@db.Inet` becomes `Inet`; the prior exclusion was an inventory error, not a design constraint.

## References

- Parent project: `projects/remove-db-attributes/spec.md`
- Project plan: `projects/remove-db-attributes/plan.md`
- Linear issue: [TML-2987](https://linear.app/prisma-company/issue/TML-2987)
- Printer contract: `packages/2-sql/9-family/src/core/psl-contract-infer/printer-config.ts`
- Postgres type map: `packages/3-targets/3-targets/postgres/src/core/psl-infer/postgres-type-map.ts`
