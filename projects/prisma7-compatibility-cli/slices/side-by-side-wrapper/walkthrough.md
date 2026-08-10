## Key snippet(s)

```ts
// packages/prisma7/src/delegate-to-prisma-cli.ts
process.env[distributionMarker] = 'prisma7'
return loadPrismaCli() // require('prisma/build/index.js')
```

## Sources

- Commit range: `origin/v7...HEAD`
- Slice commits: `5ae58ae55e`, `e86b01a84c`, `f5531d98da`
- Project-artifact commit: `e69dba3a49`
- Intent: [slice spec](projects/prisma7-compatibility-cli/slices/side-by-side-wrapper/spec.md)
- Review verdict: [code review](projects/prisma7-compatibility-cli/reviews/code-review.md)

## Intent

Establish a runnable, unpublished `prisma7` distribution that delegates to the exact matching Prisma 7 implementation while a direct Prisma dependency can continue serving the ordinary `prisma` command. The slice creates the identity and package boundary that the later branding-completion and release-mirroring slices can build on.

## Change map

- **Implementation**:
  - [CLI distribution identity](packages/cli/src/utils/cli-distribution-identity.ts) — immutable `prisma`/`prisma7` identity selection, one-shot marker consumption, and startup stability.
  - [CLI dispatcher](packages/cli/src/bin-dispatcher.ts) — initializes identity before normal or completion dispatch.
  - [Wrapper delegation](packages/prisma7/src/delegate-to-prisma-cli.ts) — sets the private marker and resolves `prisma/build/index.js` through the declared dependency edge.
  - [Wrapper build](packages/prisma7/helpers/build.ts) — emits the executable dispatcher and forwarded package/config bundles.
  - [Wrapper package contract](packages/prisma7/package.json) — defines the `prisma7` binary, exact packed dependency semantics, exports, and published file set.
  - [Config forwarding](packages/prisma7/src/config.ts) and [root type forwarding](packages/prisma7/src/index.ts) — expose the supported package surfaces without duplicating Prisma implementation.
- **Tests (evidence)**:
  - [Identity tests](packages/cli/src/utils/cli-distribution-identity.vitest.ts) — prove default identity, `prisma7` selection, marker consumption, and startup immutability.
  - [Built dispatcher tests](packages/cli/src/bin-dispatcher.vitest.ts) — execute the emitted dispatcher for both normal and completion branches and verify identity is initialized before loading either branch.
  - [Delegation tests](packages/prisma7/src/delegate-to-prisma-cli.test.ts) — prove normal/completion arguments and delegated exit behavior are preserved.
  - [Package contract tests](packages/prisma7/src/package-contract.test.ts) — pack the wrapper, verify its exact same-version Prisma dependency and file/export contract, then resolve wrapper config beside a different root Prisma and typecheck forwarded imports.
  - [Forwarded surface typecheck](packages/prisma7/src/forwarded-surface.typecheck.ts) — pins parity between root and config Prisma types.

## The story

1. **Create one identity contract for two distributions.** The CLI now resolves an immutable identity at startup. Ordinary entrypoints default to `prisma`; the wrapper sets a private marker before loading the published Prisma CLI entrypoint, which selects `prisma7` and immediately consumes the marker so it is not accidentally inherited by unrelated child processes.
2. **Keep normal and completion execution on the same implementation.** The wrapper owns only a small executable dispatcher and preserves `process.argv` and exit behavior. The existing Prisma dispatcher remains responsible for loading either the normal CLI or completion bundle, with identity initialization occurring before both branches.
3. **Prove the built behavior, not only source behavior.** A first implementation relied on an import/evaluation that the CLI package's tree-shaking could remove. The emitted-dispatcher test now spawns the built `packages/cli/build/index.js`, probes both branches, and asserts that the identity exists and the environment marker has been consumed. This is evidence that the identity seam survives the actual bundle used by the wrapper.
4. **Expose the package boundary without assuming a filesystem layout.** `prisma7` forwards its supported root type and `prisma7/config` surfaces while requiring `prisma/build/index.js` through normal package resolution. The pack-and-fixture test verifies that the root package can resolve a different Prisma version while the wrapper config resolves its own declared dependency.

## Behavior changes & evidence

- **Adds private distribution identity selection**: ordinary Prisma starts with the existing `prisma` identity, while a wrapper invocation selects `prisma7`; initialization is immutable after startup and consumes the marker.
  - **Why**: Later identity propagation needs one authoritative contract, and marker consumption prevents accidental branding of child processes.
  - **Implementation**: [CLI distribution identity](packages/cli/src/utils/cli-distribution-identity.ts), [CLI dispatcher](packages/cli/src/bin-dispatcher.ts)
  - **Tests**: [Identity tests](packages/cli/src/utils/cli-distribution-identity.vitest.ts), [built dispatcher tests](packages/cli/src/bin-dispatcher.vitest.ts)

- **Adds a side-by-side executable wrapper**: `prisma7` resolves and delegates to `prisma/build/index.js`, preserving normal and completion arguments and delegated exit status.
  - **Why**: Reuse the Prisma 7 implementation and its assets instead of maintaining a second CLI bundle or depending on a constructed nested `node_modules` path.
  - **Implementation**: [Wrapper entrypoint](packages/prisma7/src/bin.ts), [wrapper delegation](packages/prisma7/src/delegate-to-prisma-cli.ts), [wrapper build](packages/prisma7/helpers/build.ts)
  - **Tests**: [Delegation tests](packages/prisma7/src/delegate-to-prisma-cli.test.ts), [built dispatcher tests](packages/cli/src/bin-dispatcher.vitest.ts)

- **Adds exact dependency and forwarded package surfaces**: the packed wrapper records a dependency on the same Prisma version, exposes `prisma7` and `prisma7/config`, and resolves config through the wrapper's Prisma dependency beside a different direct root Prisma.
  - **Why**: A declared dependency edge is portable across package-manager layouts and preserves the intended side-by-side command topology.
  - **Implementation**: [Wrapper package contract](packages/prisma7/package.json), [config forwarding](packages/prisma7/src/config.ts), [root type forwarding](packages/prisma7/src/index.ts)
  - **Tests**: [Package contract tests](packages/prisma7/src/package-contract.test.ts), [forwarded surface typecheck](packages/prisma7/src/forwarded-surface.typecheck.ts)

## Compatibility / migration / risk

- Ordinary `prisma` invocations retain the default identity and the existing CLI implementation; the identity seam is additive.
- The wrapper is private and unpublished in this slice. Its exact dependency behavior is proven by a local packed fixture, while the full npm/pnpm/Yarn/Bun installation matrix remains release-slice work.
- The private environment marker is transport-only and one-shot. The low-level nested Prisma package and filesystem paths remain visible by design; only the future user-facing identity layer will replace actionable Prisma 7 references.
- The wrapper currently establishes identity transport, not complete `prisma7` branding, so mixed user-facing references are expected until the next slice.

## Follow-ups / open questions

- Complete `prisma7` branding across command help, initialization, generated config, diagnostics, version/mismatch output, completion, and update handling, including update-prompt suppression.
- Add release mirroring and publish ordering/recovery, then validate packed installs across the supported package managers.

## Non-goals / intentionally out of scope

- No copied CLI implementation, engines, Wasm assets, command handlers, or preinstall logic.
- No exhaustive user-facing branding or update behavior in this slice.
- No publication, release automation, release-channel policy, or automatic reconciliation of Prisma 7 and Prisma 8 project files.
