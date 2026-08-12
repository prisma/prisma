# Slice spec: output-path-override

**Project:** [`../../spec.md`](../../spec.md)
**Linear ticket:** [TML-2664](https://linear.app/prisma-company/issue/TML-2664/mongo-feature-request-customize-generated-asset-output-path) — the slice shares the project's Linear surface; no separate slice issue.

This slice is the project's only slice. The project spec + design notes are authoritative for the *what* and *why*; this slice spec focuses on the *what-changes-where*, the edge-case map, and the slice-DoD.

# Scope

## In scope

- Add an optional `outputPath?: string` field (directory path) to `MongoConfigOptions` in `packages/3-extensions/mongo/src/config/define-config.ts`. When provided, the wrapper converts it to `join(outputPath, 'contract.json')` and passes that file path to the framework-level provider. When absent, the existing `deriveOutputPath(options.contract)` fallback runs unchanged.
- Add the same field to `PostgresConfigOptions` in `packages/3-extensions/postgres/src/config/define-config.ts`. Identical semantics.
- Add a `--output-path <dir>` flag to `prisma-next contract emit` in `packages/1-framework/3-tooling/cli/src/commands/contract-emit.ts`.
- Thread the CLI value through `packages/1-framework/3-tooling/cli/src/control-api/operations/contract-emit.ts` as `ContractEmitOptions.outputPath`. The operation performs the `join(outputPath, 'contract.json')` conversion before calling `getEmittedArtifactPaths`. CLI value takes precedence over the value read from the config.
- Path resolution: relative paths resolve against the directory containing the `prisma-next.config.ts` file when the config-file value is used. When the CLI flag is used and the value is relative, resolve against the cwd (consistent with other CLI path args).
- Unit tests for both wrappers verifying `outputPath` is converted to `<outputPath>/contract.json` and threaded into `ContractConfig.output`.
- CLI tests verifying the flag is accepted, the precedence rule (CLI > config > default) holds, the default-unchanged invariant holds, and the canonical-filename invariant holds (the user does not control the filename).
- One end-to-end / integration test (one target is sufficient) that runs `prisma-next contract emit --output-path <dir>` and asserts artifacts land at `<dir>/contract.json` and `<dir>/contract.d.ts`.
- A short documentation update covering the new knob, its default, and the precedence rule. Land it in the CLI Style Guide (the canonical home for flag-precedence rules); skip the architecture / subsystem docs (the operator pushed back on that surface as too detailed during PR review).

## Out of scope

- Any change to `@internal/sqlite` (no wrapper exists; tracked at [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-defineconfig-wrapper-at-parity-with-mongo)).
- Any change to `ContractConfig.output`'s underlying semantics or to `getEmittedArtifactPaths`. The framework-level shape stays a file path; the wrapper / CLI operation converts directory → file path at the boundary.
- Letting the user pick the emitted filenames. `contract.json` and `contract.d.ts` are canonical.
- Adding a `--output-path` flag to commands other than `contract emit` (e.g. `migrate` doesn't get one).
- Soft warnings on the user's directory choice (the file-path-era warnings — non-`.json` extension, directory-shape, source-collision — were removed in PR review along with the file-path semantics that motivated them).
- Updating existing demo / example `prisma-next.config.ts` files to *use* the new option. Keeping the existing examples on the default path is the right baseline; users discover the option via docs, not via examples.
- Modifying the `contract-space-package-layout` rule beyond an optional one-line "convention, not mandate" clarification at close-out.

# Approach

The two `defineConfig` wrappers each gain one option in their options interface and one branch of conversion logic:

```ts
export interface MongoConfigOptions {
  readonly contract: string;
  readonly outputPath?: string;  // directory
  readonly db?: { readonly connection?: string };
}

export function defineConfig(options: MongoConfigOptions): PrismaNextConfig<'mongo', 'mongo'> {
  const output = options.outputPath !== undefined
    ? join(options.outputPath, 'contract.json')
    : deriveOutputPath(options.contract);
  // rest unchanged — `output` is still a file path internally; `ContractConfig.output` is unchanged
}
```

The Postgres wrapper gets the same change against `PostgresConfigOptions`. Both wrappers continue to carry an identical inline `deriveOutputPath` helper for the absent-`outputPath` case; lifting it is a future cleanup (when TML-2677 adds a third wrapper).

The CLI flag adds an `--output-path <dir>` option that the command parses (resolving relative values against cwd) and forwards into the control-API operation as `ContractEmitOptions.outputPath`. Inside the operation, the join happens before the call to the emitter:

```ts
const effectiveOutput = outputPath !== undefined
  ? join(outputPath, 'contract.json')
  : contractConfig.output;
outputPaths = getEmittedArtifactPaths(effectiveOutput);
```

No soft warnings. The wrapper / CLI surface is the user's choice of directory; filesystem errors (e.g. permission denied, parent doesn't exist) surface naturally.

Tests follow the AGENTS.md "tests before implementation" golden rule: each dispatch starts by adding the failing tests for that dispatch's behavior, then implementing.

# Example-Mapping edge cases

Pre-named edge cases under the directory-semantics design that landed during PR review. (The earlier file-path design had additional edge cases — non-`.json` extensions, directory-shape warnings, source-file collisions — that were removed when the surface changed shape; see [`../../design-notes.md § Design pivot`](../../design-notes.md#design-pivot-file-path--directory-path) for the rationale.)

| # | Edge case | Disposition |
|---|---|---|
| 1 | `outputPath` unset; `--output-path` absent. | **Handle** — invariant I-output-1 (default behaviour byte-identical). Covered by the regression tests for the existing Mongo + Postgres fixtures. |
| 2 | `outputPath` set in config; `--output-path` absent. | **Handle** — output lands at `<outputPath>/contract.json` and `<outputPath>/contract.d.ts`. Covered by wrapper unit tests + the integration test. |
| 3 | `outputPath` unset in config; `--output-path` passed on CLI. | **Handle** — output lands at `<cli-value>/contract.json` and `<cli-value>/contract.d.ts`. Covered by CLI test. |
| 4 | `outputPath` set in config; `--output-path` also passed. | **Handle** — CLI wins (invariant I-output-4). Covered by CLI test. |
| 5 | `outputPath` is relative, config value. | **Handle** — resolves against the directory containing `prisma-next.config.ts`. Covered by wrapper unit test + integration test. |
| 6 | `outputPath` is relative, CLI value. | **Handle** — resolves against cwd (CLI convention). Covered by CLI test using `pathjoin(process.cwd(), ...)` as the OS-agnostic assertion target. |
| 7 | `outputPath` is absolute. | **Handle** — used as-is. Covered by CLI test. |
| 8 | Output directory does not exist. | **Handle** — `mkdir -p` runs as today (FR7); no change in behavior. |
| 9 | `outputPath` traverses outside the project root (e.g. `../../tmp`). | **Explicitly out** — no hard validation; trust the user. Path-traversal blocking is a separate security concern, not part of this slice. |
| 10 | `outputPath` points inside `node_modules`. | **Explicitly out** — same rationale as #9. |
| 11 | Canonical filenames invariant — `<outputPath>/contract.json` is written regardless of the contract source filename (`schema.prisma`, `contract.prisma`, `contract.ts`, etc.). | **Handle** — invariant I-output-2 (filenames are canonical, not derived from source). Covered by an explicit wrapper unit test. |
| 12 | Wrapper called with `outputPath` but the contract is a TS-authored contract (`.ts` extension). | **Handle** — both wrappers already special-case `.ts` and route to `typescriptContractFromPath(options.contract, output)`. The `output` file path the wrapper computes (`<outputPath>/contract.json`) threads through the same provider call. Covered by wrapper unit test. |

# Slice DoD

- [ ] **SDoD1.** All in-scope edge cases (#1-8, #11-12) handled with corresponding tests; #9-10 explicitly documented as out-of-scope (no test required).
- [ ] **SDoD2.** Unit tests for both wrappers green: `pnpm --filter @internal/mongo test` and `pnpm --filter @internal/postgres test`.
- [ ] **SDoD3.** CLI tests green covering the flag, the precedence rule, the default-unchanged invariant, and the OS-agnostic assertion of resolved relative-path values.
- [ ] **SDoD4.** End-to-end / integration test green confirming `--output-path <dir>` produces `<dir>/contract.json` and `<dir>/contract.d.ts`.
- [ ] **SDoD5.** `pnpm fixtures:check` clean — no fixture drift introduced.
- [ ] **SDoD6.** `pnpm lint:deps` clean.
- [ ] **SDoD7.** `pnpm typecheck` clean across the workspace.
- [ ] **SDoD8.** `pnpm build` clean.
- [ ] **SDoD9.** `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e` all green.
- [ ] **SDoD10.** No `any`, no `@ts-expect-error` outside negative type tests, no biome suppressions added.
- [ ] **SDoD11.** All path manipulation uses `pathe`, not `node:path` (per `.cursor/rules/use-pathe-for-paths.mdc`).
- [ ] **SDoD12.** Documentation update landed in the chosen surface.
- [ ] **SDoD13.** Reviewer subagent reports `SATISFIED` per `drive-build-workflow`.
- [ ] **SDoD14.** Manual-QA: emit a fixture contract twice, once with the default path and once with `--output-path ./tmp-out`, and confirm both produce byte-identical JSON content at the respective paths (`./tmp-out/contract.json` for the override run). Land the run as a `wip/manual-qa-output-path-override.md` note (gitignored).

# References

- Project spec: [`../../spec.md`](../../spec.md)
- Project design notes: [`../../design-notes.md`](../../design-notes.md)
- Project plan: [`../../plan.md`](../../plan.md)
- Linear ticket: [TML-2664](https://linear.app/prisma-company/issue/TML-2664/mongo-feature-request-customize-generated-asset-output-path)
- SQLite follow-up: [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-defineconfig-wrapper-at-parity-with-mongo)
- Reference implementations (Mongo + Postgres current state):
  - `packages/3-extensions/mongo/src/config/define-config.ts`
  - `packages/3-extensions/postgres/src/config/define-config.ts`
