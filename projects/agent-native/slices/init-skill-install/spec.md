# Slice: init-skill-install

_(Parent project `projects/agent-native/`. Outcome: every `prisma init` project can start with
the Prisma skills installed for the major agent runtimes, with a clean opt-out.)_

## At a glance

`prisma init` gains a final scaffolding step that installs the
[prisma/skills](https://github.com/prisma/skills) catalog into the new project via the
upstream `skills` CLI, for cursor / claude-code / codex / windsurf, behind a `--no-skills`
opt-out. Introduces the shared install runner that slice `generate-skill-offer` reuses.

## Chosen design

New module `packages/cli/src/init/skill-install.ts`:

- Constants: `SKILLS_CLI_VERSION` (exact pinned version of the `skills` npm package, never
  `latest`), `SKILL_AGENTS = ['cursor', 'claude-code', 'codex', 'windsurf']`,
  `SKILLS_SOURCE = 'prisma/skills'`.
- `detectRunner(cwd)`: package-manager detection via `npm_config_user_agent`, falling back to
  lockfile sniffing in `cwd`, defaulting to npm. Maps to `npx --yes` / `pnpm dlx` /
  `yarn dlx` / `bunx` (bun detected via the existing `isBun` from `Init.ts`, hoisted or
  imported). `--yes` on the npx path is load-bearing (see edge cases).
- `installSkills({ cwd })`: assembles and executes (via `execa`, streaming output)

  ```
  <runner> skills@<SKILLS_CLI_VERSION> add prisma/skills \
    --agent cursor claude-code codex windsurf --skill '*' -y
  ```

  Returns `{ ok: true }` or `{ ok: false, manualCommand }`. **Never throws** — any failure
  (network, non-zero exit, missing runner) resolves to the failure shape.

`packages/cli/src/Init.ts` wiring:

- `--no-skills` boolean flag added to the arg spec and the `help` text.
- After file scaffolding (and after the PPG flow, when taken), unless `--no-skills`: call
  `installSkills`. On success, append the installed skill locations
  (`.claude/skills/`, `.agents/skills/`, `skills-lock.json`) to the summary output; on
  failure, print a warning with `manualCommand` and continue — init still succeeds.

Install source is the prisma/skills default branch for now; `#v<tag>` pinning activates once
the skills repo tags releases (ask filed as part of this slice — a GitHub issue on
prisma/skills requesting per-ORM-minor tags).

## Coherence rationale

One reviewable unit: a single new module plus its two consumers (Init wiring, summary output)
and tests. Nothing else changes behavior; `generate`-side reuse is deliberately a separate
slice.

## Scope

**In:** `packages/cli/src/init/skill-install.ts` (new);
`packages/cli/src/Init.ts` (flag, help text, invocation, summary);
`packages/cli/src/__tests__/skill-install.vitest.ts` (new — command assembly per package
manager, failure shape) and `packages/cli/src/__tests__/Init.vitest.ts` (integration with the
runner mocked: default path, `--no-skills`, failure is non-fatal); the tagging-ask issue on
prisma/skills.

**Out:** the `generate` offer (slice `generate-skill-offer`); any TTY/CI gating (init's
install is flag-controlled by design); user-level/global agent config; parsing or vendoring
the `skills` CLI's internals; `.gitignore` handling for skill files (they are meant to be
committed).

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --------- | ----------- | ----- |
| Bare `npx skills@x` prompts "Ok to proceed?" on first use and would hang a non-TTY init | Always pass `--yes` to npx (distinct from `-y` to `skills`) | Known npx footgun; pnpm dlx / yarn dlx / bunx do not prompt |
| `prisma init` in a directory with no `package.json` / lockfile (global CLI invocation) | `npm_config_user_agent` absent → lockfile sniff finds nothing → default npm/npx path | Must not crash detection; unit-test this case |

## Slice-specific done conditions

- [ ] A real (non-mocked) `prisma init` run in a scratch directory produces
      `.claude/skills/prisma-*/SKILL.md` and `.agents/skills/prisma-*/SKILL.md`; evidence
      (command + output) attached to the PR description.
- [ ] A simulated install failure (runner pointed at an unreachable version) leaves init
      exit-code 0 with the manual-command hint printed.
- [ ] The tagging ask is filed on prisma/skills and linked from the PR.

## Open Questions

1. Exact `SKILLS_CLI_VERSION` to pin. Working position: latest `skills` release at
   implementation time, recorded in the module with a Renovate-friendly literal.

## References

- Parent project: `projects/agent-native/spec.md`
- Linear issue: [TML-2968](https://linear.app/prisma-company/issue/TML-2968/s1-install-prisma-skills-during-prisma-init)
- Task draft: `docs/plans/agent-native/001-init-skill-install.md`
- Prior art: prisma-next `packages/1-framework/3-tooling/cli/src/commands/init/skill-install.ts`
  (deviations here: non-fatal failure, pinned `skills` version, no deno runner)
