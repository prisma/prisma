# feat(prisma7): add side-by-side CLI wrapper

## Overview

Add an unpublished `prisma7` compatibility package that runs the exact matching Prisma 7 CLI alongside a direct Prisma dependency, without copying CLI implementation or assets. A small CLI distribution-identity seam lets the wrapper select its identity while ordinary `prisma` invocations retain their existing default.

## Changes

- **CLI identity and delegation**: Add an immutable, one-shot distribution identity selected through a private marker. The CLI dispatcher initializes it before both normal and completion branches; `prisma7` forwards arguments and exit behavior to `prisma/build/index.js` through its declared dependency.
- **Wrapper package surfaces**: Add the buildable `prisma7` workspace package with an exact same-version packed Prisma dependency, `prisma7` binary, root type forwarding, and `prisma7/config` runtime/type forwarding. The package contains only wrapper outputs and remains private/unpublished.
- **Contract coverage**: Add identity, delegation, emitted-dispatcher, packed-manifest, side-by-side resolution, and forwarded-type tests, and register the package in the repository test jobs.

## Why

Keeping `prisma@7` as the sole implementation avoids divergent CLI behavior and duplicated engines while giving package managers a declared dependency edge to resolve. The packed-package fixture verifies that a direct root Prisma can remain separate from the wrapper's Prisma dependency, and the built-dispatcher test protects the identity initialization from bundler tree-shaking.

## Scope

This slice intentionally does not yet provide exhaustive `prisma7` branding across help, warnings, initialization, generated output, completion guidance, version/update handling, or update-prompt suppression. It also does not add release mirroring, publish ordering/recovery, release-channel policy, or the full cross-package-manager acceptance matrix; those belong to later slices. The artifact remains unpublished.
