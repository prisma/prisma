# prisma-8-extension-upgrade

An agent skill that upgrades a Prisma Next **extension** package from one minor version to the next. The skill carries the per-step bump-install-instructions-check-pins-validate-commit flow plus the cumulative set of per-transition *upgrade instructions* (one directory per `(from-minor, to-minor)` pair).

The companion CLI `prisma-8-check-pins` ships separately from [`@internal/extension-author-tools`](../../packages/0-shared/extension-author-tools/) — extension authors install that as a normal `devDependency` and wire it into CI.

## Audience

This skill is for **authors of Prisma Next extensions** — packages that consume the framework SPI and expose contract / middleware / codec / migration surfaces to downstream apps.

If you are a user of Prisma Next (your project imports `@internal/postgres`, `@internal/mongo`, etc. from your application code), install the [`prisma-next-upgrade`](../prisma-next-upgrade/SKILL.md) skill instead. If your repo contains both an app and an extension, install both.

## Installation

### The skill (always-latest)

```bash
pnpm dlx skills add prisma/prisma/skills --skill prisma-8-extension-upgrade -y
```

`--skill` selects this skill from the shared `skills` source and `-y` skips the confirmation prompt. To limit the install to one agent runtime, add `-a <agent>` (e.g. `-a claude-code`).

The extension-author upgrade skill installs intentionally **unpinned** (always tracks `main`). Bug fixes to older per-transition upgrade instructions ship as part of the cumulative latest skill content; pinning to an older revision can apply a known-broken translation.

### The CLI tool (normal devDependency)

```bash
pnpm add -D @internal/extension-author-tools
```

Then wire `pnpm exec prisma-8-check-pins` into your CI.

## Usage

### Upgrade

Once installed, an agent in your extension repo picks up the skill from a prompt like:

```text
Please upgrade Prisma Next to the latest version.
```

The agent reads `SKILL.md`, detects the current and target versions, applies one transition at a time, and commits each transition step separately.

### `prisma-8-check-pins` CLI

The CLI enforces the *exact-pin rule* for Prisma Next extensions: every `@internal/*` entry across `dependencies`, `peerDependencies`, and `optionalDependencies` must be a single exact-version string (no `^`, no `~`, no range, no wildcard, no `workspace:` specifier), and every entry must resolve to the same version.

```bash
pnpm exec prisma-8-check-pins
```

Exits with status `0` and no output on success; on any failure, prints a structured error naming every offending entry and exits non-zero.

Wire into your CI alongside your build/test step:

```yaml
- run: pnpm exec prisma-8-check-pins
```

## What the skill does

See [`SKILL.md`](./SKILL.md) for the full flow. In short:

1. Ensure the skill itself is at `@latest`.
2. Detect from-version (from the lockfile) and to-version (user-supplied or npm `latest`).
3. Build the transition chain (one minor at a time).
4. For each step: bump deps to the exact next minor, `pnpm install`, run `prisma-8-check-pins`, apply the per-transition upgrade instructions, run build + tests, commit.
5. Halt at the first failed step with a structured error.
