# Slice: versioned-config-coexistence

_(Parent project `projects/prisma7-config/`. This slice gives Prisma 7 an independent automatic config namespace while preserving legacy projects.)_

## At a glance

Teach the shared Prisma 7 implementation to prefer root `prisma7.config.ts`, then fall back to existing config discovery only when that exact file is absent. Land the runtime contract together with bootstrap recognition, `prisma7.config.ts` generation, user-facing guidance, and dual-entrypoint proof.

## Chosen design

`@prisma/config` owns one deterministic automatic-discovery policy:

```text
explicit --config
  └─ exact requested path

automatic discovery
  ├─ prisma7.config.ts at the project root
  └─ existing prisma.config.* / .config/prisma.* discovery
```

No alternate Prisma 7 extensions or `.config/` variants are added. Automatic discovery distinguishes “root `prisma7.config.ts` does not exist” from “that file failed”: only absence enters legacy discovery. Load, import, syntax, default-export, and config-shape failures retain the selected Prisma 7 path in diagnostics and terminate the command.

Bootstrap uses a non-executing root-file check so project-state and seed inspection prefer `prisma7.config.ts` over their existing `prisma.config.ts` fallback without importing arbitrary project code. Existing package.json seed precedence remains unchanged.

Both executable identities in this branch use this policy without identity branching. `Init` always writes `prisma7.config.ts`, retaining its existing identity-specific import (`prisma/config` or `@prisma/prisma7/config`). Shared completion and concrete default-path guidance switch to `prisma7.config.ts`; generic “Prisma config file” language and stable Prisma domain terminology remain generic.

The existing legacy loaded-file diagnostic remains the only output when fallback selects `prisma.config.*`; no warning or deprecation message is introduced.

## Coherence rationale

This is one reviewable compatibility contract: discovery, non-executing detection, generated files, guidance, and installed behavior must agree on one filename namespace. Splitting these surfaces would create an intermediate PR that either generates an undiscoverable file or silently supports a convention the CLI does not teach.

## Scope

**In:** `@prisma/config` automatic candidate selection, selected-file error attribution, and relative-path regressions; bootstrap config presence and seed selection; init file creation and output; shared completion values; concrete CLI, migrate, and internals default-config examples or actionable messages; affected fixtures and snapshots; focused config/CLI tests; packed Prisma 7 compatibility coverage proving both entrypoints share the policy.

**Out:** Prisma 8 config parsing or package behavior; config-content conversion; warnings or deprecation; explicit `--config` redesign; schema or directory renames; unrelated prose that uses “Prisma config file” generically; comments and test-only paths that do not teach a user-facing default unless touching them is needed to keep their contract accurate.

## Pre-investigated edge cases

| Edge case                                                               | Disposition                             | Notes                                                              |
| ----------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| Root `prisma7.config.ts` and a legacy config both exist.                | Select `prisma7.config.ts`.             | The exact versioned file precedes legacy discovery.                |
| Root `prisma7.config.ts` is invalid while a valid legacy config exists. | Hard-fail the Prisma 7 error.           | Falling through could load Prisma 8's incompatible contract.       |
| Root `prisma7.config.ts` does not exist.                                | Preserve legacy behavior silently.      | No new warning beyond the existing loaded-file diagnostic.         |
| An alternate versioned extension or `.config/` variant exists.          | Do not treat it as versioned discovery. | Only the requested root `prisma7.config.ts` convention is special. |
| The user supplies `--config`.                                           | Load only the explicit path.            | Filename and automatic precedence do not apply.                    |
| Commands are invoked through `prisma` rather than `prisma7`.            | Use the same Prisma 7 policy.           | Both entrypoints in this branch intentionally remain identical.    |

## Slice-specific done conditions

- [ ] A classified audit of production `prisma.config.ts` literals leaves no stale concrete Prisma 7 default-path guidance, while recording generic/domain references that intentionally remain unchanged.
- [ ] Packed or equivalent installed-command evidence proves versioned precedence, hard-failure behavior, and legacy fallback through the Prisma 7 entrypoints rather than only through loader unit tests.

## Open Questions

None.

## References

- Parent project: [`../../spec.md`](../../spec.md)
- Project plan: [`../../plan.md`](../../plan.md)
- Design notes: [`../../design-notes.md`](../../design-notes.md)
- Linear issue: N/A
- Config loader: `packages/config/src/loadConfigFromFile.ts`
- Bootstrap state: `packages/cli/src/bootstrap/project-state.ts`
- Initialization: `packages/cli/src/Init.ts`
- Completion defaults: `packages/internals/src/cli/completion-values.ts`
- Packed compatibility scenario: `packages/client/tests/e2e/prisma7-compatibility/`
