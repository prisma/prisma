# ADR 006 — Dual Authoring Modes (PSL-first and TS-first) with a Single Canonical Artifact

## Context

- Teams want flexibility to author schemas in PSL or in TypeScript for agent and tool ergonomics
- Having multiple sources of truth creates drift and unclear build boundaries
- Our safety model depends on a deterministic, hashable contract artifact consumed by queries, runtime, and migrations
- We need great DX in dev (auto emit) and strong determinism in CI

## Decision

- Support two authoring modes per project: PSL-first or TS-first
- A project supplies one authoritative **contract source provider** in config
- Both modes must emit the same canonical artifact: `contract.json` plus `.d.ts` types
- Only `contract.json` is the system of record for downstream tools and hashing
- Back-generation of the non-authoritative form is optional and clearly marked as derived

## Details

### Problem statement

We want teams to be able to author a schema in **either** PSL **or** TypeScript, while keeping the rest of the system simple.

That means:

- The CLI and core pipeline should not need to “know about” every possible input format.
- No matter how the schema was authored, we always end up with the same single output artifact (`contract.json`) that the rest of the framework consumes.

### Constraints (non-negotiables)

- `contract.json` must be deterministic and cross-platform stable (same inputs → same output bytes).
- Hashes must reflect only the *meaning* of the contract (no file paths, no source IDs, no source locations/spans).
- The CLI/control plane must not branch on “PSL vs TS vs …”. It should follow one flow.
- We still want good error messages. Source locations are allowed in diagnostics, but **must never** be written into `contract.json` or influence hashing.

### Authoring modes

#### PSL-first
- Source of truth is `schema.prisma`
- Emitter parses PSL and produces `contract.json` and `contract.d.ts`

#### TS-first
- Source of truth is `contract/contract.ts` using `defineContract({ family, target, models, ... })`
- Emitter executes the builder in a constrained environment and produces `contract.json` and `contract.d.ts`

### Canonical artifact

- `contract.json` is canonical, deterministic, and cross-platform stable
- Hashing follows ADR 004: meaning hashes (e.g. `storageHash`, optional `executionHash`) plus `profileHash` for pinned capability profile
- `.d.ts` provides types only, no generated runtime objects

### Responsibility split (how we decouple framework from authoring)

The key move is to separate “how we get a schema” from “how we produce the canonical artifact”.

**Contract source provider (owned by the authoring side):**

- Does the input-specific work (read PSL files, run a TS builder, etc.).
- Produces a **contract IR object** (the shared in-memory shape the framework expects).
- If it can’t, it returns structured diagnostics (optionally with a `sourceId` + span).

**Framework emission pipeline (owned by the framework):**

- Validates the returned IR (shape + invariants).
- Applies the framework’s “make it consistent” rules (defaults, stable ordering, stable identifiers).
- Computes hashes from that normalized result.
- Emits `contract.json` + `contract.d.ts` deterministically.

This keeps the framework independent of authoring formats, while still ensuring that PSL-first and TS-first converge on the same canonical artifact.

### Configuration

`prisma-next.config.ts` declares:

- `contract.source`: an async provider `(context: ContractSourceContext) => Promise<Result<Contract, ContractSourceDiagnostics>>`
- `contract.output`: path to `contract.json` (types are colocated as `contract.d.ts`)

Example (helper-first PSL path):

```ts
import { defineConfig } from '@internal/cli/config-types';
import { prismaContract } from '@internal/sql-contract-psl/provider';

export default defineConfig({
  // ... family/target/adapter wiring ...
  contract: prismaContract('./schema.prisma', {
    output: 'src/prisma/contract.json',
  }),
});
```

Inline provider functions remain supported for advanced/custom composition, but package helpers are the default expected DX.

### Dev and CI behavior

#### Dev
- Vite/Next/esbuild plugins auto-emit on import and on file change
- Errors surface inline in terminal and editor

#### CI
- Explicit `prisma-next contract emit` step required
- Pipeline verifies determinism by re-emitting and checking hashes

### Back-generation

- Optional renderers can derive PSL from a TS contract or a TS scaffold from PSL
- Back-generated files are annotated as derived and should not be committed as sources

### Meta and provenance

- Canonical artifacts exclude authoring provenance (no schema paths, no source IDs, no spans)
- Canonical `contract.json` has no top-level `sources` field
- Source provenance is diagnostics-only (CLI/editor output), and never part of hashing

### Failure modes

- If both sources change in the same branch, the emitter fails with a clear error
- If the derived file exists and differs from a fresh render, emitter warns and offers a fix strategy
- If the hashing changes across platforms, CI fails determinism checks

## Alternatives considered

- **Single authoring mode only**: Simpler docs but constrains teams and agents that prefer TS builders
- **Multiple sources of truth with last-write wins**: Easy to corrupt artifacts and defeats deterministic hashing
- **TS-only with PSL deprecated**: Excludes a large part of the existing ecosystem and increases migration cost

## Consequences

### Positive

- Teams choose the mode that fits their workflow and tools
- Deterministic `contract.json` keeps safety, hashing, and PPg features intact
- Agents can operate in either mode and rely on the same downstream artifact

### Trade-offs

- Slightly more complexity in config and docs
- Need clear guardrails to avoid dual-source drift

## Scope and non-goals

### In scope for MVP

- PSL-first and TS-first emission producing identical `contract.json` for equivalent intent
- Dev plugins for auto-emit and CI command for explicit emit
- Provider diagnostics with source spans; no provenance in canonical artifacts

### Out of scope for MVP

- Full fidelity PSL↔TS round-trip for advanced target extensions
- Integrated migration of large codebases between modes

## Backwards compatibility and migration

- Existing PSL projects can switch to PSL-first with minimal changes
- TS-first projects can be bootstrapped from an emitted PSL by generating a TS scaffold
- A one-time helper can render PSL from an existing contract to ease audits

## Open questions

- Degree of back-generation we want to support beyond basic scaffolds
- How to represent complex target extensions in PSL rendering without leaking adapter details
- Whether to allow mixed mode within a mono-repo with clear package boundaries

## Decision record

- Adopt dual authoring modes with a single canonical artifact
- Require projects to declare one authoritative source provider, enforce determinism, and keep provenance diagnostics-only
- Keep `.d.ts` emission types-only and rely on `makeT(contractJson)` for runtime construction
