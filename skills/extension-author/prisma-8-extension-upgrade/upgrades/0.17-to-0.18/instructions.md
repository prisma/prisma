---
from: "0.17"
to: "0.18"
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
  - id: re-emit-extension-contract-spaces
    summary: |
      Run your extension's `contract emit` (the `build:contract-space` script, if you have one)
      to regenerate its committed `contract.json` / `contract.d.ts`. Two things change: any
      enum CHECK is re-serialized into the new shape with a wire name, and every list (`many`)
      column gains a declared element-non-null CHECK that the Postgres planner used to
      synthesize without ever declaring. Prefixes derived from long table and column names are
      truncated to 54 characters so the wire name fits Postgres's 63-character identifier
      limit; identity lives in the hash, so truncated prefixes still yield distinct names.
    detection:
      glob: "**/contract.json"
      contains:
        - '"many": true'
        - '"valueSet"'
      anyMatch: true
---

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
for a value set the toolchain owns) and returns `{ prefix, expression }` candidates. A pack
without the hook emits no checks at all, which is how SQLite keeps its no-CHECK stance. The
contract builder owns naming: it truncates the prefix and appends the content hash.
