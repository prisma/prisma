## Sources

- Commit range: `cf2bc1f4b2...b949a1b9f5`
- Project intent: [projects/prisma7-config/spec.md](projects/prisma7-config/spec.md)
- Review ledger: [projects/prisma7-config/reviews/code-review.md](projects/prisma7-config/reviews/code-review.md)

## Intent

Let Prisma 7 and Prisma 8 coexist without competing for the same automatically discovered config file. Prisma 7 gains the canonical root filename `prisma7.config.ts` while preserving existing `prisma.config.*` projects as a quiet compatibility path.

## Change map

- **Config selection and loading**:
  - [packages/config/src/loadConfigFromFile.ts](packages/config/src/loadConfigFromFile.ts)
  - [packages/config/src/index.ts](packages/config/src/index.ts)
- **Bootstrap parity**:
  - [packages/cli/src/bootstrap/project-state.ts](packages/cli/src/bootstrap/project-state.ts)
- **Init and guidance**:
  - [packages/cli/src/Init.ts](packages/cli/src/Init.ts)
  - [packages/internals/src/cli/completion-values.ts](packages/internals/src/cli/completion-values.ts)
  - [packages/internals/src/cli/getSchema.ts](packages/internals/src/cli/getSchema.ts)
  - [packages/migrate/src/**tests**/config-guidance.test.ts](packages/migrate/src/__tests__/config-guidance.test.ts)
- **Tests as evidence**:
  - [packages/config/src/**tests**/loadConfigFromFile.test.ts](packages/config/src/__tests__/loadConfigFromFile.test.ts)
  - [packages/cli/src/bootstrap/**tests**/project-state.vitest.ts](packages/cli/src/bootstrap/__tests__/project-state.vitest.ts)
  - [packages/cli/src/**tests**/Init.vitest.ts](packages/cli/src/__tests__/Init.vitest.ts)
  - [packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts](packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts)

## The story

1. Define one narrow Prisma 7 discovery order: root `prisma7.config.ts`, then the existing c12-backed legacy search. Alternate versioned extensions and `.config/` variants are not added.
2. Make the selected versioned file authoritative. Only absence reaches legacy discovery; a broken versioned config reports its own path and error instead of silently loading another contract.
3. Teach bootstrap the same exact root filename without importing project code. Project detection and seed inspection prefer `prisma7.config.ts` over their existing root `prisma.config.ts` fallback.
4. Teach the new convention everywhere a user creates or is directed to a concrete default file. Both CLI identities generate `prisma7.config.ts`, while retaining their respective config-package imports.
5. Verify the contract at the installed-package boundary through both Prisma 7 entrypoints, rather than relying only on loader unit tests.

## Behavior changes & evidence

- **The exact Prisma 7 filename takes precedence**: automatic discovery checks only root `prisma7.config.ts` before legacy candidates. Explicit config paths still win, and paths declared inside the versioned file remain relative to that file.
  - **Why**: Prisma 7 needs an independent default without broadening the requested convention into an alternate extension/location family.
  - **Implementation**:
    - [packages/config/src/loadConfigFromFile.ts](packages/config/src/loadConfigFromFile.ts)
  - **Tests**:
    - [packages/config/src/**tests**/loadConfigFromFile.test.ts](packages/config/src/__tests__/loadConfigFromFile.test.ts)

- **Fallback is absence-only and quiet**: a selected versioned file that cannot load or validate now hard-fails with that file's attribution. When no versioned candidate exists, legacy `prisma.config.*` discovery continues without a new warning; when neither family exists, the default config remains unchanged.
  - **Why**: falling through after a versioned-file error could conceal a migration problem by loading a potentially different Prisma 8 contract, while warning on normal legacy use would disrupt backward-compatible automation.
  - **Implementation**:
    - [packages/config/src/loadConfigFromFile.ts](packages/config/src/loadConfigFromFile.ts)
  - **Tests**:
    - [packages/config/src/**tests**/loadConfigFromFile.test.ts](packages/config/src/__tests__/loadConfigFromFile.test.ts)
    - [packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts](packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts)

- **Bootstrap recognizes the same exact filename without executing config**: project-state detection and seed inspection check root `prisma7.config.ts` before their existing root `prisma.config.ts` fallback, while `package.json` remains the first source for seed commands.
  - **Why**: bootstrap must recognize the newly generated filename and inspect seed metadata from the higher-precedence file without executing arbitrary project config.
  - **Implementation**:
    - [packages/cli/src/bootstrap/project-state.ts](packages/cli/src/bootstrap/project-state.ts)
  - **Tests**:
    - [packages/config/src/**tests**/loadConfigFromFile.test.ts](packages/config/src/__tests__/loadConfigFromFile.test.ts)
    - [packages/cli/src/bootstrap/**tests**/project-state.vitest.ts](packages/cli/src/bootstrap/__tests__/project-state.vitest.ts)

- **New projects and concrete guidance use `prisma7.config.ts`**: `prisma init` and `prisma7 init` write only the versioned filename. Generated contents continue to import from `prisma/config` or `@prisma/prisma7/config` according to CLI identity, and completion, Studio/Validate examples, schema errors, migrate help, seed instructions, and initialization output point to the same filename. Generic references remain “Prisma config file.”
  - **Why**: generated files and guidance must advertise the filename runtime discovery actually prefers.
  - **Implementation**:
    - [packages/cli/src/Init.ts](packages/cli/src/Init.ts)
    - [packages/cli/src/Studio.ts](packages/cli/src/Studio.ts)
    - [packages/cli/src/Validate.ts](packages/cli/src/Validate.ts)
    - [packages/internals/src/cli/completion-values.ts](packages/internals/src/cli/completion-values.ts)
    - [packages/internals/src/cli/getSchema.ts](packages/internals/src/cli/getSchema.ts)
    - [packages/migrate/src/commands/DbSeed.ts](packages/migrate/src/commands/DbSeed.ts)
  - **Tests**:
    - [packages/cli/src/**tests**/Init.vitest.ts](packages/cli/src/__tests__/Init.vitest.ts)
    - [packages/cli/src/completions/completion-command.test.ts](packages/cli/src/completions/completion-command.test.ts)
    - [packages/migrate/src/**tests**/config-guidance.test.ts](packages/migrate/src/__tests__/config-guidance.test.ts)

- **The packed distribution proves both entrypoints share the contract**: the compatibility E2E runs precedence, versioned-file failure, exact quiet legacy fallback, and init assertions through installed `.bin/prisma7` and the packed transitive `prisma/build/index.js` entry. It also checks each identity's generated import while preserving the existing generated-client smoke coverage.
  - **Why**: source-level tests alone cannot prove package topology and both shipped entrypoints expose the same behavior.
  - **Tests**:
    - [packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts](packages/client/tests/e2e/prisma7-compatibility/tests/main.test.ts)

## Compatibility / migration / risk

- Existing projects that only contain `prisma.config.*` need no rename and receive no new fallback warning; the installed E2E locks the existing loaded-file diagnostic exactly.
- An explicit `--config` path remains authoritative regardless of filename.
- A present but invalid root `prisma7.config.ts` intentionally blocks legacy fallback. Fix or remove that file to resume legacy discovery.
- Alternate versioned extensions and `.config/` variants are not automatically discovered; explicit `--config` remains available for custom paths.
- The review ledger records all 12 acceptance criteria as passing with no open findings, backed by the linked loader, bootstrap, init/guidance, and packed E2E tests.

## Non-goals / intentionally out of scope

- Prisma 8 config parsing, validation, or discovery behavior.
- Config conversion, merging, synchronization, or deprecation warnings.
- Changes to explicit `--config` semantics or unrelated Prisma filenames and terminology.
