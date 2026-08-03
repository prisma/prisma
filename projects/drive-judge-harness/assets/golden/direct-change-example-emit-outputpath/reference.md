# Reference output — direct-change-example-emit-outputpath

The known-good resolution that shipped for this brief. This is the **reference**, not a
required reproduction: a run need not produce byte-identical changes, but a correct run
should land in the same place — root cause fixed, fixtures clean, no stray artifacts.

## Source of truth

- Linear: **TML-2722**
- PR: **#618** — `fix(examples): emit generated contract into tracked src/prisma`
- Base SHA (run the brief against this tree state): `e15220bbf673c75a2410aed0de2cf0cacce215f9`
- Merge SHA (the known-good output): `9787be39a248f3299f085c7d18a812a7120c748a`

Fetch the real diff with:

```bash
git diff e15220bbf673c75a2410aed0de2cf0cacce215f9 9787be39a248f3299f085c7d18a812a7120c748a
```

## What the known-good solution did

The family `defineConfig` shorthand let `contract: './prisma/contract.ts'` drive **both** the
authoring source path and — via `deriveOutputPath()` — the default emit output
(`./prisma/contract.json`). The apps consume `src/prisma/`, so emit and the tracked artifacts
had diverged. The fix sets `outputPath` explicitly to decouple the two.

- `examples/paradedb-demo/prisma-next.config.ts` and
  `examples/prisma-8-demo-sqlite/prisma-next.config.ts`: add `outputPath: './src/prisma'`.
- `@internal/sqlite` `defineConfig`: accept `outputPath` (postgres and mongo already did),
  mirroring postgres, with tests — the one enabling change needed so the sqlite example could
  be fixed config-only.
- Removed the stray untracked `prisma/contract.{d.ts,json}` from both examples. No
  tracked-artifact diffs — `src/prisma/` was already in sync.

Four files changed; no production runtime code beyond the sqlite config-surface addition.

## Why this is the reference standard

The fix attacks the root cause (output path diverged from the tracked, imported location) at
the source rather than adding a copy step. It stays within the direct-change envelope: the
sqlite `defineConfig` addition is the minimal enabling change, scoped and tested, not a
project.
