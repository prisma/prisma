# ADR 099 — Contract authoring lint rules


## Context

We support TS-first authoring of the data contract via defineContract. To keep TS-first as deterministic and auditable as PSL-first, TS contracts must be pure data and free of runtime variability. An ESLint plugin can enforce authoring-time rules that prevent nondeterminism from creeping into contracts before they reach canonicalization and CI.

## Problem

- Dynamic keys, post-construction mutation, and environment-driven values can change the contract shape across machines
- Non-serializable values break canonicalization or produce unstable hashes
- Teams lack immediate feedback in editors when violating purity rules

## Goals

- Provide an ESLint plugin that flags nondeterministic or non-serializable patterns in TS contracts
- Offer an optional precommit check that asserts `canonicalize(contract)` is stable within the repo
- Keep TS-first development no-emit and fast while preventing fragile patterns

## Non-goals

- Replace canonicalization or CI checks
- Lint general application code outside contract modules
- Parse or execute arbitrary SQL

## Decision

Ship @prisma/eslint-plugin-contract with a focused rule set and recommended config

### Rules

- **no-dynamic-table-keys**
  Forbid dynamic property names in tables, models, indexes, foreignKeys maps
  Require string literals or `as const` literal objects
- **no-post-construction-mutation**
  Forbid writes to contract, tables, columns, or nested nodes after construction
  Encourage single expression literals or builder patterns that return new objects
- **no-nonserializable-values**
  Disallow Date, RegExp, BigInt, Symbol, functions, class instances, or getters within the contract object graph
  Suggest using scalar descriptors provided by target helpers
- **no-env-or-time-in-contract**
  Flag reads of process.env, Date.now(), Math.random(), filesystem or network APIs within contract files
- **literal-order-stability**
  Recommend `as const` on literal maps and warn on spread order that may be tool-chain dependent
- **targeted-file-scope**
  Rules apply only to files matching a configurable pattern, e.g. `**/contract.{ts,tsx}` or modules importing defineContract

Each rule supports levels `off | warn | error`

### Recommended config

- `plugin:@prisma-contract/recommended` sets
  - `no-dynamic-table-keys`: error
  - `no-post-construction-mutation`: error
  - `no-nonserializable-values`: error
  - `no-env-or-time-in-contract`: error
  - `literal-order-stability`: warn

## Precommit check (optional)

Provide `prisma-next verify:contract` that

- Imports the contract module in a sandboxed process
- Runs `canonicalize(contract)` twice and compares JSON and coreHash for stability
- Fails if canonicalization is unstable or contains unsupported values

Teams can wire this into Husky or lefthook

## DX integration

- ESLint inline diagnostics in IDEs for fast feedback
- Vite/Next plugin surfaces canonicalization errors as overlay when auto-emit is enabled
- Rule docs link to ADR 096 and ADR 010

## Rationale

- Linting catches issues early where developers work
- Precommit stability check guards against subtle cases the static rules cannot prove
- Keeps TS-first workflow fast while preserving deterministic artifacts for tools and CI

## Alternatives considered

- **Enforce purity only in canonicalization**
  Later feedback, worse developer experience
- **Rely solely on CI emission failures**
  Slower loop, harder to attribute violations to code locations

## Consequences

### Positive

- Early, precise feedback with editor-level diagnostics
- Fewer CI failures due to non-serializable or dynamic patterns
- Stronger guarantees that TS-first yields the same coreHash as PSL-first

### Negative

- Some legitimate advanced patterns may need refactoring into pure data
- Slight setup overhead to scope rules to contract files

## Implementation notes

- Build on ESLint RuleTester with fixtures covering allowed and disallowed patterns
- Provide autofix for common cases, e.g. replacing computed keys with literal keys when obvious
- Offer an escape hatch comment `// prisma-contract-ignore-next-line <rule>` with audit logging in CI

## Testing

- Rule unit tests with valid and invalid examples
- Integration tests in a sample repo running lint, auto-emit, and precommit verify
- Fuzz tests for nested structures and spread ordering

## Migration

- Ship rules as warn in the first release of the recommended config
- Provide a codemod to migrate common mutation patterns to builder returns
- After one minor release, elevate core rules to error by default

## Open questions

- Do we allow BigInt if canonicalization encodes it as a string
- Should we include a rule to pin Node and TypeScript versions for emission reproducibility
- How to detect and warn on non-deterministic iteration over object keys at build time

## References

- ADR 010 — Canonicalization rules for contract.json
- ADR 096 — TS-authored contract parity & purity rules
- ADR 097 — Tooling runs on canonical JSON only
- ADR 098 — Runtime accepts contract object or JSON
