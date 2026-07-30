/**
 * Canonical mapping of internal workspace packages to public publish shells
 * (ADR 242). Each internal package becomes a subpath entrypoint namespace of
 * exactly one published `@prisma/orm-*` shell: the internal root export maps
 * to `@prisma/<shell>/<entry>` and each internal subpath `./x` maps to
 * `@prisma/<shell>/<entry>/x`.
 *
 * Consumed by the shell build mode (`shell-build.ts`); later also by the
 * emitter (TML-3123) and publish-surface lint (TML-3124).
 */

export interface ShellPackageMapping {
  /** Internal package directory, relative to the repository root. */
  readonly dir: string;
  /** Entrypoint namespace inside the shell. */
  readonly entry: string;
}

export interface ShellDefinition {
  /** Shell directory relative to the repository root. */
  readonly dir: string;
  readonly packages: readonly ShellPackageMapping[];
  /**
   * Bin scripts carried by the shell: bin name to a dist file of one of the
   * internal packages (relative to the repository root). The file is bundled
   * as a side-effect entry named `bin/<binName>` (excluded from exports).
   */
  readonly bins?: Readonly<Record<string, string>>;
  /**
   * Extra dist files to copy into the shell's dist root (globs relative to
   * the repository root), e.g. templates an internal package reads next to
   * its code via `import.meta.dirname`.
   */
  readonly copy?: readonly string[];
}

export type ShellName =
  | '@prisma/orm-framework'
  | '@prisma/orm-toolchain'
  | '@prisma/orm-family-sql'
  | '@prisma/orm-family-mongo'
  | '@prisma/orm-target-postgres'
  | '@prisma/orm-target-sqlite'
  | '@prisma/orm-target-mongo';

export const publicShells: ReadonlyMap<ShellName, ShellDefinition> = new Map<
  ShellName,
  ShellDefinition
>([
  [
    '@prisma/orm-framework',
    {
      dir: 'packages/9-public/@prisma/orm-framework',
      packages: [
        { dir: 'packages/1-framework/0-foundation/contract', entry: 'contract' },
        { dir: 'packages/1-framework/0-foundation/utils', entry: 'utils' },
        { dir: 'packages/1-framework/1-core/config', entry: 'config' },
        { dir: 'packages/1-framework/1-core/errors', entry: 'errors' },
        { dir: 'packages/1-framework/1-core/framework-components', entry: 'components' },
        { dir: 'packages/1-framework/1-core/operations', entry: 'operations' },
        { dir: 'packages/1-framework/1-core/ts-render', entry: 'ts-render' },
        { dir: 'packages/1-framework/2-authoring/contract', entry: 'contract-authoring' },
        { dir: 'packages/1-framework/2-authoring/ids', entry: 'ids' },
        { dir: 'packages/1-framework/2-authoring/psl-parser', entry: 'psl-parser' },
        { dir: 'packages/1-framework/2-authoring/psl-printer', entry: 'psl-printer' },
      ],
    },
  ],
  [
    '@prisma/orm-toolchain',
    {
      dir: 'packages/9-public/@prisma/orm-toolchain',
      packages: [
        { dir: 'packages/1-framework/3-tooling/cli', entry: 'cli' },
        { dir: 'packages/1-framework/3-tooling/cli-telemetry', entry: 'cli-telemetry' },
        { dir: 'packages/1-framework/3-tooling/config-loader', entry: 'config-loader' },
        { dir: 'packages/1-framework/3-tooling/emitter', entry: 'emitter' },
        { dir: 'packages/1-framework/3-tooling/language-server', entry: 'language-server' },
        { dir: 'packages/1-framework/3-tooling/migration', entry: 'migration-tools' },
        {
          dir: 'packages/1-framework/3-tooling/vite-plugin-contract-emit',
          entry: 'vite-plugin-contract-emit',
        },
      ],
      bins: { 'prisma-next': 'packages/1-framework/3-tooling/cli/dist/cli.mjs' },
      copy: ['packages/1-framework/3-tooling/cli/dist/*.md'],
    },
  ],
  [
    '@prisma/orm-family-sql',
    {
      dir: 'packages/9-public/@prisma/orm-family-sql',
      packages: [
        { dir: 'packages/2-sql/1-core/contract', entry: 'contract' },
        { dir: 'packages/2-sql/1-core/errors', entry: 'errors' },
        { dir: 'packages/2-sql/1-core/operations', entry: 'operations' },
        { dir: 'packages/2-sql/1-core/schema-ir', entry: 'schema-ir' },
        { dir: 'packages/2-sql/2-authoring/contract-psl', entry: 'contract-psl' },
        { dir: 'packages/2-sql/2-authoring/contract-ts', entry: 'contract-ts' },
        { dir: 'packages/2-sql/3-tooling/emitter', entry: 'contract-emitter' },
        { dir: 'packages/2-sql/4-lanes/query-builder', entry: 'lane-query-builder' },
        { dir: 'packages/2-sql/4-lanes/relational-core', entry: 'relational-core' },
        { dir: 'packages/2-sql/4-lanes/sql-builder', entry: 'builder' },
        { dir: 'packages/2-sql/5-runtime', entry: 'runtime' },
        { dir: 'packages/2-sql/9-family', entry: 'family' },
        // Platform code despite its `3-extensions/` directory: both SQL
        // facades depend on it, and one module may live in only one
        // published package, so it cannot be duplicated into each facade.
        { dir: 'packages/3-extensions/sql-orm-client', entry: 'orm-client' },
      ],
    },
  ],
  [
    '@prisma/orm-family-mongo',
    {
      dir: 'packages/9-public/@prisma/orm-family-mongo',
      packages: [
        { dir: 'packages/2-mongo-family/1-foundation/mongo-codec', entry: 'codec' },
        { dir: 'packages/2-mongo-family/1-foundation/mongo-contract', entry: 'contract' },
        { dir: 'packages/2-mongo-family/1-foundation/mongo-value', entry: 'value' },
        { dir: 'packages/2-mongo-family/2-authoring/contract-psl', entry: 'contract-psl' },
        { dir: 'packages/2-mongo-family/2-authoring/contract-ts', entry: 'contract-ts' },
        { dir: 'packages/2-mongo-family/3-tooling/emitter', entry: 'emitter' },
        { dir: 'packages/2-mongo-family/3-tooling/mongo-schema-ir', entry: 'schema-ir' },
        { dir: 'packages/2-mongo-family/4-query/query-ast', entry: 'query-ast' },
        { dir: 'packages/2-mongo-family/5-query-builders/orm', entry: 'orm' },
        { dir: 'packages/2-mongo-family/5-query-builders/query-builder', entry: 'query-builder' },
        { dir: 'packages/2-mongo-family/6-transport/mongo-lowering', entry: 'lowering' },
        { dir: 'packages/2-mongo-family/6-transport/mongo-wire', entry: 'wire' },
        { dir: 'packages/2-mongo-family/7-runtime', entry: 'runtime' },
        { dir: 'packages/2-mongo-family/9-family', entry: 'family' },
      ],
    },
  ],
  [
    '@prisma/orm-target-postgres',
    {
      dir: 'packages/9-public/@prisma/orm-target-postgres',
      packages: [
        { dir: 'packages/3-targets/3-targets/postgres', entry: 'target' },
        { dir: 'packages/3-targets/6-adapters/postgres', entry: 'adapter' },
        { dir: 'packages/3-targets/7-drivers/postgres', entry: 'driver' },
      ],
    },
  ],
  [
    '@prisma/orm-target-sqlite',
    {
      dir: 'packages/9-public/@prisma/orm-target-sqlite',
      packages: [
        { dir: 'packages/3-targets/3-targets/sqlite', entry: 'target' },
        { dir: 'packages/3-targets/6-adapters/sqlite', entry: 'adapter' },
        { dir: 'packages/3-targets/7-drivers/sqlite', entry: 'driver' },
      ],
    },
  ],
  [
    '@prisma/orm-target-mongo',
    {
      dir: 'packages/9-public/@prisma/orm-target-mongo',
      packages: [
        { dir: 'packages/3-mongo-target/1-mongo-target', entry: 'target' },
        { dir: 'packages/3-mongo-target/2-mongo-adapter', entry: 'adapter' },
        { dir: 'packages/3-mongo-target/3-mongo-driver', entry: 'driver' },
      ],
    },
  ],
]);

/** Export subpaths that never ship in a shell (test-only surfaces). */
export const excludedSubpaths: readonly RegExp[] = [/^\.\/test(\/|$)/];
