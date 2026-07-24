# @prisma-next/sql-contract-psl

PSL-first SQL contract interpretation for Prisma Next.

## Overview

`@prisma-next/sql-contract-psl` provides two entrypoints:

- **Pure interpreter** (`@prisma-next/sql-contract-psl`): parsed PSL document -> SQL `Contract`
- **Provider helper** (`@prisma-next/sql-contract-psl/provider`): read file -> parse -> interpret -> `ContractConfig`

This keeps core/CLI source-agnostic while giving PSL-first SQL users a one-line config helper.

## Responsibilities

- Interpret a PSL `SymbolTable` into SQL `Contract`
- Interpret generic PSL attributes into SQL contract semantics (`@id`, `@unique`, `@default`, `@relation`, `@map`, `@@map`, `@@control`)
- Interpret SQL timestamp semantics: `DateTime @default(now())` (or the equivalent `temporal.createdAt()` field-preset call) as a storage default, and `temporal.updatedAt()` as an execution mutation default
- Lower shared constructor expressions in both `types {}` blocks and inline field positions (for example `ShortName = sql.String(length: 35)` and `embedding pgvector.Vector(length: 1536)?`)
- Lower supported default functions through composed registry inputs
- Resolve Postgres native storage types from bare names and constructor calls in type position (`Char`, `VarChar`, `Numeric`, `Uuid`, `Inet`, `SmallInt`, `Real`, `Timestamp`, `Timestamptz`, `Date`, `Time`, `Timetz`, `Json`, `Jsonb`)
- Map PSL relation action tokens to SQL contract referential actions and emit diagnostics for unsupported values
- Emit deterministic relation metadata in `models.<Model>.relations`
- Enforce extension composition for namespaced constructor expressions and emit strict diagnostics for unsupported namespaced attributes
- Validate generator applicability by declared `codecId` support on composed generator descriptors
- Consume target-bound scalar descriptors, shared authoring contributions, and mutation-default registries assembled by composition layers
- Compose provider flow for SQL PSL-first config (`read -> parse -> interpret`) without local registry assembly
- Preserve parser diagnostics and add interpreter diagnostics with stable codes
- Return `notOk` with structured diagnostics for unsupported constructs
- Keep interpretation deterministic for equivalent AST inputs

Determinism note:
- Relation metadata emission is intentionally **sorted by storage table name, then model name, then relation field name** (not PSL declaration order) so `contract.json` snapshots and hashes are stable across environments.

## Non-responsibilities

- Canonical artifact emission (`contract.json`, `contract.d.ts`) and hashing
- CLI or ControlClient orchestration

The **pure interpreter entrypoint** specifically excludes:
- File I/O (`schema.prisma` reading)
- PSL parsing (`parse` + `buildSymbolTable`)
- Artifact emission (`contract.json`, `contract.d.ts`) and hashing
- CLI or ControlClient orchestration

Current scope is SQL target-specific: callers pass scalar descriptors and target context assembled for the active SQL target.

Unsupported PSL constructs in v1 (strict errors):

- **Scalar and storage-oriented lists are rejected**:
  - Scalar lists like `String[]`
  - Enum lists and named-type lists
- **Relation navigation lists are supported** when they can be matched to an FK-side relation:
  - Example: `User.posts Post[]` + `Post.user User @relation(fields: [userId], references: [id])`
  - Matching may use `@relation("Name")` or `@relation(name: "Name")` when multiple candidates exist
  - Navigation list fields accept only `@relation` (name-only form); other field attributes are strict errors
- **Implicit Prisma ORM many-to-many remains unsupported** (list navigation on both sides without explicit join model)
  - Represent many-to-many with an explicit join model (two foreign keys)

Supported `@default(...)` surface in v1 when composed contributors provide handlers:

- Storage defaults: `autoincrement()`, `now()`, literals, `dbgenerated("...")`
- Execution defaults: `uuid()`, `uuid(4)`, `uuid(7)`, `cuid(2)`, `ulid()`, `nanoid()`, `nanoid(<2-255>)`
- Explicitly unsupported in v1: `cuid()` (diagnostic suggests `cuid(2)`)
- `dbgenerated("...")` preserves the parsed PSL string-literal contents as-is (escaped sequences are not normalized in v1).

Supported timestamp authoring surface:

- `createdAt DateTime @default(now())` and `createdAt temporal.createdAt()` both lower to the target storage default and do not create an execution mutation default.
- `updatedAt temporal.updatedAt()` lowers to `timestampNow` on create and on non-empty update mutations. This is application-side because update-time semantics are mutation-aware, not a database trigger.
- The Prisma-flavored `@updatedAt` attribute is not supported; references produce `PSL_UNSUPPORTED_FIELD_ATTRIBUTE` with a migration hint pointing at `temporal.updatedAt()`. The hint is suppressed when the field already declares any `temporal.*` preset.
- `@createdAt` is not supported as a PSL alias.

Model-level control policy:

- `@@control(<policy>)` lowers to the storage table's `control` field. The argument is one positional lowercase literal: `managed`, `tolerated`, `external`, or `observed`. Omit `@@control` to leave per-table control unset (the framework default applies at runtime).

Contract-level default (specifier options bag):

- `defaultControlPolicy` on `prismaContract(...)` sets `Contract.defaultControlPolicy` at load time when the interpreted contract does not already define one (source wins when both are present).

## Public API

- `@prisma-next/sql-contract-psl`
  - `interpretPslDocumentToSqlContract({ symbolTable, sourceFile, sourceId, target, scalarColumnDescriptors, composedExtensionContracts, seedDiagnostics?, authoringContributions?, controlMutationDefaults?, composedExtensions? })` — build `symbolTable`/`sourceFile` via `parse(schema)` + `buildSymbolTable(...)` from `@prisma-next/psl-parser`.
- `@prisma-next/sql-contract-psl/provider`
  - `prismaContract(schemaPath, { output?, target, createNamespace, composedExtensionPackRefs?, defaultControlPolicy?, enumInferenceCodecs? })` — scalar column descriptors are derived from the composed stack's authoring type namespace at load time.
  - Provider input is fully preassembled by composition layers (for example `@prisma-next/family-sql/control` helpers).

## Dependencies

- **Depends on**
  - `@prisma-next/psl-parser` for parser + parser result types
  - `@prisma-next/sql-contract-ts` for SQL authoring builder composition
  - `pathe` for provider path resolution
  - `@prisma-next/contract` and `@prisma-next/utils`
- **Used by**
  - PSL contract providers configured via `contract.source`
  - Composition helpers such as `@prisma-next/family-sql/control` that assemble provider inputs

## Architecture

```mermaid
flowchart LR
  config[prisma-next.config.ts] --> providerHelper[@prisma-next/sql-contract-psl/provider]
  providerHelper --> fsRead[read schema.prisma]
  fsRead --> parse[parse]
  parse --> parsed[DocumentAst + SourceFile + parser diagnostics]
  parsed --> symbols[buildSymbolTable]
  providerHelper --> descriptors[pslBlockDescriptors]
  descriptors --> symbols
  symbols --> symbolTable[SymbolTable + symbol-table diagnostics]
  symbolTable --> interpreter[@prisma-next/sql-contract-psl]
  interpreter --> irResult[Result_Contract_Diagnostics]
  irResult --> emit[Framework emit pipeline]
```

## Related Docs

- `docs/Architecture Overview.md`
- `docs/architecture docs/subsystems/1. Data Contract.md`
- `docs/architecture docs/subsystems/2. Contract Emitter & Types.md`
- `docs/architecture docs/adrs/ADR 006 - Dual Authoring Modes.md`
- `docs/architecture docs/adrs/ADR 163 - Provider-invoked source interpretation packages.md`
