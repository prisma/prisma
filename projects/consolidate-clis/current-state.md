# CLI consolidation — current state inventory

Surveyed 2026-08-05 from fresh clones (`wip/repos/` in the planning worktree, not committed). Corrects several details from the kickoff Slack notes — the real config filenames differ from the ones listed there.

## The CLIs

| CLI (Slack name) | npm package | bin | Repo | Framework / runtime | Config file | Programmatic seam today |
| --- | --- | --- | --- | --- | --- | --- |
| `prisma-next` | `prisma-next` → `@prisma/orm-toolchain` | `prisma-next` | prisma/prisma (this repo) | commander + clipanion (migration-cli), Node ≥24 | `prisma-next.config.ts` | **Yes**: `ControlClient` via `createControlClient()`, exported as `@prisma/orm-toolchain/cli/control-api`. Partially clean (gaps below) |
| `@prisma/cli` (Compute) | `@prisma/cli` | `prisma-cli` (program name is already `prisma`) | prisma/prisma-cli | commander v14, Node ≥22.13 | `prisma.compute.ts` / `.json` (contract lives in `@prisma/compute-sdk/config`, not the CLI repo) | **No**: package exports only `./package.json`. `runCli()` is injectable but unexported. Core logic sits in 5k-line controllers mixed with presentation |
| `prisma-composer` | `@prisma/composer` | `prisma-composer` | prisma/composer | clipanion, Node ≥24 (bun-friendly) | `prisma-composer.config.ts` | **Designed but absent**: `@internal/assemble` is deliberately CLI-free ("the future programmatic deploy API is its second consumer") but that API doesn't exist. Deploy shells out to the `alchemy` bin |
| `prisma` (classic ORM) | `prisma` | `prisma` | Prisma 7 lineage; per [ROADMAP §5](../../ROADMAP.md) this repo takes over the `prisma` npm name for Prisma 8 | — | `prisma.config.ts` (Prisma 7 `defineConfig` from `prisma/config`) | — |
| `create-prisma` | `create-prisma` | `create-prisma` | prisma/create-prisma | trpc-cli/oRPC, Bun-built, runs on Node ≥18 | n/a (generates configs) | Excluded from consolidation, but coupled: shells out to `npx @prisma/cli@latest app deploy` and generates `prisma.config.ts` (Prisma 7 flavor) + `prisma.compute.ts` |

Two more codebases matter:

- **prisma/prisma-cli-tmp** — Luan's dormant "Unified Prisma CLI" prototype (`@looma/prisma-cli`, last commit 2026-05-05). The implementation is a Compute-only MVP, but `docs/product/vision.md` and the ~1360-line `docs/product/command-spec.md` are a written spec for the unified command language: `prisma <group> <action>`, groups organized by workflow, **no product namespaces** (`orm`/`postgres`/`compute` forbidden), long-term groups `init, auth, project, env, schema, database, migrate, app`. The most valuable salvageable artifact.
- **prisma/project-compute** — active (commits today). Home of `@prisma/compute-sdk` (which owns the compute config contract and the heavy deploy machinery) plus a third Compute CLI entry point under `cli/` (`@prisma/compute-cli`, bin `compute`). Upstream of any Compute consolidation, not legacy.

## Config file reality

The Slack notes list `compute.config.ts`, `prisma-next.config.ts`, `prisma.config.ts`, `composer.config.ts`. Actual filenames in the wild:

- `prisma-next.config.ts` — this repo. c12 + arktype (`PrismaNextConfigSchema`). ROADMAP §6 already counts **894 occurrences across 333 files** and flags the rename as pre-RC work.
- `prisma.compute.ts` / `prisma.compute.js/.mjs/.json` — Compute. Contract in `@prisma/compute-sdk/config` (jiti-loaded, walk-up discovery).
- `prisma-composer.config.ts` — Composer. c12 + hand-rolled validation; the one file allowed to import `/control` entrypoints.
- `prisma.config.ts` — **already has two incompatible meanings**: Prisma 7's `defineConfig` (schema/migrations/datasource — what create-prisma generates today) and prisma-cli-tmp's project-link store (a bare `{ project: "proj_123" }` read by regex). `@prisma/cli` also probes it in agent setup-status.

All three loaders converge on c12 except Compute (jiti via the SDK). All use walk-up discovery. Validation is arktype (next), hand-rolled (composer), SDK-owned (compute).

## Seam quality per project

**prisma-next (this repo)** — closest to the target. `ControlClient` (`packages/1-framework/3-tooling/cli/src/control-api/`) exposes init/connect/verify/sign/dbInit/dbUpdate/dbVerify/migrate/introspect/emit… returning structured result documents with a progress-span callback; the CLI renders via `utils/progress-adapter.ts`. Gaps that keep the CLI from being a thin pilot:

- 14 command modules import `@internal/migration-tools` directly, bypassing the control client.
- Command modules hold real orchestration (migration-plan 963 lines, migrate 942, migration-status 716…), call `process.exit()` directly, and mix logic into `utils/` (~9.6k lines).
- Two argv stacks in one package: commander (`cli.ts`) + clipanion (`migration-cli.ts`).
- E2E tests mostly run in-process through command factories (`test/integration/test/cli-journeys/`, ~85 CLI suites), i.e. through the CLI layer, not the control client. Control-client-level tests exist but are the minority.

**Compute (@prisma/cli)** — the ignite ADR-0006 ("Dual CLI and Programmatic Interface", terminal team) describes exported `deploy()`/`ApiClient`/`TokenStorage`; the shipped package does none of that (exports only `./package.json`). The real contract already migrated to `@prisma/compute-sdk` (config, BuildStrategy, artifact staging) — the SDK is the natural control client; the CLI repo's contribution is 36k lines of commands/controllers/shell where `controllers/app.ts` (5,037 lines) mixes orchestration with user-facing copy. Tests are in-process vitest against a JSON fixture mock (`fixtures/mock-api.json`); no live-platform e2e in CI.

**Composer** — cleanest architecture docs, weakest seam in practice. Presentation is separated by convention (`DeploymentResult` + `render-deployment.ts`), and `@internal/assemble` was extracted specifically to serve a future programmatic deploy API, but today the only programmatic entry is argv-shaped `run(argv, deps)` and the deploy executes by spawning the `alchemy` bin. E2E deliberately drives the spawned binary and real Prisma Cloud in CI.

## Expensive dependencies (why "optional" matters)

- Compute: `@prisma/compute-sdk` pulls `@vercel/nft` (+ rollup peer), `jiti`, `tar-stream`, `ws`. `unbundle: true` means every user installs the full graph.
- Composer: `alchemy` (patched beta), `effect` (beta, crashes at import on mismatched resolution — there's a preflight check before any other import), `esbuild` (must stay external), `postgres`, `@effect/*`. `@prisma/composer-prisma-cloud` additionally depends on five `@prisma-next/*@0.16.0` packages and `tsdown` at runtime.
- prisma-next: `esbuild`, language server bundled into the toolchain, `prisma dev`-style emulator concerns live in composer's `@internal/dev-emulators`.

## Versioning & release today

- This repo: strict lockstep (root `package.json` 0.17.0 stamped everywhere), publish on version-bump merge, OIDC trusted publishing, `dev` dist-tag builds on every main push.
- Composer: same lockstep + trigger model (0.6.0), also OIDC.
- Compute CLI: **no committed versions** — CI computes `3.0.0-beta.N` from the npm dist-tag and injects it (ADR-0001); `dev` on every main push; git tags `cli-v<version>` are the only record.
- create-prisma: single package, `chore(release):` commit trigger, OIDC.

## Command-grammar collision map

Merging the three surfaces under one bin without product namespaces collides at:

- `database`/`db`: next has `db verify|init|update|schema|sign`; Compute has `database list|create|restore|…` + `backup` + `connection` (platform resources).
- `migrate`/`migration`: next only — but reserved in the tmp-repo spec as a workflow group.
- `deploy`: Compute `app deploy` vs composer `deploy <entry>` (whole-app, stage-based).
- `dev`: composer `dev` (emulators) vs the Prisma 7 `prisma dev` emulator connotation from the Slack notes.
- `init`: all three scaffold different things (next: contract project; compute: `prisma.compute.ts`; create-prisma: whole app).
- `env`: tmp-spec group vs Compute `project env`.
