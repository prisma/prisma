## Sources

- Commit range: `origin/v7...HEAD`
- Branch: `prisma7-cli-identity`
- Intent: [slice spec](projects/prisma7-compatibility-cli/slices/cli-owned-distribution-identity/spec.md), [slice plan](projects/prisma7-compatibility-cli/slices/cli-owned-distribution-identity/plan.md)
- Parent context: [project spec](projects/prisma7-compatibility-cli/spec.md), [project plan](projects/prisma7-compatibility-cli/plan.md)
- Review closure: [code review](projects/prisma7-compatibility-cli/reviews/code-review.md)

## Intent

Complete the CLI-owned half of `prisma7` identity so every user-actionable surface owned by `packages/cli` says `prisma7` under the compatibility wrapper while ordinary `prisma` behavior stays intact. The slice stops at the `packages/cli` ownership boundary: lower-layer migrate, internals, and generator guidance remain a follow-up, and release work remains later-slice scope.

## Change map

- **Implementation**:
  - [packages/cli/src/bin.ts](packages/cli/src/bin.ts) — around lines 100-132 thread one `CliDistributionIdentity` value into the CLI-owned command graph.
  - [packages/cli/src/CLI.ts](packages/cli/src/CLI.ts) — around lines 59-178 switch top-level help, delegated help, rename errors, and update gating to the selected executable.
  - [packages/cli/src/Init.ts](packages/cli/src/Init.ts) — around lines 236-274 and 611-717 generate `prisma7/config`, identity-aware env comments, and next-step commands while keeping Prisma domain paths stable.
  - [packages/cli/src/bootstrap/completion-output.ts](packages/cli/src/bootstrap/completion-output.ts) — around lines 60-95 and [packages/cli/src/postgres/link/completion-output.ts](packages/cli/src/postgres/link/completion-output.ts) — around lines 15-31 keep bootstrap and postgres-link guidance on the selected executable.
  - [packages/cli/src/Version.ts](packages/cli/src/Version.ts) — around lines 72-90, [packages/cli/src/utils/global-local-version-mismatch.ts](packages/cli/src/utils/global-local-version-mismatch.ts) — around lines 33-115, and [packages/cli/src/Generate.ts](packages/cli/src/Generate.ts) — around lines 225-252 relabel version and mismatch diagnostics.
  - [packages/cli/src/completions/Completions.ts](packages/cli/src/completions/Completions.ts) — around lines 44-83 and [packages/cli/src/completions/completion-entry.ts](packages/cli/src/completions/completion-entry.ts) — lines 1-4 keep shell setup and the separate completion bundle on `prisma7`.
  - [packages/cli/src/SubCommand.ts](packages/cli/src/SubCommand.ts) — around lines 177-180 fixes the last CLI-owned Deno rerun guidance escapee.
- **Tests (evidence)**:
  - [packages/cli/src/**tests**/distribution-identity-help.test.ts](packages/cli/src/__tests__/distribution-identity-help.test.ts) — around lines 51-114 cover top-level, delegated, unknown-command, and error-help identity behavior.
  - [packages/cli/src/**tests**/distribution-identity-project-creation.vitest.ts](packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts) — around lines 221-344 cover `prisma7/config`, init/bootstrap/postgres-link guidance, and stable-domain negatives.
  - [packages/cli/src/**tests**/distribution-identity-version-mismatch.vitest.ts](packages/cli/src/__tests__/distribution-identity-version-mismatch.vitest.ts) — around lines 60-149 cover text/JSON version labels plus mismatch warnings.
  - [packages/cli/src/completions/completion-command.test.ts](packages/cli/src/completions/completion-command.test.ts) — around lines 90-143 cover shell setup output and separate-bundle inference.
  - [packages/cli/src/**tests**/commands/SubCommand.vitest.ts](packages/cli/src/__tests__/commands/SubCommand.vitest.ts) — around lines 129-147 cover Deno rerun guidance.
  - [packages/cli/src/**tests**/distribution-identity-update-check.test.ts](packages/cli/src/__tests__/distribution-identity-update-check.test.ts) — around lines 49-84 prove zero checkpoint calls and zero update-print calls for `prisma7`.
  - [packages/client/tests/e2e/prisma7-compatibility/\_steps.ts](packages/client/tests/e2e/prisma7-compatibility/_steps.ts) — around lines 9-44 prove the packed help/version/completion/init surfaces while retaining generate, `db push`, and client smoke.
  - [projects/prisma7-compatibility-cli/reviews/code-review.md](projects/prisma7-compatibility-cli/reviews/code-review.md) — around lines 20-30 records the final literal audit and slice satisfaction.

## The story

1. **Keep identity transport minimal inside the CLI shell.** The branch does not introduce a new branding object or global transport. It reuses the settled `'prisma' | 'prisma7'` primitive and threads that one value from `bin.ts` into the CLI-owned constructors and renderers.
2. **Move CLI-owned user guidance onto the selected executable.** Help text, project-creation flows, shell-completion setup, and CLI-owned rerun/install instructions now all derive from the selected identity, so the compatibility wrapper presents a coherent `prisma7` shell instead of a runnable wrapper with ordinary-`prisma` copy.
3. **Fix diagnostics and control flow, not just strings.** Version tables, JSON output, mismatch warnings, and Deno rerun guidance now label the selected package, and the update path is gated before checkpoint request creation so `prisma7` never consults the Prisma 8 line.
4. **Close the slice with installed-artifact proof and an audit boundary.** One packed client E2E now proves the shipped wrapper plus the CLI-owned identity surfaces together, and the review ledger classifies the remaining `prisma` literals so the only follow-up work is the intentionally deferred downstream guidance and release slices.

## Behavior changes & evidence

- **CLI-owned help and top-level command surfaces now speak the selected executable**: top-level help, delegated help, unknown-command guidance, and rename errors render `prisma7` under the compatibility invocation instead of hardcoded `prisma`.
  - **Why**: the wrapper was already runnable; this slice makes the CLI shell consistent with that entrypoint without changing lower-package behavior.
  - **Implementation**:
    - [packages/cli/src/bin.ts](packages/cli/src/bin.ts) — around lines 100-132 construct the CLI-owned command graph with one selected identity.
    - [packages/cli/src/CLI.ts](packages/cli/src/CLI.ts) — around lines 59-178 use that identity in help and `lift` rename output.
  - **Tests**:
    - [packages/cli/src/**tests**/distribution-identity-help.test.ts](packages/cli/src/__tests__/distribution-identity-help.test.ts) — around lines 55-114 exercise top-level help, `validate --help`, unknown-command paths, and error wrappers for both identities.

- **Project creation now generates compatibility-facing config and next-step guidance without renaming Prisma domain surfaces**: `prisma7 init` emits `prisma7/config`, `prisma7` dev/migrate/studio/bootstrap guidance, and identity-aware env comments, while domain-stable names such as `prisma/schema.prisma`, `prisma.config.ts`, and `@prisma/client` stay unchanged.
  - **Why**: users need the compatibility executable name wherever the CLI owns actionable guidance, but the project intentionally does not rename Prisma product terminology or file conventions.
  - **Implementation**:
    - [packages/cli/src/Init.ts](packages/cli/src/Init.ts) — around lines 236-274 swap the config import/package surface; around lines 617-717 carry identity through `.env` insertion and init next steps.
    - [packages/cli/src/bootstrap/completion-output.ts](packages/cli/src/bootstrap/completion-output.ts) — around lines 67-91 and [packages/cli/src/postgres/link/completion-output.ts](packages/cli/src/postgres/link/completion-output.ts) — around lines 20-30 keep bootstrap and link completion guidance on the selected executable.
    - [packages/cli/src/init/ppg-output.ts](packages/cli/src/init/ppg-output.ts) — around lines 41-87 switch Prisma Postgres init follow-up commands to `prisma7`.
  - **Tests**:
    - [packages/cli/src/**tests**/distribution-identity-project-creation.vitest.ts](packages/cli/src/__tests__/distribution-identity-project-creation.vitest.ts) — around lines 221-344 assert `prisma7/config`, selected-command guidance, and stable-domain negatives.
    - [packages/client/tests/e2e/prisma7-compatibility/\_steps.ts](packages/client/tests/e2e/prisma7-compatibility/_steps.ts) — around lines 31-39 prove the packed `init` command writes `prisma7/config` from an installed tarball.

- **Version, mismatch, completion, and rerun diagnostics now stay on `prisma7`**: text/JSON version output, mismatch labels, mismatch remediation, shell completion registration/reinvocation, and Deno rerun guidance all follow the selected distribution name.
  - **Why**: identity completion is incomplete if the wrapper command still tells users to run `prisma`, or reports itself as the wrong package in diagnostics.
  - **Implementation**:
    - [packages/cli/src/Version.ts](packages/cli/src/Version.ts) — around lines 72-90 replace the displayed package row/key.
    - [packages/cli/src/utils/global-local-version-mismatch.ts](packages/cli/src/utils/global-local-version-mismatch.ts) — around lines 33-115 compare the selected CLI package and recommend `npx <identity> generate`.
    - [packages/cli/src/Generate.ts](packages/cli/src/Generate.ts) — around lines 225-252 and 349-383 pass the selected identity through warning/help rendering.
    - [packages/cli/src/completions/Completions.ts](packages/cli/src/completions/Completions.ts) — around lines 44-83 and [packages/cli/src/completions/completion-entry.ts](packages/cli/src/completions/completion-entry.ts) — lines 1-4 keep completion setup and the separate bundle aligned.
    - [packages/cli/src/SubCommand.ts](packages/cli/src/SubCommand.ts) — around lines 177-180 fix the Deno rerun guidance.
  - **Tests**:
    - [packages/cli/src/**tests**/distribution-identity-version-mismatch.vitest.ts](packages/cli/src/__tests__/distribution-identity-version-mismatch.vitest.ts) — around lines 62-149 cover version text/JSON, mismatch lookup, and generate warning labels.
    - [packages/cli/src/completions/completion-command.test.ts](packages/cli/src/completions/completion-command.test.ts) — around lines 90-143 cover fish/bash/zsh/powershell output plus separate-bundle inference.
    - [packages/cli/src/**tests**/commands/SubCommand.vitest.ts](packages/cli/src/__tests__/commands/SubCommand.vitest.ts) — around lines 129-147 cover Deno guidance for both identities.

- **Compatibility invocations now skip update consultation entirely**: `prisma7` no longer creates the checkpoint promise at all, so it neither starts request work nor prints update guidance.
  - **Why**: the project contract is stronger than “hide the message”; `prisma7` must not consult the Prisma 8 release line in the first place.
  - **Implementation**:
    - [packages/cli/src/CLI.ts](packages/cli/src/CLI.ts) — around lines 73-98 create the checkpoint promise only for ordinary `prisma`.
  - **Tests**:
    - [packages/cli/src/**tests**/distribution-identity-update-check.test.ts](packages/cli/src/__tests__/distribution-identity-update-check.test.ts) — around lines 49-84 assert zero checkpoint calls and zero update-print calls for `prisma7`, while ordinary `prisma` still takes the existing path.
    - [projects/prisma7-compatibility-cli/reviews/code-review.md](projects/prisma7-compatibility-cli/reviews/code-review.md) — around lines 18-19 record why the focused zero-call proof remains the authoritative evidence instead of forcing synthetic packed request assertions.

- **The packed compatibility scenario now proves the CLI-owned identity surfaces in one installed workflow**: the standard client E2E adds real packed assertions for help, text/JSON version, zsh completion, and init, then keeps the prior typecheck, generate, `db push`, and generated-client smoke.
  - **Why**: the slice needs one installed-artifact proof that the wrapper and CLI-owned guidance stay aligned after packing, not just in focused unit tests.
  - **Implementation / evidence**:
    - [packages/client/tests/e2e/prisma7-compatibility/\_steps.ts](packages/client/tests/e2e/prisma7-compatibility/_steps.ts) — around lines 9-44 run `prisma7 --help`, `--version`, `complete zsh`, `init`, `generate`, and `db push` from installed tarballs.

## Compatibility / migration / risk

- Ordinary `prisma` remains the default identity and is regression-pinned by the dual-identity suites rather than being redefined by the compatibility work.
- Stable Prisma domain terminology remains unchanged. The review ledger at [projects/prisma7-compatibility-cli/reviews/code-review.md](projects/prisma7-compatibility-cli/reviews/code-review.md) around lines 24-30 explicitly classifies `@prisma/client`, `prisma-client`, `schema.prisma`, `prisma/schema.prisma`, `prisma.config.ts`, docs URLs, protocol names, and internal runtime/storage helpers as intentionally stable in this slice.
- The update suppression change is a control-flow change: `prisma7` skips checkpoint request creation rather than relying on later rendering suppression.
- The packed proof runs in the standard client E2E fixture and proves installed behavior, but it does not try to cover the later downstream identity work or release mirroring concerns.

## Follow-ups / open questions

- Propagate the selected executable name through `@prisma/migrate`, `@prisma/internals`, and generator-owned diagnostics in the planned `downstream-actionable-guidance` slice.
- Handle release mirroring, publication order/recovery, and the broader packed-release acceptance matrix in the later release slice.

## Non-goals / intentionally out of scope

- No lower-package dependency reversal or generic branding framework; this slice stays at the `packages/cli` ownership boundary.
- No renaming of Prisma product terminology, project file conventions, or stable package names such as `@prisma/client`.
- No release automation, publish-ordering, or package-publication work.
