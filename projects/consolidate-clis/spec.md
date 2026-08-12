# Consolidate the Prisma CLIs — spec

Status: direction agreed (Will/Luan, 2026-08-05). The consolidated command tree is settled: [cli-consolidation-plan.md](./cli-consolidation-plan.md) is the normative grammar (Luan's design plus the agreed corrections, the `db`/`postgres` split, and `migrate` moving under `db`). Will owns implementation. Inventory and evidence: [current-state.md](./current-state.md).

## Problem

We ship four user-facing CLIs (`prisma`, `prisma-next`, `prisma-cli` from `@prisma/cli`, `prisma-composer`) plus the `create-prisma` scaffolder, each with its own config file. Users and agents have to know which binary and which file belongs to which product. We want one CLI and one config file before launch.

## Goals

1. One CLI: the `prisma` npm package and `prisma` command, implementing the consolidated command tree. `create-prisma` stays separate.
2. One config file: `prisma.config.ts` with a versioned `defineConfig` marker. Compatibility with the existing per-product config files is deliberately broken; no aliasing window.
3. Users are not forced into expensive dependencies they don't use. Realized two ways: the CLI never builds the user's app (which removes the entire Compute build graph — `@vercel/nft`, rollup, `jiti`), and the dev emulator ships as the optional `@prisma/dev` package.
4. No package management: the CLI never installs anything itself, never builds the user's app. A missing optional package produces a structured error whose remediation is an install command.
5. Product teams iterate in their own repos; the host picks up their releases through cheap, automated dependency-bump releases.
6. Every product can e2e test itself inside its own repo, with no circular dependency on the CLI package.

## Scope

The unified CLI implements the consolidated tree: Prisma 8's data lifecycle (`contract`, `migration`, `db`), platform resource administration (`postgres`, `app`, `bucket`, `branch`, `auth`), and Project orchestration (`project`), which is Composer absorbed — there is no composer-named command surface.

The Compute CLI's build phase is dropped. Two principles adopted from Composer/Prisma 8:

- **We never build your app for you.**
- **We never do package management.**

`prisma.compute.ts` is superseded by the composer-derived config; migrating users off it (and Composer/Compute capability parity generally) is Terminal's independent effort, not this project. Luan's target-experience doc is likewise his project — it is our grammar reference, not our requirements list.

### Launch scope

- **Launch**: the consolidation itself. Host package in prisma/prisma-cli, all existing command surfaces ported onto the new tree, unified config with the versioned marker, `project dev`/`project deploy` at the level Composer's programmatic API can deliver. Where a control client doesn't exist yet, the port stubs it and the stub is replaced as the real one lands (Composer is the known case).
- **Post-launch, not ours**: the doc's new semantics — plan/receipt discipline, `adopt`/`detach`, referenced resources, the external state backend, `branch` lifecycle beyond `list`.

## Settled design

### Thin host + control clients

- **Host** — the `prisma` package, living in the prisma/prisma-cli repo. Owns argv parsing, the command registry, config discovery/loading, help, structured output/error conventions, telemetry, and all command wiring/rendering.
- **Control clients** — each product's programmatic API, in the product's repo, published from there. Prisma 8's `ControlClient` (`@prisma/orm-toolchain/cli/control-api`) exists and is the template. Composer builds the equivalent over `@internal/assemble`; until it lands the host stubs it. Command implementations pilot control clients and hold no business logic.
- **Packaging: bundle by default, optional by exception.** The host takes ordinary pinned dependencies on `@prisma/orm-toolchain` and `@prisma/composer`. Neither is large enough to warrant splitting once the build machinery is gone. The one optional package is **`@prisma/dev`** (the emulator), loaded by `project dev`, which errors with the install remediation when absent. Optionality remains available as a tool for future egregiously large packages, not as the architecture.
- Platform resource commands (`postgres`, `app`, `bucket`, `auth`, remote `project`) wire directly to `management-api-sdk` in the host — light, no product package involved.

### Config file

One `prisma.config.ts`, value imports preserved:

- A versioned `defineConfig` from the Prisma 8 SDK marks the file as a Prisma 8 config; a classic (v7) file with the same name is detected and produces a recognizable error, never a misparse.
- The host owns discovery and loading (c12 walk-up); each product owns its section's schema and validation.
- **Evaluating the config never errors.** It always yields a meaningful result, even an invalid one:
  1. Product config entrypoints do not throw at import time; environment/version checks (e.g. Composer's effect-resolution preflight) surface as diagnostics, not import crashes. Heavy imports are fine — a config only imports the products its author uses, so nobody pays for a product they don't have.
  2. Descriptor factories and `defineConfig` never throw — bad input yields a value carrying its own invalidity.
  3. Validation is a result, not an exception: per-section diagnostics; commands that need a section with diagnostics fail with them, everything else runs.
- Gap analysis: Prisma 8's loader flips from throw-on-invalid to return-with-diagnostics. Composer's validator stops throwing per field, and its effect preflight becomes a diagnostic; its config imports otherwise stay as they are.

### Versioning

- The host versions independently with ordinary pinned dependencies on the product packages. Product releases reach users via automated dependency-bump host releases; that automation is part of the host MVP.
- No runtime version checks. The only runtime check is existence of `@prisma/dev` when `project dev` runs.

### Testing

- Products e2e test their control clients in-repo against real backends; no product test imports the host.
- The host tests parse/dispatch/render against control-client test doubles exported by the products (plus its own stub where the real client doesn't exist yet), and a real-package smoke suite.
- A host conformance suite enforces the config contract per product entrypoint (no import-time side effects, factories don't throw).

## Open questions

- **Compute-without-Composer path**: do users who consume Compute but not Composer keep a dedicated deployment path? One shape: retain product-specific CLIs (`prisma-composer`, `prisma-next` (or `prisma-orm`), `prisma-compute`) as supported side doors while `prisma` is the public normal path. If side doors survive, they must be thin wrappers over the same host machinery and config file.
- **`prisma` npm takeover sequencing** (ROADMAP §5): dist-tag/major scheme for the host claiming the `prisma` name, and what Prisma 7 users encounter.
- **Deprecation window** for the `prisma-next`, `prisma-cli`, `prisma-composer` binaries relative to launch.

## Acceptance criteria

1. `npm i prisma && npx prisma --help` shows the consolidated tree; every ported command works with zero extra installs, except `project dev` without `@prisma/dev`, which prints the structured install error.
2. No command builds the user's app or installs packages; deploy-adjacent commands operate on prebuilt artifacts or delegate to orchestration.
3. One `prisma.config.ts` drives an example app using the ORM and orchestration together; a config with an invalid section still runs commands that don't need it; a v7-shaped file produces the recognizable classic-config error.
4. Each product repo's CI is green with no dependency on the host; the host repo's CI is green using published product packages and test doubles.
5. A product ships a change with no manual host work — the dependency-bump release automation picks it up.
