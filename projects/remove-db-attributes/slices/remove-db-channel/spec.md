# Slice: remove-db-channel

This final slice completes `projects/remove-db-attributes/` by removing the legacy `@db.*` interpretation channel after every live repository consumer has migrated to type-position constructors.

## At a glance

The SQL PSL interpreter stops lowering `@db.*` attributes and deletes its family-owned native-type table. Schemas that still contain `@db.X(args)` fail with an actionable diagnostic that preserves the constructor name and arguments—`use X(args) in type position`—while durable architecture documentation, current upgrade guidance, and agent skills describe the unified type-contribution channel as the only supported surface.

## Chosen design

`NATIVE_TYPE_SPECS`, `NativeTypeSpec`, `resolveDbNativeTypeAttribute`, and the `allowDbNativeType` branch are deleted. Native storage remains entirely target-contributed through `AuthoringContributions.type`; the SQL family layer retains no Postgres-native mapping table and never lowers a `db.` attribute into a `ColumnDescriptor`.

The interpreter recognizes the exact `db.` prefix only to produce migration help. A shared diagnostic formatter strips `db.` from the attribute name and preserves the resolved arguments in source order, including constructor parentheses only when arguments exist. The resulting guidance is mechanical and does not validate the removed attribute's former base-type or argument rules:

```text
@db.VarChar(191) is no longer supported; use VarChar(191) in type position
@db.Uuid is no longer supported; use Uuid in type position
```

Named-type declarations use `PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE`; model fields use `PSL_UNSUPPORTED_FIELD_ATTRIBUTE`. Both carry the same actionable replacement suffix. This includes field-position `@db.*`, which was already unsupported but must now receive the same migration help because the project requirement applies to any remaining usage. Other dotted attributes continue through the existing extension namespace and unsupported-attribute logic unchanged.

The former compatibility test becomes migration-diagnostic coverage. It proves representative zero-argument, parameterized, duplicate, malformed, unknown, named-type, and field-position spellings all fail without producing storage types, with arguments preserved in the recommended type-position constructor. The test is written red before the implementation is removed.

Documentation converges on the implemented system:

- ADR 231 no longer carves out an active `@db.*` named-type attribute surface.
- ADR 241 records the accepted framework decision that a scalar type is a zero-argument type constructor contributed through `AuthoringContributions.type`; parameterized storage types use the same constructor channel.
- Live examples in ADR 226, ADR 239's current design prose, the ecosystem extensions subsystem, `prisma-next-contract`, and `prisma-next-supabase` use bare constructors.
- The current `0.16-to-0.17` upgrade instructions say the legacy attribute channel is removed and point consumers at the actionable rewrite. Older release-specific upgrade records and historical ADR context remain historical evidence rather than being rewritten indiscriminately.
- `sql-context.ts` is checked for the project-spec's stale wording; current `main` already contains no `@db` wording, so no no-op edit is required.

## Coherence rationale

The deletion, diagnostic, and durable guidance are one rollback unit: deleting the channel without migration help strands users, while documenting the hard cut before the interpreter enforces it would make the repository describe behavior that does not exist. One reviewer can evaluate the single concern—`@db.*` is gone and every remaining mention either helps migration or is explicitly historical—in one sitting.

## Scope

**In:** SQL PSL named-type and field attribute validation; deletion of the native-type spec/resolver path; replacement of legacy compatibility tests with migration-diagnostic tests; ADR 231; new ADR 241; live architecture examples and subsystem guidance; current Prisma Next and extension-author upgrade instructions; current agent skills that still teach `@db.*`; stale runtime/documentation wording; exhaustive live-reference classification; package, integration, E2E, fixture, typecheck, lint, dependency, and coverage validation appropriate to the cross-package hard cut.

**Out:** PSL grammar changes; changes to contract JSON or TypeScript contract shapes; new native types; TypeScript builder changes; rewriting historical release notes or old version-specific upgrade records; implementing ADR 231's declarative attribute combinator kit; changing unrelated attribute diagnostics; project close-out itself, which follows this slice after merge.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| Field-position `@db.*` was never a valid storage channel | Diagnose with the same constructor replacement | “Any remaining usage” is broader than the former named-type-only lowering path. |
| Removed attributes may contain malformed or named arguments | Preserve rendered arguments mechanically | The removed channel no longer validates legacy argument semantics; the diagnostic's job is source translation. |
| Old upgrade records and ADR history intentionally contain old syntax | Classify as historical and retain | The live-reference gate exempts immutable historical evidence while requiring current guidance to stop recommending the old surface. |
| A dotted attribute may belong to an extension | Special-case only the exact `db.` prefix | Existing composed/uncomposed namespace behavior remains authoritative for every other namespace. |

## Slice-specific done conditions

- [ ] `NATIVE_TYPE_SPECS`, `NativeTypeSpec`, `resolveDbNativeTypeAttribute`, and `allowDbNativeType` have no production-code references.
- [ ] Named-type and field-position `@db.X(args)` produce exact actionable diagnostics that preserve the replacement name and rendered arguments.
- [ ] Live code, architecture guidance, current upgrade instructions, and current agent skills contain no recommendation to author storage with `@db.*`; every retained hit is migration-diagnostic text or explicitly historical evidence.
- [ ] ADR 231 is amended and ADR 241 records the unified type-contribution channel as accepted.

## Open Questions

None. The parent project and TML-2988 pin the hard cut, diagnostic shape, documentation surfaces, and absence of a deprecation window.

## References

- Parent project: `projects/remove-db-attributes/spec.md`
- Linear issue: [TML-2988](https://linear.app/prisma-company/issue/TML-2988/remove-db-support-delete-native-type-specs-add-migration-diagnostic)
- [ADR 170 — Pack-provided type constructors and field presets](../../../docs/architecture%20docs/adrs/ADR%20170%20-%20Pack-provided%20type%20constructors%20and%20field%20presets.md)
- [ADR 171 — Parameterized native types in contracts](../../../docs/architecture%20docs/adrs/ADR%20171%20-%20Parameterized%20native%20types%20in%20contracts.md)
- [ADR 231 — Declarative attribute specifications](../../../docs/architecture%20docs/adrs/ADR%20231%20-%20Declarative%20attribute%20specifications.md)
