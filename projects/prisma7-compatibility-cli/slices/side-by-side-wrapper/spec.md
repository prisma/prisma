# Slice: side-by-side-wrapper

_(Parent project `projects/prisma7-compatibility-cli/`. This slice establishes the runnable compatibility distribution that later identity and release work complete.)_

## At a glance

Add an unpublished `prisma7` workspace package that resolves and runs its exact `prisma` dependency through a `prisma7` binary, while forwarding the matching root and `prisma7/config` package APIs. The existing Prisma CLI gains the smallest immutable distribution-identity seam needed for that wrapper, with ordinary `prisma` remaining the default.

## Chosen design

`prisma@7` remains the only full CLI implementation. The wrapper owns no copied CLI bundles, engines, Wasm assets, command implementations, or preinstall logic.

```text
prisma7/build/index.js
  ├─ selects private distribution marker "prisma7"
  └─ require("prisma/build/index.js")
       ├─ complete     → nested Prisma 7 completion bundle
       └─ other args   → nested Prisma 7 CLI bundle
```

A central Prisma CLI identity module resolves an immutable identity once at startup. It consumes and removes the private marker so unrelated child processes do not inherit branding accidentally; absence of the marker resolves to the existing `prisma` identity. The marker is transport only, not a supported user configuration surface.

The wrapper declares `prisma` with workspace exact-version semantics so its packed manifest names the identical published version without a floating range. Runtime resolution always begins from the wrapper's declared dependency edge (`require`/`require.resolve`), never from a constructed `node_modules` path.

The wrapper mirrors Prisma's supported package API shape through forwarding modules:

```text
prisma7                 → matching public root/type surface from prisma@7
prisma7/config          → matching config runtime and types from prisma@7/config
prisma7/package.json    → wrapper metadata
```

This slice makes identity transport and the wrapper executable real, but deliberately leaves the exhaustive replacement of command/help/generated-output references to `identity-complete-prisma7`. The package remains unpublished.

## Coherence rationale

Identity transport and the first consuming wrapper form one rollback unit: either alone is preparation or non-functional, while together they produce a directly testable side-by-side executable and package API that one reviewer can evaluate as a single packaging boundary.

## Scope

**In:** The immutable CLI distribution identity and private one-shot selection mechanism; a new `prisma7` workspace package; its binary build, exact Prisma dependency, files/exports/types/config forwarding, and package-level tests; focused packed-install checks proving the wrapper resolves Prisma 7 while a direct root `prisma` remains a different version; regression coverage for the default Prisma identity.

**Out:** Exhaustive identity propagation through all command help, warnings, initialization templates, completion text, update handling, and snapshots; update-prompt suppression; publish graph/order/recovery and release workflow integration; release-channel policy; hiding nested dependency paths; automatic reconciliation of v7/v8 project files.

## Pre-investigated edge cases

| Edge case                                                                              | Disposition         | Notes                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A direct root `prisma@8` conflicts with the wrapper's exact `prisma@7` dependency      | Supported           | npm, pnpm, Yarn node-modules/PnP, and Bun probes all preserved the root v8 command and resolved v7 from the wrapper edge.              |
| Installing only `prisma7` under a hoisting linker exposes a top-level `prisma` command | Accepted            | npm, Yarn node-modules, and Bun hoisted the v7 dependency; preventing this is a project non-goal.                                      |
| Package managers use incompatible physical layouts                                     | Supported by design | Resolution follows the declared dependency edge and does not assume nesting; Yarn PnP is an explicit proof case.                       |
| The private marker leaks into subprocesses                                             | Prevented           | The CLI identity resolver consumes and removes it at module initialization; a newly executed `prisma7` wrapper selects it again.       |
| Completion dispatch loads a different bundle from normal CLI execution                 | Supported           | The wrapper delegates to the existing dispatcher after selecting identity, so both branches resolve identity independently at startup. |

## Slice-specific done conditions

- [ ] A packed local `prisma7` artifact has an exact same-version Prisma dependency, exposes `prisma7` and `prisma7/config`, and demonstrably resolves Prisma 7 beside a different direct root Prisma version without changing ordinary Prisma's default invocation.

## Open Questions

None.

## References

- Parent project: `projects/prisma7-compatibility-cli/spec.md`
- Project plan: `projects/prisma7-compatibility-cli/plan.md`
- Linear issue: N/A — operator-authorized project without Linear
- Existing package contract: `packages/cli/package.json`
- Existing dispatcher/build: `packages/cli/src/bin-dispatcher.ts`, `packages/cli/helpers/build.ts`
