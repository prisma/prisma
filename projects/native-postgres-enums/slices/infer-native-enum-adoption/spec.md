# Slice — `infer-native-enum-adoption`

**Project:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md) · **Requirement:** R6 (Phase 2 "Adoption", pulled forward)

## At a glance

`contract infer` against a database containing native Postgres enum types **adopts** them instead of throwing. Today ([infer-psl-contract.ts:295](../../../../packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts)):

```text
contract infer: the database contains native Postgres enum type(s): aal_level. …
Drop the native type and replace each column with a text column carrying a CHECK constraint …
```

After this slice, the same run emits the Phase-1 authoring surface:

```prisma
native_enum AalLevel {
  aal1 = "aal1"
  aal2 = "aal2"
  aal3 = "aal3"
  @@map("aal_level")
}

model Session {
  aal pg.enum(AalLevel)?
  @@map("sessions")
}
```

**Why now (sequencing inversion vs the project spec):** the spec sequences adoption after the managed lifecycle slices (create/delete, add-value). Pulling it forward unblocks Supabase extension Slice F, whose introspect→emit pipeline for the full `auth`/`storage` contract hits this throw on Supabase's five `auth` enum types. Adoption has no code dependency on the differ or the migration ops — it is introspection + PSL emission only.

## Chosen design

**1. Introspection reads ordered member values.** The adapter's names-only enum query ([control-adapter.ts:1126](../../../../packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts)) is enriched to join `pg_enum` ordered by `enumsortorder`, yielding `{ typeName, values[] }` per type. `PostgresNamespaceSchemaNode` carries the enriched shape; its existing `nativeEnumTypeNames` readers (differ carry-through, planner codec hooks, the infer annotation) keep a names view. This is the exact introspection enrichment Phase-2 Slice A specifies — done here, reused there. **No `DiffableNode` is minted** — the contract entity still does not project into the diff tree; that stays Slice A's work.

**2. Infer emits `native_enum` blocks and `pg.enum(Ref)` columns.** The hard throw is deleted. For each introspected enum type not owned by a described pack contract (subtraction symmetric with tables, same `describedContracts` owners lookup): emit a `native_enum` block named through the existing top-level name-transform machinery (`buildTopLevelNameMap` already accepts kind `'enum'`; `@@map` when the PSL name differs from the type name; member names sanitized with the explicit `member = "value"` syntax, which carries any value string). An enum-typed column resolves to the `pg.enum(<PslName>)` type constructor. The plumbing half-exists and is dead-wired today: `PslPrinterOptions.enumInfo` is declared but unread, and `enumNameMap` is threaded through `buildModel`/`seedNamedTypeRegistry` with `new Map()` at both call sites ([infer-psl-contract.ts:389,397](../../../../packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts)) — this slice wires real data through those seams. Note the column emission is the **type-constructor form** (`pg.enum(Name)`), not the bare-name substitution the `enumNameMap` path was sketched for (`role Role`); the writer emits the call syntax.

**3. Grade: inferred blocks carry no explicit `control`.** The block inherits the contract's `defaultControl`, exactly like every other inferred element — this is the spec of record's R6 ("all inference is managed"). For the Supabase Slice F run (`defaultControl: 'external'`) the result is faithful: the DB owns the types, Prisma Next emits no DDL. **Transitional gap, accepted:** under `defaultControl: 'managed'` the inferred enum claims a lifecycle the planner does not yet enforce — the Contract→SchemaIR projection hardcodes `nativeEnumTypeNames: []` ([contract-to-postgres-database-schema-node.ts:135](../../../../packages/3-targets/3-targets/postgres/src/core/migrations/contract-to-postgres-database-schema-node.ts)) until Phase-2 Slices A/B land, which make the grade true retroactively with no contract change. The gap is documented where the throw's remediation text used to live.

**4. Enum-bearing output is namespace-wrapped (pinned during D2a).** The interpreter deliberately skips extension entities in the unspecified top-level bucket — a `native_enum` block only lowers inside an explicit `namespace { … }` block. So when (and only when) the introspected namespace contains native enum types, infer wraps its whole output in `namespace <schemaName> { … }`; enum-free output stays byte-identical to today's flat form (no fixture churn, TML-2958's stopgap semantics preserved). Teaching the interpreter to lower the default bucket was rejected: it touches contract-psl semantics for every schema, out of this slice's scope.

## Coherence rationale (slice-INVEST · _Small_)

One reviewer holds: **"`contract infer` adopts native enum types instead of throwing."** The pieces are interdependent — emission is impossible without member values (introspection), the blocks are dead weight without the column references, and the columns dangle without the blocks. One PR, one rollback unit, no differ/ops surface touched.

## Scope

**In:** the `pg_enum` introspection enrichment + node shape; deleting the throw; `native_enum` block emission (name transforms, `@@map`, member sanitization); `pg.enum(Ref)` column emission; pack-owned enum subtraction; adapter + infer + print tests; an integration test proving infer → author → `db verify` against the source database.

**Deliberately out:**

- **The managed lifecycle** — `PostgresNativeEnum` SchemaIR `DiffableNode`, Contract→SchemaIR projection, differ integration, `CREATE TYPE`/`DROP TYPE`/`ADD VALUE` ops (Phase-2 Slices A/B, unchanged).
- **Multi-namespace infer output** — the single-namespace flat-bucket stopgap (TML-2958) stands; this slice adopts enums within the one introspected namespace. Supabase Slice F's full `auth` + `storage` run needs the multi-namespace PSL writer regardless of enums — that gap is TML-2958's, not this slice's.
- **Realization swap** — migrating a check-realized enum to native or back (project non-goal).

## Pre-investigated edge cases

- **Coordinate mismatch in pack subtraction.** A pack contract keys `entries.native_enum` by **handle name** (`AalLevel`) while introspection sees the **type name** (`aal_level`); the entity's `typeName` field carries the mapping. Owner matching must compare type names, not entries keys — the table precedent compares physical names and does not hit this because table entries are keyed physically.
- **Non-identifier enum values.** A value that isn't a valid PSL identifier (e.g. leading digit, hyphen) cannot be its own member name; sanitize the member name and rely on the explicit `= "value"` to carry the truth. Same registry as model-name mangling.
- **Enum-typed column defaults.** An introspected default like `'aal1'::auth.aal_level` reaches `parseRawDefault`; confirm it degrades to a preserved raw default rather than mis-parsing (this shape has never reached the parser — the throw fired first).
- **Enum array columns** (`aal_level[]`). Phase 1 supports enum-typed list columns; infer must either emit the list form or produce a named unsupported-type diagnostic — silent `unsupported: true` fallback to a named type is wrong. Settle emit-vs-diagnostic in the plan.
- **`extractEnumInfo` half-seam.** `EnumInfo.definitions` already exists with the right shape (`Map<string, readonly string[]>`) and is always empty today ([postgres-type-map.ts:131](../../../../packages/3-targets/3-targets/postgres/src/core/psl-infer/postgres-type-map.ts)); the print-psl enums test currently asserts the **throw** — those tests invert from negative to positive.

## Slice-specific done conditions

- `contract infer` against a live database (PGlite integration test) containing native enum types and enum-typed columns writes a `contract.prisma` that parses, builds, and — authored back — passes `db verify` against the source database; columns type as the member value union.
- The adoption path proves the Supabase shape: a non-`public`-schema enum type with an enum-typed column (the `auth.aal_level` pattern) round-trips through infer within that namespace.
- The "drop the native type" remediation throw is gone; `pnpm fixtures:check` clean.

(CI-green, reviewer-accept, project-DoD floor inherited — not restated.)

## Open questions

- **Enum arrays**: ~~emit `pg.enum(Name)` list columns vs a named diagnostic~~ — settled in D2a: Phase-1 authoring already accepts `pg.enum(E)[]` (proven through the production interpret chain), so infer emits the list form.

## Follow-ups discovered during the build (not in-slice)

- ~~**Serialized pack contracts expose no enum type names.**~~ **Resolved by [`serialize-native-enum-entities`](../serialize-native-enum-entities/spec.md).** `PostgresContractSerializer` used to strip `native_enum` entries (only the derived `valueSet`, keyed by handle name, survived in `contract.json`), so the pack-owned subtraction matched only in-memory described contracts. That slice made `entries.native_enum` an ordinary enumerable kind, so it now serializes into `contract.json` and hydrates back — the subtraction (`describedNativeEnumOwnersByTypeName`) matches type names on a contract hydrated from serialized bytes, proven by the serialized+hydrated subtraction test in `infer-psl-contract.enum-adoption.test.ts`.
- **`contract infer` cannot introspect a non-default schema from the CLI.** The control-api client's `introspect()` passes no schema selection and the adapter defaults to `public`. The auth-shaped adoption path is proven at the family level (the same introspect→infer chain the CLI wraps), but a user cannot point the CLI at an `auth`-only database today. Pre-existing limitation surfaced by this slice's D3, not caused by it; blocks the *CLI* leg of Supabase Slice F's introspect→emit pipeline alongside TML-2958.

## References

- Throw to replace: [`infer-psl-contract.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/psl-infer/infer-psl-contract.ts) (~291–304); flat-bucket stopgap + `describedContracts` owners subtraction directly below (~306–335).
- Introspection query: [`control-adapter.ts`](../../../../packages/3-targets/6-adapters/postgres/src/core/control-adapter.ts) (~1126–1135); node: [`postgres-namespace-schema-node.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/schema-ir/postgres-namespace-schema-node.ts).
- Dead-wired seams: [`printer-config.ts`](../../../../packages/2-sql/9-family/src/core/psl-contract-infer/printer-config.ts) (`EnumInfo`, `PslPrinterOptions.enumInfo`), [`postgres-type-map.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/psl-infer/postgres-type-map.ts) (`extractEnumInfo`), `enumNameMap` threading in `infer-psl-contract.ts` (~450, 553, 586, 910).
- Authoring surface emitted into: Phase-1 `native_enum` blocks (project [`spec.md`](../../spec.md)); grounding example: [`contract.prisma`](../../../../packages/3-extensions/supabase/src/contract/contract.prisma) (`auth.AalLevel`).
- Entity: [`postgres-native-enum.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/postgres-native-enum.ts) (`PostgresNativeEnum`, optional `control`).
- Consumer this unblocks: Supabase Slice F (shipped in [#960](https://github.com/prisma/prisma-next/pull/960)).
