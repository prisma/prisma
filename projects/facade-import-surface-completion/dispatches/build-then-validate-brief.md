# Build-then-validate continuation brief

**Branch:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Worktree:** `tml-2526-facades-must-re-export-everything-users-import-in-their-app`
**Current HEAD (local only):** `357805f2f`
**Origin HEAD:** `9c0eb947b` (push pending)

## Context

The rebase + nested-includes import fix landed cleanly. The continuation subagent (`8f59ed5a`) hit a `typecheck` red on `@internal/postgres/contract-builder` and `@internal/postgres/migration` and stopped per the previous brief's "if a gate is red, STOP" discipline.

The orchestrator's hypothesis (high-confidence): this is the known prisma-next "stale `dist/*.d.mts`" gotcha. The workspace's golden rule on this:

> After changing exported types in a workspace package consumed elsewhere, run that package's `pnpm build` to refresh `dist/*.d.mts` before validating downstream TypeScript.

Our PR adds new subpaths (`/contract-builder`, `/migration`) to `@internal/postgres` (and friends). After the rebase, those subpaths exist in source but the cached `dist/` from before the rebase doesn't reflect them — so consumers (e.g. `@internal/postgres`'s own tests, or other workspace packages) fail to resolve the new subpaths.

Fix: `pnpm build` first, then re-run `typecheck` and the other gates.

## The continuation

1. `pnpm install --frozen-lockfile` — sanity (should already be clean; cheap insurance).
2. `pnpm build` — **must exit 0** (66/66 turbo tasks). This rebuilds all `dist/*.d.mts` reflecting the post-rebase source state. **If build is red, STOP** — that's a real regression we need to look at.
3. `pnpm typecheck` — must exit 0. If still red after build, surface the full output — it's not a stale-dist issue, it's something real.
4. `pnpm fixtures:check` — must exit 0.
5. `pnpm lint:deps` — must exit 0.

## DCO sanity check

Even though no new commits are produced by this dispatch, still run:

```bash
git log origin/main..HEAD --format='%h | author: %an <%ae> | signoff: %(trailers:key=Signed-off-by)' | head -10
```

Confirm every signoff is `Will Madden <madden@prisma.io>`. STOP if any `Composer` shows up.

## Push

If all gates green:

```bash
git push --force-with-lease origin tml-2526-facades-must-re-export-everything-users-import-in-their-app
```

Force-with-lease should expect origin at `9c0eb947b` and replace with `357805f2f`.

## Hard rules

- Do NOT make any commits. This is a validation-and-push dispatch.
- Do NOT touch any source file.
- Do NOT touch any file under `projects/` — orchestrator-owned.
- Use `--force-with-lease`, not plain `--force`.
- Heartbeat to `wip/heartbeats/build-then-validate.txt` at start, post-build, post-typecheck, post-gates, pre-push (overwrite, don't append).

## Structured report

```
## Status
GREEN / YELLOW / RED

## Build (the load-bearing step)
- Result: green / red
- Turbo tasks: <N>/<N>
- Cache hits vs misses (if visible): <summary>

## Gates after build
- pnpm install: green / red
- typecheck: green / red (with the prior-dispatch errors gone? yes / no)
- fixtures:check: green / red
- lint:deps: green / red

## DCO sanity
- All signoffs `Will Madden <madden@prisma.io>`: yes / no

## Push
- pushed / blocked — <reason>
- New origin HEAD: <sha>

## Surfaced for orchestrator attention
- <anything; if typecheck STILL red post-build, paste the full TS error output>
```
