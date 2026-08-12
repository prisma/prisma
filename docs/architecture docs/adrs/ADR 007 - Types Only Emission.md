# ADR 007 — Types-Only Emission and No Runtime Client Codegen

## Context

Prisma ORM historically generates a large JavaScript client from PSL. In Prisma Next, TypeScript serves as the primary safety layer for application code that consumes the data layer, rather than relying on generated runtime objects. The schema becomes a verifiable data contract consumed by multiple lanes. We want type safety without shipping generated JS, and a runtime that can adapt to contract changes without a regenerate step.

## Problem

- Runtime consumption of JSON data contracts makes TypeScript type inference difficult without additional type information
- Generated JS clients hide the underlying data contract semantics that agents and tools need to inspect
- Requiring generate for each schema change is at odds with modern TS-first flows and contract-driven architectures

## Decision

- Emit only two artifacts from the contract emitter: `contract.json` and `contract.d.ts`
- Construct runtime tables/columns via `makeT(contractJson)` at application startup
- Never ship generated JS client code
- All lanes (DSL, ORM, Raw SQL, TypedSQL factories) produce Plans against the runtime-built `t` and stamped coreHash

## Design

### Artifacts

#### contract.json
- Canonical JSON per ADR 010 with coreHash and profileHash
- Input to runtime, preflight, planner, and PPg

#### contract.d.ts
- Declares `Contract.Tables`, `Contract.Relations`, codecs, branded types
- Includes extension-branded types and function/operator typings registered by packs (ADR 113, ADR 114)
- Exposes read-only sources projected from pack-owned blocks alongside tables (ADR 126)
- Drives editor types and inference without shipping JS

### Runtime construction

```typescript
import contractJson from './contract.json' assert { type: 'json' }
import { sql } from '@prisma/sql'
import { createRuntime } from '@prisma/runtime'

const runtime = createRuntime({ ir: contractJson, verify: 'onFirstUse' })
const db = sql({ context })

const plan = db.user
  .select('id', 'email')
  .where((f, fns) => fns.eq(f.active, true))
  .build()

const rows = await runtime.execute(plan)
```

#### makeT
- Accepts the canonical JSON, validates minimally, memoizes by coreHash
- Returns a stable object graph of tables, columns, and typed expression builders
- No dynamic code generation or new Function
- Zero JS emitted from the emitter

### Tooling

- Dev-time integration (Vite/Next/esbuild) auto-emits `contract.json` + `.d.ts` on PSL/TS contract change per ADR 008 and ADR 032
- CI treats emission as explicit and reproducible
- Agents and CLIs consume `contract.json` directly
 - When JSON import isn’t available, a `contract.ts` file may be emitted that `export default` the canonical JSON (identical content to `contract.json`, no code). This preserves determinism and avoids embedding logic in artifacts.

### Plans and verification

- Plans embed `meta.coreHash`
- Runtime verifier compares with DB marker per ADR 021
- Plan hashing and caching ignore lane details per ADR 013 and ADR 025

### Lanes and code generation

- DSL and ORM lanes do not require generated clients or runtime JS codegen. They compose functions at runtime over the `t` object and emit Plans directly.
- TypedSQL is an optional, out-of-tree CLI that emits small per-query Plan factory modules (TS/JS) for `.sql` files. These factories stamp `coreHash` and return Plans; they are not a monolithic generated client and can be adopted selectively.

## Alternatives considered

- **Generated JS client**: Provides runtime objects but hides contract semantics and complicates bundling
- **Hybrid small JS stubs plus types**: Still adds codegen complexity without solving the type inference problem
- **Reflection only (no .d.ts)**: Loses editor-time types and makes agent generation less precise

## Consequences

### Positive

- TypeScript type safety through `.d.ts` emission without runtime JS overhead
- Clear, inspectable data contract for agents and tooling
- Works in serverless/edge without native client artifacts
- One runtime surface for all lanes

### Negative

- Small runtime cost to build `t` from JSON
- Requires JSON import support or packaging step in some environments
- Types derive from `.d.ts`, so purely dynamic contract edits at runtime won't update editor types

### Mitigations

- Memoize `t` by contractHash and keep construction O(schema)
- Provide a simple bundler transform for JSON import if needed
- Encourage TS-first authoring with explicit emit of canonical JSON for tools per ADR 097–098

## Migration impact

- Existing Prisma ORM users migrating to Prisma Next remove `prisma generate` as a runtime dependency and adopt contract emission
- Queries are written against `t` from `makeT(contractJson)` instead of a generated client
- TypedSQL continues as a separate CLI that emits Plan factories, not a client

## Open questions

- Should `makeT` perform deep runtime validation or trust the emitter's canonical JSON
- How to surface best-effort deprecation warnings in `.d.ts` without shipping JS

## Test strategy

- Golden tests for emitted `.d.ts` shapes from known PSL inputs
- Runtime snapshot tests for `makeT` object graph stability across versions
- Performance budgets for `makeT` construction and first query

## References

- ADR 006 — Dual authoring modes
- ADR 008 — Dev auto-emit, CI explicit emit
- ADR 010 — Canonicalization rules for contract.json
- ADR 011 — Unified Plan model across lanes
- ADR 021 — Contract marker storage & verification modes
- ADR 025 — Plan caching & memoization
- ADR 097 — Tooling runs on canonical JSON only
- ADR 098 — Runtime accepts contract object or JSON
