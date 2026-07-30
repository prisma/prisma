# @prisma-next/publish-surface

> **Private, and never published.** This package describes what the published surface *is*; it is not part of it. It is `"private": true` and belongs to no shell, so nothing outside this repository can depend on it.

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

One consumer reads this table today and nothing copies it: the shell build (`@prisma-next/tsdown/shell-build`), which turns each mapping into a generated entrypoint.

Emission does **not** read it. The contract emitters, the targets' migration renderers, and `prisma-next init` each receive an opaque `ImportSpecifierResolver` — a `(specifier) => string` declared in `@prisma-next/framework-components/emission` — and never learn what the published names are. That keeps `packages/1-framework` free of family and target vocabulary, and keeps this package out of every published bundle. Whoever chooses the root builds the resolver here and passes it in; today that is only tests, because the default root leaves specifiers unchanged.

## Why the name is declared, not read from disk

`ShellPackageMapping` carries both `dir` and `name`. The build reads package manifests off disk anyway, but emission runs inside a published bundle where the workspace does not exist — so the name has to be data. `test/shells.test.ts` asserts each declared name matches the manifest at `dir`, so the two cannot drift.

## Dependencies

None at run time. The table is plain data and the resolver is pure.
