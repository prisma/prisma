# @prisma-next/publish-surface

> **Internal package.** This package is an implementation detail of [`prisma-next`](https://www.npmjs.com/package/prisma-next)
> and is published only to support its runtime. Its API is unstable and may change
> without notice. Do not depend on this package directly; install `prisma-next` instead.

The canonical map from internal workspace packages to the published `@prisma/orm-*` entrypoints of [ADR 242](../../../docs/architecture%20docs/adrs/), and the import-root modes that emission resolves generated import specifiers through.

## Responsibilities

- **`./shells`** — the mapping table. Every internal package belongs to exactly one published shell and becomes a subpath entrypoint of it: `@prisma-next/<pkg>/<sub>` → `@prisma/<shell>/<entry>/<sub>`. Facades additionally republish selected sibling surfaces so an application that installed one package can still import everything its generated code names.
- **`./import-roots`** — turns an internal specifier into the name generated code should carry, given how the application installed Prisma Next:

  | Root | `@prisma-next/sql-contract/types` becomes |
  |---|---|
  | `internal` (default) | `@prisma-next/sql-contract/types` |
  | `facade` | `@prisma/orm-postgres/family-contract/types` |
  | `platform` | `@prisma/orm-family-sql/contract/types` |

  Resolution refuses to produce a name the application does not depend on **directly**. A package manager puts a package's own dependencies in that package's `node_modules`, so a generated file importing a transitively installed package fails to resolve at run time even though the files are on disk. `resolveImportSpecifier` throws rather than emit one.

Two consumers read this table and nothing copies it: the shell build (`@prisma-next/tsdown/shell-build`, which turns each mapping into a generated entrypoint) and emission (the framework, SQL, and Mongo contract emitters, the targets' migration renderers, and `prisma-next init`).

## Why the name is declared, not read from disk

`ShellPackageMapping` carries both `dir` and `name`. The build reads package manifests off disk anyway, but emission runs inside a published bundle where the workspace does not exist — so the name has to be data. `test/shells.test.ts` asserts each declared name matches the manifest at `dir`, so the two cannot drift.

## Dependencies

None at run time. The table is plain data and the resolver is pure.
