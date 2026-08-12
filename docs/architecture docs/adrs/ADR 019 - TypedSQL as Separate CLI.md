# ADR 019 — TypedSQL as a Separate CLI that Emits Plan Factories

## Context

- Some queries are clearer or only possible in hand-authored SQL
- We want to keep the core lanes (DSL, ORM, raw) small while offering a first-class path for named SQL with types
- Prior art in Prisma TypedSQL generates client code, which we do not want to re-introduce
- We need a way for SQL files to become executable Plans with types, annotations, and the data contract hash without coupling to a specific runtime

## Decision

- Ship TypedSQL as an out-of-tree CLI, not a core lane
- The CLI reads `.sql` files and emits Plan factories: tiny TS/JS functions that, when called with params, return a Plan conforming to ADR 011
- The CLI stamps `meta.coreHash` from the project's data contract and `meta.target` from the selected adapter profile
- The CLI validates parameter and result types using either a live DB or the contract when possible
- Generated artifacts are minimal and lane-neutral, avoiding client codegen and runtime coupling
- TypedSQL generation must stamp coreHash from canonical JSON, not by evaluating TS
- If a repo is TS-first, the CLI calls `canonicalize(contract)` in a sandboxed step to obtain JSON

## Goals

- Preserve the clarity and power of hand-authored SQL while keeping safety guarantees
- Produce Plans that flow through the same guardrails, budgets, and telemetry as other lanes
- Keep outputs small, deterministic, and easy for agents to consume
- Avoid a regenerate-everything client step

## Non-goals

- Replacing the SQL DSL or ORM lanes
- Adding a SQL parser to core runtime
- Guaranteeing type inference without either a live DB or explicit hints

## What the CLI does

- Scans a configured directory of `.sql` files
- Parses lightweight header comments for param hints and intent annotations:
  - `-- @param {Int} $1:userId`
  - `-- @intent read|write|admin`
  - `-- @sensitivity pii|phi|secrets`
- Optionally connects to a database to infer param and result types, or uses contract metadata and hints when offline
- Emits a `*.ts` or `*.js` module exporting one factory per SQL file:
  - `export const getUsers = typedSqlFactory({...})`
- Each factory accepts parameters and returns a Plan with:
  - `sql` as authored
  - `params` as provided
  - `meta` including target, coreHash, lane = 'typed-sql', required annotations per ADR 012, optional refs/projection when available

## Plan factory API

Two ergonomic forms are supported:

- **Curried**: `getUsers()` returns `(args) => Plan<Row>`
- **Direct**: `getUsers(args)` returns `Plan<Row>`

Row and param types are generated for TS projects and JSDoc-typed for JS.

## Annotations and validation

- Required annotations per ADR 012 are generated or derived:
  - `intent`, `isMutation`, `hasWhere`, `hasLimit`
- Optional `refs` and `projection` are included if the CLI can infer them safely
- **Param and result typing sources**:
  - Live DB inference via EXPLAIN/driver metadata when available
  - Explicit `@param` hints for inputs
  - Contract-based mapping for simple projections
- The CLI fails generation in strict mode on inconsistent or missing required annotations and emits warnings in permissive mode

## Outputs

Configurable via flags:
- `*.ts` or `*.js` module exporting factories
- Optional sidecar `*.plan.json` for each query containing a static snapshot useful for CI diffing
- A small manifest describing exported factories, their SQL file origins, and target profile

All outputs are deterministic given the same inputs, contract, and CLI version.

## Integration with runtime

- Consumers import factories and call them to get Plans
- Plans run through the same hook pipeline, lints, budgets, and hashing as other lanes
- No dependency on a specific runtime implementation is generated

## Versioning and compatibility

- CLI is versioned independently and adheres to semver
- Outputs target Plan model v1 and annotations v1
- Breaking changes to output shape require a major bump
- The CLI embeds adapter profile version and contract schema version in the manifest for auditing

## Golden and stability guarantees

- The SQL text in a file is preserved byte-for-byte in the emitted Plan
- Normalization and hashing at runtime follow ADR 013 and remain lane-agnostic
- The CLI ships golden tests mapping inputs to generated factories and optional sidecar JSON

## Configuration

- `typedSql.path` directory for `.sql` sources
- `typedSql.out` output module path
- `typedSql.target` adapter profile name
- `typedSql.contract` path to `contract.json`
- `typedSql.dbUrl` optional for inference
- `typedSql.mode` strict | permissive
- `typedSql.format` ts | js | json+ts

## Why this ADR

- Captures the integration contract for named SQL without re-introducing client codegen
- Keeps safety intact by requiring annotations and stamping the contract hash
- Lets teams or agents adopt TypedSQL incrementally without affecting other lanes

## Alternatives considered

- **Make TypedSQL a first-class lane in core**: Couples core to SQL parsing and increases surface area
- **Generate a client wrapper that executes queries directly**: Re-introduces heavy codegen and runtime coupling
- **Only support raw SQL with manual annotations**: Loses typed params/results and undermines DX

## Consequences

### Positive

- Clear path for teams who prefer authoring SQL while preserving verification and telemetry
- No heavy client or regenerate-everything step
- Agents can pick up factories and produce Plans with guaranteed annotations

### Trade-offs

- Type inference requires a live DB or explicit hints
- Optional `refs`/`projection` may be absent for very complex SQL, which weakens some lints

## Testing

- Unit tests for header hint parsing and annotation defaults
- Integration tests against a live Postgres to validate inferred types and Plan execution
- Golden tests for generated factory modules and optional sidecar JSON

## Open questions

- Extending header hints to declare explicit `refs` or `projection` for stronger guardrails
- Support for multi-statement files via labeled sections and whether to permit them at all
- Future support for additional dialects using adapter profiles

## Decision record

- TypedSQL is an out-of-tree CLI that emits lane-neutral Plan factories
- Factories validate params/results, stamp coreHash, and provide required annotations
- No client codegen or runtime coupling is introduced
