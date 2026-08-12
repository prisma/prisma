# NOTICE audit — Apache-2.0 §4(d) compliance

**Date of audit:** 2026-05-09
**Auditor:** William Madden (under TML-2439 / `projects/oss-setup`)
**Tool:** `scripts/audit-notice.mjs`
**Resolution context:** post-`pnpm install` against the lockfile at branch `tml-2439-project-init` (rebased onto `agent-personas-library` at `03d9c0718`).

## Outcome

**No `NOTICE` file is required at the repo root.** Apache-2.0 §4(d) is **not** engaged by any published `@internal/*` package.

A root `NOTICE` file has therefore **not** been added.

## What was scanned

The audit walked every package physically installed under `node_modules/.pnpm/` after `pnpm install --frozen-lockfile`:

- **691 packages** scanned (every distinct `name@version` in the pnpm content-addressable store).
- For each package, the audit inspected the package directory (`node_modules/.pnpm/<name@version>/node_modules/<name>/`) for any file matching `^NOTICE(\.txt|\.md|\.markdown)?$` (case-insensitive).
- For each `NOTICE`-bearing package, the audit recorded the package's declared license (from its own `package.json`), the NOTICE filename, byte size, and first line.
- The audit then computed the set of `name@version` reachable as **runtime** dependencies of any **publishable** workspace package (i.e. `package.json` not marked `"private": true`), via `pnpm list -r --prod --depth=Infinity --json`. Any `NOTICE`-bearing package not in this set is dev/test/example-only and is not redistributed in any published tarball.

## Findings

| Package         | Version | License    | Has NOTICE? | Runtime-redistributed? |
| --------------- | ------- | ---------- | ----------- | ---------------------- |
| `bare-path`     | 3.0.0   | Apache-2.0 | Yes         | **No** (dev-only)      |

### Detail: `bare-path@3.0.0`

- License: `Apache-2.0`
- NOTICE: 1174 bytes, opens with `Copyright 2023 Holepunch Inc`
- Reaches our `node_modules/` only via `mongodb-memory-server@10.4.3 → mongodb-memory-server-core@10.4.3 → tar-stream@3.1.8 → bare-fs@4.5.6 → {bare-path, bare-url@2.4.0 → bare-path}`.
- `mongodb-memory-server` is declared as `devDependencies` in every workspace package that depends on it (verified via `pnpm why -r bare-path`):
  - `examples/mongo-blog-leaderboard` (private)
  - `examples/mongo-demo` (private)
  - `examples/retail-store` (private)
  - `@internal/mongo-orm` (devDependency)
  - `@internal/mongo-runtime` (devDependency)
  - `@internal/mongo` (devDependency)
  - `@internal/target-mongo` (devDependency)
- Because `mongodb-memory-server` is a `devDependency` (in-memory Mongo used for unit/integration tests), it is **not** included in the published tarball of any `@internal/*` package. Downstream consumers installing `@internal/mongo` (or any other package) do not receive `bare-path` in their install.
- §4(d) governs only redistribution. Dev-only deps used for our own testing are not redistribution.

## Conclusion

No upstream Apache-2.0 dependency we redistribute ships a `NOTICE` file. The §4(d) propagation obligation does not apply to any current published package. No root `NOTICE` file is added.

## Re-running the audit

The audit script is committed at `scripts/audit-notice.mjs` and is idempotent. It can be re-run at any time:

```bash
pnpm install --frozen-lockfile
node scripts/audit-notice.mjs           # human-readable
node scripts/audit-notice.mjs --json    # machine-readable
node scripts/audit-notice.mjs --apache-only   # filter to Apache/BSD
```

If a future dependency change introduces a runtime-redistributed `NOTICE`-bearing dep, the audit must be re-run and a root `NOTICE` file added per §4(d). This is not currently CI-enforced; consider adding it to the publish-time gate alongside `check:publish-deps` if NOTICE-bearing deps become a recurring concern.
