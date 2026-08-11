# prisma7 compatibility CLI — Plan

**Spec:** `projects/prisma7-compatibility-cli/spec.md`  
**Linear Project:** N/A — operator authorized planning and delivery without a Linear Project

## At a glance

This is a three-slice stack. It first establishes a runnable side-by-side package and stable identity contract, then completes Prisma 7 behavior under that identity, and finally makes the artifact safely publishable whenever the matching `prisma@7` version is published.

## Composition

### Stack (deliver in order)

1. **Slice `side-by-side-wrapper`** — Linear: N/A
   - **Outcome:** The workspace contains a buildable, packable `prisma7` package whose `prisma7` binary resolves and executes its exact Prisma 7 dependency alongside a direct Prisma 8 CLI, while forwarding the supported root and `prisma7/config` exports. The ordinary `prisma` invocation remains unchanged.
   - **Builds on:** The existing Prisma CLI dispatcher and its published `./build/index.js`, root, and `./config` contracts.
   - **Hands to:** A stable distribution-identity contract and an unpublished wrapper artifact that downstream work can invoke, inspect, and test without knowing its physical dependency layout.
   - **Focus:** Identity selection, wrapper/package structure, exact dependency semantics, forwarded exports, executable dispatch/completion behavior, and focused resolution tests. Exhaustive user-facing wording and release automation remain for later slices.

2. **Slice `identity-complete-prisma7`** — Linear: N/A
   - **Outcome:** Running Prisma 7 through `prisma7` is behaviorally identical to the matching `prisma` release except that every actionable package, command, config-import, version, mismatch, completion, and installation reference uses `prisma7`; update prompts are suppressed. Existing `prisma` output and behavior remain regression-pinned.
   - **Builds on:** Slice `side-by-side-wrapper`'s stable identity contract and runnable package.
   - **Hands to:** A complete, unpublished `prisma7` artifact whose command behavior and public identity satisfy the project contract and are safe for release integration.
   - **Focus:** Systematic identity propagation across command help, generated output, warnings, diagnostics, subcommands, completion, and update handling, plus dual-identity regression coverage. Low-level nested dependency paths remain intentionally visible; publishing stays out of scope.

3. **Slice `release-mirroring-and-package-proof`** — Linear: N/A
   - **Outcome:** Every exercised `prisma@7` publication path publishes the exact matching `prisma7` artifact afterward, can recover when the wrapper publication fails after Prisma succeeds, and never emits `prisma7` for a non-v7 publication. Packed side-by-side installs preserve the correct binaries and exports across npm, pnpm, Yarn, and Bun.
   - **Builds on:** Slice `identity-complete-prisma7`'s release-ready package behavior and public surface.
   - **Hands to:** A releasable compatibility package, deterministic mirroring/order contract, and package-manager evidence suitable for the first real `prisma7` publication.
   - **Focus:** Version rewriting, unscoped dependency modeling, publish ordering and retry/idempotency, publication selection, packed-artifact inspection, and the cross-package-manager acceptance matrix. It consumes release-channel decisions made elsewhere and does not define their policy. Validation must use local artifacts and pre-provisioned package managers rather than installing or fetching tools inside repository tests.

## Dependencies (external)

- [ ] **npm package name and publish authority for `prisma7`** — the public registry currently returns `E404`; ownership/reservation and Prisma's authority to publish the unscoped name must be established before the release slice can close.
- [ ] **Prisma 7 publication signal/contract** — the separate release-policy project decides when and through which channel Prisma 7 is published; this project requires a reliable fact that a specific `prisma@7` artifact was published so it can mirror that exact version.
- [ ] **Provisioned package-manager environments for release acceptance** — local design probes succeeded with npm 11.16.0, pnpm 11.13.1/11.18.0, Yarn 4.14.1, and Bun 1.3.13; the release slice must place equivalent checks where those tools are already provisioned, without network installation inside tests.

## Sequencing rationale

The wrapper and identity transport are one coherent first boundary: an identity abstraction without a runnable alternate distribution would be preparation rather than a valuable slice, while a wrapper without the identity seam cannot meet even its package/version/config contract. Exhaustive identity propagation then builds on an executable `prisma7`, allowing reviewers to evaluate all changed output against a real invocation while the package remains unpublished. Publication is last because the spec forbids exposing a half-branded artifact, and its ordering/recovery tests need the final package manifest and packed surface. No slices can safely run in parallel without either duplicating the package contract or creating a path that could publish incomplete behavior.
