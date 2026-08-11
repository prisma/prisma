## Overview

Complete the CLI-owned half of `prisma7` identity so the compatibility invocation now renders `prisma7` across `packages/cli` help, project creation, diagnostics, completion, and update handling while ordinary `prisma` output stays regression-pinned. This finishes the slice's D1-D6 scope on top of the already-runnable wrapper without reaching into lower packages or release automation.

## Changes

- **CLI-owned help and command wiring**: Thread the existing `'prisma' | 'prisma7'` primitive from `packages/cli/src/bin.ts` through `CLI.ts` and the CLI-owned command constructors so top-level help, delegated help, rename errors, and command examples render the selected executable instead of hardcoded `prisma`.
- **Project creation and setup guidance**: Update `Init.ts`, bootstrap output, Prisma Postgres init output, and postgres-link completion output so compatibility flows generate `prisma7/config`, recommend `prisma7` commands and package installs, and keep stable Prisma domain surfaces like `prisma/schema.prisma`, `prisma.config.ts`, and `@prisma/client` unchanged.
- **Diagnostics, completion, and update behavior**: Relabel version and mismatch warnings to the selected package, make shell completion setup and reinvocation target `prisma7`, fix the remaining CLI-owned Deno rerun guidance, and gate checkpoint work so `prisma7` never starts the Prisma 8 update consultation path.
- **Proof and slice close-out**: Add focused dual-identity suites plus one packed client E2E that proves `prisma7 --help`, text/JSON `--version`, `complete zsh`, `init`, `generate`, `db push`, and generated-client smoke from installed tarballs. The review ledger closes D1-D6 and classifies the remaining `packages/cli/src` `prisma` literals as domain-stable or internal.

## Why

The slice keeps the identity seam deliberately small: one primitive identity is threaded only through CLI-owned surfaces instead of introducing a broader branding framework or reversing package dependencies. That lets the compatibility wrapper present a self-consistent `prisma7` shell, preserves established Prisma product terminology, and enforces the stronger update-check contract that `prisma7` must not even consult the ordinary Prisma release line.

## Scope

_CLI-owned identity completion only: `packages/cli` help/examples, init/bootstrap/postgres-link guidance, version and mismatch labels, completion setup, update suppression, focused regression tests, and the packed proof. This is the CLI-owned half of identity completion; migrate/internals/generator guidance moves to `downstream-actionable-guidance`, and release mirroring/publication work remains out of scope._
