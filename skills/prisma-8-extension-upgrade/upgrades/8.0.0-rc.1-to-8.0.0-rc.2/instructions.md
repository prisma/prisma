---
from: "8.0.0-rc.1"
to: "8.0.0-rc.2"
changes:
  - id: check-constraint-ir-carries-an-opaque-expression
    summary: |
      `CheckConstraint` (contract IR) and `SqlCheckConstraintIR` (schema IR) changed from
      `{ name, column, valueSet }` / `{ name, column, permittedValues }` to
      `{ name, prefix?, expression }`. Both are constructed from an `SqlObjectNaming` rather
      than a bare name, exactly like `Index` / `SqlIndexIR`: pass
      `{ naming: { kind: 'wire', prefix, hash }, expression }` for a managed check, or
      `{ naming: { kind: 'exact', name }, expression }` for one adopted verbatim. Compute the
      hash with `computeCheckContentHash(expression)` from `@internal/sql-schema-ir/naming`.
      Reading a check off a built node is unchanged (`check.name`), and `check.prefix` tells
      you whether it is wire-named. Contract JSON hydrates through
      `checkConstraintInputFromSerialized`, which rejects a `prefix` that does not parse out of
      the `name`. `resolveValueSetValues` is gone — a check no longer references a value set,
      so there is nothing to resolve; the members are already baked into the predicate text.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - 'CheckConstraint'
        - 'permittedValues'
        - 'resolveValueSetValues'
      anyMatch: true
  - id: add-check-constraint-call-takes-an-expression
    summary: |
      `AddCheckConstraintCall` is now constructed as
      `(schemaName, tableName, constraintName, expression)` — the `column` and `values`
      parameters are gone, and the rendered DDL is
      `ALTER TABLE … ADD CONSTRAINT "x" CHECK (<expression>)` with the predicate emitted
      verbatim. The matching migration-class method takes
      `{ schema, table, constraint, expression }`. `DropCheckConstraintCall` is unchanged.
      There is no compatibility overload — update every construction site.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - 'AddCheckConstraintCall'
        - 'addCheckConstraint'
      anyMatch: true
  - id: specifier-default-control-policy-requires-create-namespace
    summary: |
      The options bag on `typescriptContract` / `typescriptContractFromPath` now requires
      `createNamespace` alongside `defaultControlPolicy`. Stamping a specifier default carries
      a consequence — derived CHECK constraints are stripped from tables the stamped policy
      leaves non-managed — and the strip rebuilds storage namespaces through the target's
      factory, so the two options travel together. Pass the same factory the PSL specifier
      already takes:
      `typescriptContract(contract, output, { defaultControlPolicy: 'external' })` becomes
      `typescriptContract(contract, output, { defaultControlPolicy: 'external',
      createNamespace: postgresCreateNamespace })`, with `postgresCreateNamespace` imported
      from the Postgres target's types entrypoint (`@internal/target-postgres/types`).
      Calls without an options bag are unchanged, and `emptyContract` already took
      `createNamespace`.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - 'typescriptContract'
        - 'defaultControlPolicy'
      anyMatch: false
  - id: re-emit-extension-contract-spaces
    summary: |
      Run your extension's `contract emit` (the `build:contract-space` script, if you have one)
      to regenerate its committed `contract.json` / `contract.d.ts`. Two things change: any
      enum CHECK is re-serialized into the new shape with a wire name, and every list (`many`)
      column gains a declared element-non-null CHECK that the Postgres planner used to
      synthesize without ever declaring. Prefixes derived from long table and column names are
      truncated to 54 UTF-8 bytes so the wire name fits Postgres's 63-byte identifier limit;
      identity lives in the hash, so truncated prefixes still yield distinct names.
      Postgres introspection also stopped parsing predicates and now captures every CHECK
      constraint verbatim, so any hand-written or platform-installed check on a table your
      extension manages is visible for the first time: it verifies as an undeclared extra under
      `--strict` and becomes a `dropCheckConstraint` under a policy that allows `destructive`.
      If your extension installs checks out of band — through a raw-SQL migration step rather
      than through the contract — there is no way to declare them in 8.0.0-rc.2 (checks have no
      authoring surface, and derivation from column shape is not one). Keep the tables carrying
      them under an additive-only policy — the checks survive, and only `--strict` verify
      reports them — or expect the first destructive plan against an upgraded database to
      offer to drop them. An authoring/opt-out surface is planned for a later release.
    detection:
      glob: "**/contract.json"
      contains:
        - '"many": true'
        - '"valueSet"'
      anyMatch: true
---

# 8.0.0-rc.1 → 8.0.0-rc.2 — Extension-author upgrade instructions

<!--
PR #29910: `changes: []`. Binding internal mutation-reload filters and repairing Supabase runtime coverage after the driver SPI split require no downstream extension source translation.

PR #29920: `changes: []`. Adds prepared-statement test coverage to the Supabase runtime suite (test-fixture codec registration only) and fixes a postgres direct-driver transaction defect; neither requires downstream extension source translation. The SPI split itself is recorded as `driver-spi-splits-query-and-execute` in the 0.17-to-8.0.0-rc.1 transition.

PR #29902: `changes: []`. Generated contracts gain additive aggregate rows for new opt-in integer representation codecs, but existing extension schemas and source require no migration; extension authors re-emit only when adopting the new target-scoped types.
-->

## Why checks stopped being structured

A check is now one opaque SQL string that nothing parses. Postgres reprints predicates in its
own normalized form — a `varchar` membership test comes back as
`((col)::text = ANY ((ARRAY[…])::text[]))` — so any structured reading of a live predicate
drifts against the authored text. Equality for a wire-named check is name equality, because the
hash already commits to the predicate; only an exact-named check compares its body, and then
byte-for-byte.
## If your target pack authors checks

Check emission is driven by a duck-typed `renderCheckExpressions` hook on the pack's
`authoring` contributions, resolved the same way `qualifyColumnType` is. It receives one
column's shape (`tableName`, `columnName`, `many`, and `memberValues` — the last present only
for a value set the toolchain owns) and returns `{ kind, columnName, expression }` candidates,
where `kind` is `'membership'` or `'elementNotNull'`. A pack without the hook emits no checks
at all, which is how SQLite keeps its no-CHECK stance. Nothing in the return value is a name:
the contract builder composes the prefix from the table, the column, and the kind, truncates it
to 54 UTF-8 bytes, and appends the content hash.
## Hand-written checks are visible now

Postgres introspection reads `pg_get_expr(c.conbin, c.conrelid)` and stores the predicate
verbatim; it no longer recognises only the two shapes the old parser could parse. Every CHECK
constraint on a managed table therefore reaches the differ, and one the contract does not
declare is an ordinary undeclared extra: reported by `db verify --strict`, and dropped by a plan
whose control policy allows `destructive`.

For an extension this matters in one specific case — a check your extension installs through a
raw-SQL migration step rather than deriving in its contract space. That constraint used to be
invisible and is now drop-eligible against any database the extension manages. Declaring it is
not possible in 8.0.0-rc.2: a contract space derives checks from column shape (enum membership,
list element-non-null) and has no surface for an arbitrary hand-written predicate. Document
that the tables carrying it stay under an additive-only policy — the check survives, plain
`db verify` tolerates it, and only `--strict` reports it — or accept the drop under a
destructive plan. An authoring/opt-out surface for checks is planned for a later release.
