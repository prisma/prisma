---
name: prisma-8-extension-upgrade
description: >-
  Upgrade Prisma Next in your extension. Bumps every `@internal/*`
  dependency to the requested target (or npm `latest`), runs the
  per-transition upgrade instructions for the extension SPI (middleware
  lifecycle, codec / migration-tools / framework-components churn,
  seed-migration on-disk shape), verifies the pins are correctly exact
  via `prisma-8-check-pins`, runs the extension's own typecheck and
  tests, and commits each minor step on its own. Use when the user asks
  to "upgrade Prisma Next" in an extension package, or to update an
  extension's `@internal/*` deps to a new minor.
---

# Upgrade Prisma Next (extension)

This skill upgrades a project that **is** a Prisma Next extension — a package that consumes the framework SPI (`@internal/contract`, `@internal/framework-components`, `@internal/migration-tools`, etc.) and exposes contract / middleware / codec / migration surfaces that downstream apps install via `prisma.config.ts`.

If the project you are upgrading is a consumer **app** (it imports `@internal/postgres` or `@internal/mongo` from its application code), use the `prisma-next-upgrade` skill instead — or both, if the repo contains both a consumer app and an extension package, in which case run the user flow first then the extension flow in the same session.

## Step 0 — Ensure the skill is up to date

Before doing anything else, ensure this skill is installed at `@latest` and reload it. Bug fixes to *old* per-transition upgrade instructions ship in the latest skill release as part of its cumulative set; running against a stale skill can apply a known-broken translation.

Concretely: if the agent runtime supports an in-session refresh, perform it now. Otherwise, exit and ask the user to re-install:

```bash
pnpm dlx skills add prisma/prisma/skills --skill prisma-8-extension-upgrade -y
```

The extension-author skill install is intentionally unpinned (always `main`) — the cumulative instruction set is the source of truth and the latest release fixes apply to every prior transition.

Then re-invoke this skill before proceeding.

## Role detection

This skill applies when the project **is** a Prisma Next extension. Heuristics:

- `package.json` declares `@internal/contract` (or another SPI package) under `dependencies` or `peerDependencies`, and
- the package's `name` matches `^@.*/extension-` (the in-tree convention used by `@internal/extension-pgvector`, etc.), or
- the package is referenced as an `extensions` entry from a sibling app's `prisma.config.ts` in the same monorepo.

If the project additionally consumes Prisma Next from its own app code, install the `prisma-next-upgrade` skill (`pnpm dlx skills add prisma/prisma/skills --skill prisma-next-upgrade -y`) and run the user flow first, then this flow in the same session.

If detection is ambiguous, ask the user which role to operate under.

## Version detection

- **From-version.** Read the currently-installed Prisma Next version from `pnpm-lock.yaml` (or `package-lock.json` / `yarn.lock`) by inspecting the resolved version of any `@internal/*` entry. If the lockfile shows multiple `@internal/*` packages at different minors, the lowest minor is the from-version.
- **To-version.** Either the version the user specified, or whatever `npm view @internal/contract dist-tags.latest` reports. Do not assume that is a stable version: while Prisma 8 is a release candidate, `latest` tracks the newest release, `8.0.0-rc.N` included. If the user wants a stable version specifically, they must name it.

Report both back to the user before continuing.

## Transition chain

If the from-to delta spans more than one release (e.g. `0.6 → 0.8`), build the chain of steps between them:

```text
0.6 → 0.7 → 0.8
```

The `upgrades/` directories in this package name the steps — read the chain off the directory names rather than deriving it arithmetically. Each directory is `<from>-to-<to>`. A step is one minor while the version line is stable (`0.7-to-0.8`); on the v8 release-candidate line a step is one release candidate (`8.0.0-rc.1-to-8.0.0-rc.2`), because an RC may carry breaking changes and each one needs its own translation. Moving onto the RC line from the last stable minor is a single step of its own (`0.17-to-8.0.0-rc.1`).

Apply each step in order, fully: bump, install, run instructions, check pins, validate, commit — before moving to the next. Halt the chain on the first failed step.

## Per-step flow

This flow assumes you are an **external extension author** — your extension lives in its own repo and consumes `@internal/*` from npm. (Extensions inside the `prisma/prisma` monorepo itself are bumped via `pnpm bump-version` / `scripts/set-version.ts`, which rewrites every `workspace:<X.Y.Z>` spec in lockstep with the root version; they do not run this skill.)

For each `(from, to)` step in the chain:

1. **Bump `@internal/*` deps.** Rewrite every `@internal/*` entry in the extension's `package.json` to the exact `<to>` version (e.g. `"0.8.0"` — no caret, no tilde, no range, no `workspace:` specifier; the exact-pin rule below details why). All entries advance to the same version. Cover whichever dep field(s) the extension uses today — `dependencies` and/or `peerDependencies` — and any `optionalDependencies`. The extension-upgrade skill itself ships via `pnpm dlx skills add` (see Step 0); there is no `@internal/extension-upgrade-skill` npm entry to bump. The companion CLI tool is `@internal/extension-author-tools` — leave its pin at the version the extension's CI is currently using; bumping it is independent of the framework upgrade and is normally a no-op.

2. **Install.** Run `pnpm install` (or the project's lockfile-managing command). The extension's source is now broken against the new SPI — the upgrade instructions for `<from> → <to>` exist to fix it.

3. **Check pins.** Run `pnpm exec prisma-8-check-pins` (shipped by `@internal/extension-author-tools`). This sanity check asserts that every `@internal/*` entry across `dependencies`, `peerDependencies`, and `optionalDependencies` is a single exact-version string and that all entries share the same version. If the check fails, the bump step did not rewrite every spec — fix the offending entries and re-run before proceeding.

4. **Read the upgrade instructions.** Load `upgrades/<from>-to-<to>/instructions.md` from this skill package. Parse the YAML frontmatter and pay particular attention to its `changes[]` array.

5. **Apply each change.** For each entry in `changes[]`:
   - If the entry has a `detection` block (a glob + content predicate), run it. If no files match, skip this change.
   - If the entry has no `detection`, apply unconditionally.
   - If the entry names a `script:` (a relative path next to `instructions.md`), invoke it from the project root:
     - `*.ts` → `pnpm exec tsx <skill>/upgrades/<from>-to-<to>/<script>`
     - `*.sh` → `bash <skill>/upgrades/<from>-to-<to>/<script>`
     - codemods → invoke per the script's own `instructions.md` prose.
   - If the entry has no `script`, follow the prose body in `instructions.md` directly.

   If `changes[]` is empty (the placeholder shape for transitions with no extension-side breaking changes), this sub-step is a no-op — proceed to validation.

6. **Validate.** Run `pnpm build && pnpm test` (or the project's equivalent — the `scripts` field of the extension's `package.json` is the discovery surface). If anything is red, halt the chain. Do **not** auto-roll-back; surface the failure to the user with the failing change's `id` (from the frontmatter), the file paths the change operated on, and the inferred remediation.

7. **Commit.** Create one commit containing this step's changes: the `package.json` bump, the lockfile churn from `pnpm install`, and any source-file rewrites from the applied changes. Use the message:

   ```text
   chore: upgrade @internal/* to <to-version>
   ```

   (Or the extension's own commit-message convention, if it has one.) One commit per step — never squash steps.

Move on to the next step. Repeat.

## Exact-pin rule

Prisma Next extensions pin every `@internal/*` dependency to a single **exact** version (no `^`, no `~`, no range, no wildcard, no `workspace:` specifier in the published `package.json`). All `@internal/*` entries share the same version. The pin advances only after a successful upgrade run against the new minor.

`prisma-8-check-pins` (shipped by `@internal/extension-author-tools` — install with `pnpm add -D @internal/extension-author-tools`) enforces the rule. Run it locally with:

```bash
pnpm exec prisma-8-check-pins
```

Wire it into the extension's CI alongside the build/test step so an accidental range pin fails the PR before it lands.

## When the chain is done

Report back to the user: the number of steps applied, the SHAs of the commits you made, and any open follow-ups.

## Failure surfaces

When a step fails:

- Surface a structured error with code `PN-UPGRADE-NNNN`, the failing change's `id`, the file paths the change touched (or the lockfile, or the pin check, or the validation command), and the inferred remediation.
- Do not retry automatically.
- Do not auto-roll-back the commit. The user can revert if they want a clean slate.
