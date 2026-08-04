# prisma-next-upgrade

An agent skill that upgrades a project consuming Prisma Next from one minor version to the next. The skill carries the per-step bump-install-instructions-validate-commit flow plus the cumulative set of per-transition *upgrade instructions* (one directory per `(from-minor, to-minor)` pair).

## Audience

This skill is for **users** of Prisma Next — projects that depend on the public package API (`@internal/postgres`, `@internal/mongo`, the contract files in `prisma/`, etc.).

If you are an extension author, install the [`prisma-8-extension-upgrade`](../prisma-8-extension-upgrade/SKILL.md) skill instead. If your repo contains both an app and an extension, install both.

## Installation

```bash
pnpm dlx skills add prisma/prisma/skills --skill prisma-next-upgrade -y
```

`--skill` selects this skill from the shared `skills` source and `-y` skips the confirmation prompt. To limit the install to one agent runtime, add `-a <agent>` (e.g. `-a claude-code`).

The upgrade skill installs intentionally **unpinned** (always tracks `main`). Bug fixes to older per-transition upgrade instructions ship as part of the cumulative latest skill content; pinning to an older revision can apply a known-broken translation. The two upgrade skills are the only Prisma Next skills that are unpinned by design — the consolidated `prisma-8` usage skill installs pinned to the project's installed Prisma Next version (see [`prisma-next init`](../../packages/1-framework/3-tooling/cli/) for the canonical wiring).

## Usage

Once installed, an agent in your project picks up the skill from a prompt like:

```text
Please upgrade Prisma Next to the latest version.
```

The agent reads `SKILL.md`, detects the current and target versions, applies one transition at a time, and commits each transition step separately.

## What the skill does

See [`SKILL.md`](./SKILL.md) for the full flow. In short:

1. Ensure the skill itself is at `@latest`.
2. Pre-flight: refuse to upgrade past any installed extension's pin.
3. Detect from-version (from the lockfile) and to-version (user-supplied or npm `latest`).
4. Build the transition chain (one minor at a time).
5. For each step: bump deps to the exact next minor, `pnpm install`, apply the per-transition upgrade instructions, run typecheck + tests, commit.
6. Halt at the first failed step with a structured error.
