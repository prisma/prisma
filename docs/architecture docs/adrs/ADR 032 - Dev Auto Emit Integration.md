# ADR 032 — Dev Auto-Emit Integration (Vite/Next/esbuild)

## Context

- Prisma Next produces two canonical artifacts from the data contract: `contract.json` and `contract.d.ts`
- Requiring developers to run an explicit generate step regresses DX, breaks agent flows, and complicates hot-reload loops
- Modern TS toolchains (Vite, Next.js, esbuild) support plugin hooks that can keep artifacts current on demand

## Decision

- Ship first-party dev plugins for Vite, Next.js, and esbuild that auto-emit the contract artifacts whenever inputs change
- Define a clear "no explicit generate" contract: importing the generated types or contract file guarantees they exist and are fresh
- Standardize invalidation triggers, debounce/backoff, error surfacing, caching, and concurrency policy across all plugins
- Explicitly support TS-first projects: watch the contract module and auto-emit canonical JSON on import/change
- Surface canonicalization errors in overlay and console with debounced rebuilds

## Scope

- Dev time hot emit for PSL-first and TS-first authoring modes
- Support monorepos with pnpm/yarn workspaces and multiple apps sharing one contract
- CI support via a headless `prisma-next contract emit --check` that reuses the same invalidation and caching logic
- Not in scope: production packaging of artifacts into registries or remote caches

## Inputs that trigger invalidation

- PSL files under the configured contract root `**/*.prisma` or `schema.psl`
- TS contract builder files under `contract/**/*.ts` including transitive imports
- Contract extensions registered by adapter profile packages
- Tooling version or adapter profile hash changes
- Env vars declared as contract-affecting in config, e.g. `CONTRACT_TZ`, `CONTRACT_LOCALE`
- TypedSQL or other lanes are out of scope for this ADR

## File watching model

- Use native watchers with fallback to polling when necessary
- Build a dependency graph once and refine incrementally using import analysis for TS-first
- Coalesce change events per contract root before scheduling an emit

## Debounce and backoff

- Default debounce: 150 ms per contract root
- Error backoff: exponential starting at 500 ms up to 5 s when emits fail repeatedly
- Cooldown window: suppress duplicate errors for 2 s to avoid console spam

## Caching

Content-addressable cache keyed by:
- Canonicalized contract input hash
- Emitter version
- Adapter profile hash

If cache hit, write through the artifacts' mtime only when consumers require it to satisfy bundlers that depend on timestamp semantics.
Cache directory `.prisma-next/cache` with pruning on a size budget.

## Concurrency and locking

- Single-writer file lock `.prisma-next/emit.lock` per contract root
- If a second process requests emit while another holds the lock:
  - Short-wait up to 250 ms
  - If still locked, serve last good artifacts and schedule a retry
- Atomic writes via temp files then rename to avoid partial reads

## "No explicit generate" contract

- Importing `contract.json` or `contract.d.ts` through the plugin's virtual module guarantees the artifacts exist and are up to date
- **Example**: `import contract from 'virtual:prisma-next/contract'`
- **Example**: `import type { Contract } from 'virtual:prisma-next/types'`
- Direct file imports `./contract.json` also work when `emitTo` is configured, but virtual modules are the portability default
- Builds fail fast if emit cannot be satisfied within a timeout, with actionable diagnostics

## Error surfacing

### IDE overlay integration
- **Vite**: error overlay with file, line, column, and quick action hints
- **Next.js**: custom Error component hook that mirrors overlay content

### Console reporter
- Concise single-line summary plus expanded diagnostics on request

### Diagnostics file
- `.prisma-next/last-error.json` for agents and CI to read structured errors
- Clear remediation messages:
  - Missing env, type errors in TS contract, schema parse locations, adapter profile mismatch

## Plugin implementations

### Vite plugin
- Resolves `virtual:prisma-next/*` modules
- `configureServer` registers watchers and kicks initial emit on first import
- `handleHotUpdate` coalesces changes and triggers emit plus HMR for type-consumers
- Option `emitTo` to mirror artifacts into `src/generated/prisma-next` if desired

### Next.js integration
- Compiler plugin that runs in dev server context
- Route handler that serves virtual modules for contract and types
- Webpack plugin fallback that hooks `beforeCompile` to ensure freshness
- Minimal impact on Fast Refresh with hashed virtual module ids

### esbuild plugin
- `onResolve` for `virtual:prisma-next/*`
- `onLoad` produces in-memory contents
- Optional `writeArtifacts` to persist to disk on successful builds for tooling that expects files

## Configuration

```typescript
// prisma-next.config.ts
import { defineConfig } from 'prisma-next/config'

export default defineConfig({
  authoring: 'psl' | 'ts',
  roots: ['./prisma', './contracts/app'],
  tsContract: './contract/contract.ts',  // NEW: TS contract path for TS-first projects
  emit: {
    outDir: './.prisma-next/artifacts',
    virtualModules: true
  },
  watch: {
    debounceMs: 150,
    backoff: { startMs: 500, maxMs: 5000 },
    envAffecting: ['CONTRACT_TZ']
  },
  adapterProfile: 'postgres/default',
  overlays: { enabled: true }
})
```

## Agent ergonomics

- Agents can import `virtual:prisma-next/contract` without shelling out to a generate step
- Structured diagnostics file enables automatic fix-ups or targeted prompts
- Stable virtual module ids make repos portable across editors and CI runners

## Performance targets

- Cold emit under 150 ms for small schemas
- Hot emit under 50 ms for single-file edits
- Watcher overhead remains below 1% CPU on idle
- No more than one extra filesystem write on a steady state save loop

## Testing

- Contract change triggers fresh artifacts and HMR updates
- Concurrent edits do not corrupt artifacts due to atomic writes
- Simulated parse failure shows overlay, console, and diagnostics file with consistent codes
- Monorepo test with two apps sharing one contract validates per-root locking

## Migration path

- Replaces `prisma generate` in dev loops
- CI can call `prisma-next contract emit --check` to ensure artifacts match sources
- Legacy users can continue to commit artifacts to VCS or switch to virtual modules

## Open questions

- Should we ship a unified `@prisma/next-dev` meta plugin that dispatches to Vite/Next/esbuild automatically?
- Do we expose a VS Code extension that surfaces diagnostics directly from the emitter without a dev server?
- Policy for committing artifacts in monorepos where multiple apps consume the same contract?
