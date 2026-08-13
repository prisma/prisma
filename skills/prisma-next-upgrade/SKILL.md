---
name: prisma-next-upgrade
description: >-
  Upgrade Prisma Next in your app. Bumps every `@internal/*` dependency
  from the version pinned in the lockfile to the requested target (or npm
  `latest`), applies any required code-translation steps from the
  per-transition upgrade instructions, validates with the project's own
  typecheck + tests, and commits each minor step on its own. Use when the
  user asks to "upgrade Prisma Next", "bump Prisma Next", "move to Prisma
  Next X.Y", or asks an agent to deal with an `@internal/*` minor bump
  in their app.
---

# Upgrade Prisma Next (user app)

This skill upgrades a project that **consumes** Prisma Next via the public package API (`@internal/postgres`, `@internal/mongo`, the contract files in `prisma/`, etc.). If the project is itself a Prisma Next *extension*, use the `prisma-8-extension-upgrade` skill instead — or both, if the repo contains both an app and an extension package.

## Step 0 — Ensure the skill is up to date

Before anything else, ensure this skill is installed at `@latest` and reload it. Bug fixes to *old* per-transition upgrade instructions ship in the latest skill release as part of its cumulative set; running against a stale skill can apply a known-broken translation.

If the agent runtime supports an in-session refresh, perform it now. Otherwise, exit and ask the user to re-install (`pnpm dlx skills add prisma/prisma/skills --skill prisma-next-upgrade -y`), then re-invoke. The upgrade-skill install is intentionally unpinned (always `main`) — the cumulative instruction set is the source of truth, and the latest release fixes apply to every prior transition.

## Pre-flight — extension compatibility

Before changing any code, refuse to upgrade past any installed extension's pinned Prisma Next version. Extensions in Prisma Next pin every `@internal/*` dependency to a single exact version (no carets, no ranges); that pin is the highest version the extension has been validated against. Upgrading the user app past that pin would silently desynchronise the extension's type identity from the app's.

Steps:

1. **Read `prisma.config.ts`** (or its TS-discoverable equivalent at the project root) and enumerate the list of extension packages it imports. Each `extensions: [...]` entry corresponds to an installed npm package.
2. **For each extension**, read its installed `package.json` from `node_modules/<extension-package-name>/package.json` and find any `@internal/*` entry under `dependencies`, `peerDependencies`, or `optionalDependencies`. By construction those entries are exact-version pins (e.g. `"0.7.0"`), set when the extension author last ran their own upgrade.
3. **Compute the lowest pinned version across all extensions.** That is the highest Prisma Next version reachable by this app on its current extension set.
4. **Compare to the user's target.** If the target exceeds the lowest pin, halt with a structured message naming each lagging extension and its pinned version, and offer two paths:
   - (a) Wait for the lagging extension to publish a compatible release, then re-run.
   - (b) Re-run with `--to=<highest-reachable>` (or whatever flag/option the user is using to set the target).

Do not auto-downgrade the target; do not skip the lagging extension; do not bump past it. If the user explicitly overrides the halt, surface the risk clearly first.

If `prisma.config.ts` is absent or names no extensions, skip the pre-flight.

## Role detection

This skill applies when the project **consumes** Prisma Next:

- `package.json` declares one or more `@internal/*` packages under `dependencies` / `devDependencies`, and
- the package is *not* itself an extension (no `@internal/contract` (or other SPI) under `dependencies`/`peerDependencies`; name does not match `^@.*/extension-`; not referenced from a sibling app's `prisma.config.ts`).

If the project also matches the extension-author role, install the `prisma-8-extension-upgrade` skill (`pnpm dlx skills add prisma/prisma/skills --skill prisma-8-extension-upgrade -y`) and run **this** flow first, then that one in the same session. If detection is ambiguous, ask the user.

## Version detection

- **From-version.** Read the currently-installed Prisma Next version from `pnpm-lock.yaml` (or `package-lock.json` / `yarn.lock`) by inspecting the resolved version of any `@internal/*` package. If the lockfile shows multiple `@internal/*` packages at different minors (already broken), the **lowest** minor is the from-version.
- **To-version.** Either the version the user specified, or whatever `npm view @internal/postgres dist-tags.latest` reports. Do not assume that is a stable version: while Prisma 8 is a release candidate, `latest` tracks the newest release, `8.0.0-rc.N` included. If the user wants a stable version specifically, they must name it.

Report both back to the user before continuing.

## Transition chain

If the from-to delta spans more than one release (e.g. `0.6 → 0.8`), build the chain of steps between them:

```text
0.6 → 0.7 → 0.8
```

The `upgrades/` directories in this package name the steps — read the chain off the directory names rather than deriving it arithmetically. Each directory is `<from>-to-<to>`. A step is one minor while the version line is stable (`0.7-to-0.8`); on the v8 release-candidate line a step is one release candidate (`8.0.0-rc.1-to-8.0.0-rc.2`), because an RC may carry breaking changes and each one needs its own translation. Moving onto the RC line from the last stable minor is a single step of its own (`0.17-to-8.0.0-rc.1`).

Apply each step in order, fully: bump, install, run instructions, validate, commit — before moving to the next. Halt the chain on the first failed step; do not skip ahead.

The chain order does not depend on which extensions are installed; the pre-flight has already established the target is reachable.

## Per-step flow

For each `(from, to)` step in the chain:

1. **Bump `@internal/*` deps.** Rewrite every `@internal/*` entry in the project's `package.json` to the exact `<to>` version (no caret, no tilde). All entries advance to the same version. Cover `dependencies` and `devDependencies`. The upgrade skill itself is delivered through `pnpm dlx skills add` and lives under `.agents/skills/prisma-next-upgrade/` (or the equivalent CLI-managed directory) — there is no `@internal/upgrade-skill` npm entry to bump.

2. **Install.** Run `pnpm install` (or the project's lockfile-managing command). The project's code is now broken against the new types — the upgrade instructions for `<from> → <to>` exist to fix it.

3. **Read the upgrade instructions.** Load `upgrades/<from>-to-<to>/instructions.md` from this skill package. Parse the YAML frontmatter and pay particular attention to its `changes[]` array.

4. **Apply each change.** For each entry in `changes[]`:
   - If the entry has a `detection` block (glob + content predicate), run it; skip the change if no files match. No `detection` → apply unconditionally.
   - If the entry names a `script:` (relative path next to `instructions.md`), invoke it from the project root: `*.ts` via `pnpm exec tsx <path>`, `*.sh` via `bash <path>`, codemods per the script's own prose. No `script` → follow the prose body directly.

   Empty `changes[]` (placeholder shape for transitions with no user-side breaking changes) is a no-op — proceed to validation.

5. **Validate.** Run `pnpm typecheck && pnpm test` (or the project's equivalent — the `scripts` field of the project's `package.json` is the discovery surface). If anything is red, halt the chain. Do **not** auto-roll-back; surface the failure to the user with the failing change's `id` (from the frontmatter), the file paths the change operated on, and the inferred remediation.

6. **Commit.** One commit per step containing the `package.json` bump, lockfile churn, and any source rewrites:

   ```text
   chore: upgrade @internal/* to <to-version>
   ```

   (Or the project's own commit-message convention.) Never squash steps. The user may squash on merge; the in-flight history must be per-step so a failed step is bisectable.

Then move on to the next step.

## When the chain is done

Report back to the user: the number of steps applied, the SHAs of the commits you made, and any open follow-ups (e.g. tests that were already red before the upgrade and still are).

## Failure surfaces

When a step fails: surface a structured error with code `PN-UPGRADE-NNNN`, the failing change's `id`, the file paths touched (or the lockfile, or the validation command), and the inferred remediation. Do not retry automatically; do not auto-roll-back. The user can revert if they want a clean slate.

If a pre-flight halt fires, do not bump anything; the project is left unchanged.
