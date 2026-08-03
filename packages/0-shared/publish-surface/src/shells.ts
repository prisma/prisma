/**
 * Canonical mapping of internal workspace packages to public publish shells
 * (ADR 242). Each internal package becomes a subpath entrypoint namespace of
 * exactly one published `@prisma/orm-*` shell: the internal root export maps
 * to `@prisma/<shell>/<entry>` and each internal subpath `./x` maps to
 * `@prisma/<shell>/<entry>/x`.
 *
 * Consumed by the shell build (`@prisma-next/tsdown/shell-build`), by the
 * emitters' import-root resolution (`./import-roots`), and later by the
 * publish-surface lint (TML-3124).
 */

/**
 * How an application acquires a shell, which decides whether emitted code may
 * name it. See `directDependencyShells` in `./import-roots`.
 */
export type ShellKind =
  /** Installed directly only by a decomposed application. */
  | 'platform'
  /** The one-package install for a database; carries the platform shells. */
  | 'facade'
  /** Installed directly alongside whatever else the application uses. */
  | 'extension';

export interface ShellPackageMapping {
  /** Internal package directory, relative to the repository root. */
  readonly dir: string;
  /**
   * Internal package name, e.g. `@prisma-next/contract`. Declared rather than
   * read from `dir/package.json` so specifier resolution works inside a
   * published bundle, where the workspace is not on disk. A test keeps the
   * two in step.
   */
  readonly name: string;
  /**
   * Entrypoint namespace inside the shell. The empty string places the
   * package directly at the shell's own namespace, so its `./x` export
   * becomes `@prisma/<shell>/x` — the shape facades and extension packs
   * use, where the shell publishes a single internal package under its
   * own name.
   */
  readonly entry: string;
}

export interface ShellReexportMapping {
  /** Internal package name whose surface is forwarded, e.g. `@prisma-next/contract`. */
  readonly package: string;
  /** Entrypoint namespace inside this shell that forwards to it. */
  readonly entry: string;
  /**
   * Whether `<entry>` itself forwards the package as a whole. Set false when
   * the shell's own code already owns that name and only the subpaths
   * `<entry>/x` should forward. Defaults to true.
   */
  readonly root?: boolean;
}

export interface ShellDefinition {
  /** Shell directory relative to the repository root. */
  readonly dir: string;
  readonly kind: ShellKind;
  readonly packages: readonly ShellPackageMapping[];
  /**
   * Surfaces of *other* shells republished under this shell's own
   * entrypoints. Nothing is copied: each generated entry re-exports the
   * sibling shell's published entrypoint, which the shell declares as an
   * exact-pinned dependency. Facades carry the contract surfaces this way
   * so that code generated for an application that installs only the
   * facade imports nothing but a direct dependency (ADR 242).
   */
  readonly reexports?: readonly ShellReexportMapping[];
  /**
   * Bin scripts carried by the shell: bin name to a dist file of one of the
   * internal packages (relative to the repository root). The file is bundled
   * as a side-effect entry named `bin/<binName>`, and published both as the
   * `bin` field and as the `./bin/<binName>` entrypoint so another shell can
   * forward it.
   */
  readonly bins?: Readonly<Record<string, string>>;
  /**
   * Bin scripts this shell re-exposes from another shell: bin name to that
   * shell's `./bin/<binName>` entrypoint. The generated launcher imports the
   * sibling for its side effects, so the command runs the one published copy
   * of the program rather than a second one.
   *
   * Facades carry the CLI this way because an application installs only the
   * facade, and package managers put a package manager's own direct
   * dependencies on `PATH` — a transitively installed bin is not runnable.
   */
  readonly forwardedBins?: Readonly<Record<string, string>>;
  /**
   * Sibling shells this shell requires the installer to provide, declared as
   * peer dependencies rather than pulled in as its own copy.
   *
   * Extension packs use this for the target shell they extend (ADR 242).
   * A hard dependency would let an application upgrade the facade without
   * upgrading the extension and end up with two copies of the target — the
   * codec and operation registries would silently diverge and `instanceof`
   * would stop holding. As a peer, that combination fails to install
   * instead.
   */
  readonly peerShells?: readonly ShellName[];
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
  | '@prisma/orm-target-mongo'
  | '@prisma/orm-postgres'
  | '@prisma/orm-sqlite'
  | '@prisma/orm-mongo'
  | '@prisma/orm-extension-postgis'
  | '@prisma/orm-extension-pgvector'
  | '@prisma/orm-extension-paradedb'
  | '@prisma/orm-extension-supabase'
  | '@prisma/orm-extension-arktype-json'
  | '@prisma/orm-extension-middleware-cache';

/**
 * The CLI command every facade puts on an application's `PATH`. It runs the
 * toolchain's single published copy; the facade only carries the launcher.
 */
const FACADE_BINS = { 'prisma-next': '@prisma/orm-toolchain/bin/prisma-next' } as const;

/**
 * Surfaces every facade republishes regardless of family.
 *
 * An application depends on one facade and nothing else (ADR 242), so
 * everything it reaches — hand-written and generated alike — has to have a
 * name under the facade. These are the target-agnostic ones: the contract and
 * component surfaces emitted files import, the shared helpers, and the Vite
 * plugin.
 *
 * Entry names follow the name the platform shell gives the same package, so
 * one internal package reads the same way wherever it is reached from.
 *
 * A republished package brings its whole subpath surface with it, so the cost
 * of an entry is its export count, not one. Nothing goes in here that no
 * application reaches: `@prisma-next/migration-tools` is 17 subpaths whose
 * only consumers are extension packs and migration-tooling test harnesses,
 * and ADR 242 has both of those build against the platform packages.
 */
const COMMON_FACADE_REEXPORTS: readonly ShellReexportMapping[] = [
  { package: '@prisma-next/contract', entry: 'contract' },
  { package: '@prisma-next/framework-components', entry: 'components' },
  { package: '@prisma-next/utils', entry: 'utils' },
  {
    package: '@prisma-next/vite-plugin-contract-emit',
    entry: 'vite-plugin-contract-emit',
  },
];

/**
 * The per-database part of a facade's republished surface.
 *
 * `family` is the family's contract package (`@prisma-next/sql-contract` or
 * `@prisma-next/mongo-contract`) and `familyPack` its control-plane and IR
 * pack; `target` and `adapter` carry the codec and operation types emitted
 * contracts reference; `runtime` is the family runtime an application drives
 * queries through.
 *
 * `family-contract` and `family-runtime` take a qualified name because the
 * facade's own `contract` and `runtime` are different modules. `target` and
 * `familyPack` forward subpaths only, so that a facade which publishes its own
 * `./target` or `./family` pack keeps that name for its own module; where a
 * facade publishes neither, the plain name simply stays free.
 *
 * `driver` is per-family rather than universal: a facade wires its own driver,
 * so the only applications that name one are those driving a migration runner
 * themselves, which today is Mongo. The SQL facades leave it out rather than
 * publish a surface nothing reaches.
 */
function facadeReexports(options: {
  readonly family: string;
  readonly familyPack: string;
  readonly runtime: string;
  readonly target: string;
  readonly adapter: string;
  readonly driver?: string;
  readonly queryBuilders: readonly ShellReexportMapping[];
}): ShellReexportMapping[] {
  return [
    ...COMMON_FACADE_REEXPORTS,
    { package: options.family, entry: 'family-contract' },
    { package: options.familyPack, entry: 'family', root: false },
    { package: options.runtime, entry: 'family-runtime' },
    { package: options.target, entry: 'target', root: false },
    { package: options.adapter, entry: 'adapter' },
    ...(options.driver === undefined ? [] : [{ package: options.driver, entry: 'driver' }]),
    ...options.queryBuilders,
  ];
}

/** The SQL family's query surfaces, republished by both SQL facades. */
const SQL_QUERY_REEXPORTS: readonly ShellReexportMapping[] = [
  { package: '@prisma-next/sql-orm-client', entry: 'orm-client' },
  { package: '@prisma-next/sql-builder', entry: 'builder' },
  { package: '@prisma-next/sql-relational-core', entry: 'relational-core' },
];

/**
 * The Mongo family's query surfaces.
 *
 * `orm` is one subpath, and carries `DefaultModelRow` — the type an
 * application names when it writes a function over a query result. That is
 * the same surface the SQL facades carry as `orm-client`, which application
 * source in the SQLite example uses directly.
 */
const MONGO_QUERY_REEXPORTS: readonly ShellReexportMapping[] = [
  { package: '@prisma-next/mongo-orm', entry: 'orm' },
  { package: '@prisma-next/mongo-query-builder', entry: 'query-builder' },
  { package: '@prisma-next/mongo-query-ast', entry: 'query-ast' },
  { package: '@prisma-next/mongo-value', entry: 'value' },
];

export const publicShells: ReadonlyMap<ShellName, ShellDefinition> = new Map<
  ShellName,
  ShellDefinition
>([
  [
    '@prisma/orm-framework',
    {
      dir: 'packages/9-public/@prisma/orm-framework',
      kind: 'platform',
      packages: [
        {
          dir: 'packages/1-framework/0-foundation/contract',
          name: '@prisma-next/contract',
          entry: 'contract',
        },
        {
          dir: 'packages/1-framework/0-foundation/utils',
          name: '@prisma-next/utils',
          entry: 'utils',
        },
        { dir: 'packages/1-framework/1-core/config', name: '@prisma-next/config', entry: 'config' },
        { dir: 'packages/1-framework/1-core/errors', name: '@prisma-next/errors', entry: 'errors' },
        {
          dir: 'packages/1-framework/1-core/framework-components',
          name: '@prisma-next/framework-components',
          entry: 'components',
        },
        {
          dir: 'packages/1-framework/1-core/operations',
          name: '@prisma-next/operations',
          entry: 'operations',
        },
        {
          dir: 'packages/1-framework/1-core/ts-render',
          name: '@prisma-next/ts-render',
          entry: 'ts-render',
        },
        {
          dir: 'packages/1-framework/2-authoring/contract',
          name: '@prisma-next/contract-authoring',
          entry: 'contract-authoring',
        },
        { dir: 'packages/1-framework/2-authoring/ids', name: '@prisma-next/ids', entry: 'ids' },
        {
          dir: 'packages/1-framework/2-authoring/psl-parser',
          name: '@prisma-next/psl-parser',
          entry: 'psl-parser',
        },
        {
          dir: 'packages/1-framework/2-authoring/psl-printer',
          name: '@prisma-next/psl-printer',
          entry: 'psl-printer',
        },
      ],
    },
  ],
  [
    '@prisma/orm-toolchain',
    {
      dir: 'packages/9-public/@prisma/orm-toolchain',
      kind: 'platform',
      packages: [
        { dir: 'packages/1-framework/3-tooling/cli', name: '@prisma-next/cli', entry: 'cli' },
        {
          dir: 'packages/1-framework/3-tooling/cli-telemetry',
          name: '@prisma-next/cli-telemetry',
          entry: 'cli-telemetry',
        },
        {
          dir: 'packages/1-framework/3-tooling/config-loader',
          name: '@prisma-next/config-loader',
          entry: 'config-loader',
        },
        {
          dir: 'packages/1-framework/3-tooling/emitter',
          name: '@prisma-next/emitter',
          entry: 'emitter',
        },
        {
          dir: 'packages/1-framework/3-tooling/language-server',
          name: '@prisma-next/language-server',
          entry: 'language-server',
        },
        {
          dir: 'packages/1-framework/3-tooling/migration',
          name: '@prisma-next/migration-tools',
          entry: 'migration-tools',
        },
        {
          dir: 'packages/1-framework/3-tooling/vite-plugin-contract-emit',
          name: '@prisma-next/vite-plugin-contract-emit',
          entry: 'vite-plugin-contract-emit',
        },
        // This table itself. Emission resolves generated import specifiers
        // through it at run time, so the toolchain carries it rather than
        // duplicating a copy of the mapping wherever a resolver is built.
        {
          dir: 'packages/0-shared/publish-surface',
          name: '@prisma-next/publish-surface',
          entry: 'publish-surface',
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
      kind: 'platform',
      packages: [
        {
          dir: 'packages/2-sql/1-core/contract',
          name: '@prisma-next/sql-contract',
          entry: 'contract',
        },
        { dir: 'packages/2-sql/1-core/errors', name: '@prisma-next/sql-errors', entry: 'errors' },
        {
          dir: 'packages/2-sql/1-core/operations',
          name: '@prisma-next/sql-operations',
          entry: 'operations',
        },
        {
          dir: 'packages/2-sql/1-core/schema-ir',
          name: '@prisma-next/sql-schema-ir',
          entry: 'schema-ir',
        },
        {
          dir: 'packages/2-sql/2-authoring/contract-psl',
          name: '@prisma-next/sql-contract-psl',
          entry: 'contract-psl',
        },
        {
          dir: 'packages/2-sql/2-authoring/contract-ts',
          name: '@prisma-next/sql-contract-ts',
          entry: 'contract-ts',
        },
        {
          dir: 'packages/2-sql/3-tooling/emitter',
          name: '@prisma-next/sql-contract-emitter',
          entry: 'contract-emitter',
        },
        {
          dir: 'packages/2-sql/4-lanes/query-builder',
          name: '@prisma-next/sql-lane-query-builder',
          entry: 'lane-query-builder',
        },
        {
          dir: 'packages/2-sql/4-lanes/relational-core',
          name: '@prisma-next/sql-relational-core',
          entry: 'relational-core',
        },
        {
          dir: 'packages/2-sql/4-lanes/sql-builder',
          name: '@prisma-next/sql-builder',
          entry: 'builder',
        },
        { dir: 'packages/2-sql/5-runtime', name: '@prisma-next/sql-runtime', entry: 'runtime' },
        { dir: 'packages/2-sql/9-family', name: '@prisma-next/family-sql', entry: 'family' },
        // Platform code despite its `3-extensions/` directory: both SQL
        // facades depend on it, and one module may live in only one
        // published package, so it cannot be duplicated into each facade.
        {
          dir: 'packages/3-extensions/sql-orm-client',
          name: '@prisma-next/sql-orm-client',
          entry: 'orm-client',
        },
      ],
    },
  ],
  [
    '@prisma/orm-family-mongo',
    {
      dir: 'packages/9-public/@prisma/orm-family-mongo',
      kind: 'platform',
      packages: [
        {
          dir: 'packages/2-mongo-family/1-foundation/mongo-codec',
          name: '@prisma-next/mongo-codec',
          entry: 'codec',
        },
        {
          dir: 'packages/2-mongo-family/1-foundation/mongo-contract',
          name: '@prisma-next/mongo-contract',
          entry: 'contract',
        },
        {
          dir: 'packages/2-mongo-family/1-foundation/mongo-value',
          name: '@prisma-next/mongo-value',
          entry: 'value',
        },
        {
          dir: 'packages/2-mongo-family/2-authoring/contract-psl',
          name: '@prisma-next/mongo-contract-psl',
          entry: 'contract-psl',
        },
        {
          dir: 'packages/2-mongo-family/2-authoring/contract-ts',
          name: '@prisma-next/mongo-contract-ts',
          entry: 'contract-ts',
        },
        {
          dir: 'packages/2-mongo-family/3-tooling/emitter',
          name: '@prisma-next/mongo-emitter',
          entry: 'emitter',
        },
        {
          dir: 'packages/2-mongo-family/3-tooling/mongo-schema-ir',
          name: '@prisma-next/mongo-schema-ir',
          entry: 'schema-ir',
        },
        {
          dir: 'packages/2-mongo-family/4-query/query-ast',
          name: '@prisma-next/mongo-query-ast',
          entry: 'query-ast',
        },
        {
          dir: 'packages/2-mongo-family/5-query-builders/orm',
          name: '@prisma-next/mongo-orm',
          entry: 'orm',
        },
        {
          dir: 'packages/2-mongo-family/5-query-builders/query-builder',
          name: '@prisma-next/mongo-query-builder',
          entry: 'query-builder',
        },
        {
          dir: 'packages/2-mongo-family/6-transport/mongo-lowering',
          name: '@prisma-next/mongo-lowering',
          entry: 'lowering',
        },
        {
          dir: 'packages/2-mongo-family/6-transport/mongo-wire',
          name: '@prisma-next/mongo-wire',
          entry: 'wire',
        },
        {
          dir: 'packages/2-mongo-family/7-runtime',
          name: '@prisma-next/mongo-runtime',
          entry: 'runtime',
        },
        {
          dir: 'packages/2-mongo-family/9-family',
          name: '@prisma-next/family-mongo',
          entry: 'family',
        },
      ],
    },
  ],
  [
    '@prisma/orm-target-postgres',
    {
      dir: 'packages/9-public/@prisma/orm-target-postgres',
      kind: 'platform',
      packages: [
        {
          dir: 'packages/3-targets/3-targets/postgres',
          name: '@prisma-next/target-postgres',
          entry: 'target',
        },
        {
          dir: 'packages/3-targets/6-adapters/postgres',
          name: '@prisma-next/adapter-postgres',
          entry: 'adapter',
        },
        {
          dir: 'packages/3-targets/7-drivers/postgres',
          name: '@prisma-next/driver-postgres',
          entry: 'driver',
        },
      ],
    },
  ],
  [
    '@prisma/orm-target-sqlite',
    {
      dir: 'packages/9-public/@prisma/orm-target-sqlite',
      kind: 'platform',
      packages: [
        {
          dir: 'packages/3-targets/3-targets/sqlite',
          name: '@prisma-next/target-sqlite',
          entry: 'target',
        },
        {
          dir: 'packages/3-targets/6-adapters/sqlite',
          name: '@prisma-next/adapter-sqlite',
          entry: 'adapter',
        },
        {
          dir: 'packages/3-targets/7-drivers/sqlite',
          name: '@prisma-next/driver-sqlite',
          entry: 'driver',
        },
      ],
    },
  ],
  [
    '@prisma/orm-target-mongo',
    {
      dir: 'packages/9-public/@prisma/orm-target-mongo',
      kind: 'platform',
      packages: [
        {
          dir: 'packages/3-mongo-target/1-mongo-target',
          name: '@prisma-next/target-mongo',
          entry: 'target',
        },
        {
          dir: 'packages/3-mongo-target/2-mongo-adapter',
          name: '@prisma-next/adapter-mongo',
          entry: 'adapter',
        },
        {
          dir: 'packages/3-mongo-target/3-mongo-driver',
          name: '@prisma-next/driver-mongo',
          entry: 'driver',
        },
      ],
    },
  ],
  [
    '@prisma/orm-postgres',
    {
      dir: 'packages/9-public/@prisma/orm-postgres',
      kind: 'facade',
      packages: [
        { dir: 'packages/3-extensions/postgres', name: '@prisma-next/postgres', entry: '' },
      ],
      reexports: facadeReexports({
        family: '@prisma-next/sql-contract',
        familyPack: '@prisma-next/family-sql',
        runtime: '@prisma-next/sql-runtime',
        target: '@prisma-next/target-postgres',
        adapter: '@prisma-next/adapter-postgres',
        queryBuilders: SQL_QUERY_REEXPORTS,
      }),
      forwardedBins: FACADE_BINS,
    },
  ],
  [
    '@prisma/orm-sqlite',
    {
      dir: 'packages/9-public/@prisma/orm-sqlite',
      kind: 'facade',
      packages: [{ dir: 'packages/3-extensions/sqlite', name: '@prisma-next/sqlite', entry: '' }],
      reexports: facadeReexports({
        family: '@prisma-next/sql-contract',
        familyPack: '@prisma-next/family-sql',
        runtime: '@prisma-next/sql-runtime',
        target: '@prisma-next/target-sqlite',
        adapter: '@prisma-next/adapter-sqlite',
        queryBuilders: SQL_QUERY_REEXPORTS,
      }),
      forwardedBins: FACADE_BINS,
    },
  ],
  [
    '@prisma/orm-mongo',
    {
      dir: 'packages/9-public/@prisma/orm-mongo',
      kind: 'facade',
      packages: [{ dir: 'packages/3-extensions/mongo', name: '@prisma-next/mongo', entry: '' }],
      reexports: facadeReexports({
        family: '@prisma-next/mongo-contract',
        familyPack: '@prisma-next/family-mongo',
        runtime: '@prisma-next/mongo-runtime',
        target: '@prisma-next/target-mongo',
        adapter: '@prisma-next/adapter-mongo',
        driver: '@prisma-next/driver-mongo',
        queryBuilders: MONGO_QUERY_REEXPORTS,
      }),
      forwardedBins: FACADE_BINS,
    },
  ],
  [
    '@prisma/orm-extension-postgis',
    {
      dir: 'packages/9-public/@prisma/orm-extension-postgis',
      kind: 'extension',
      packages: [
        { dir: 'packages/3-extensions/postgis', name: '@prisma-next/extension-postgis', entry: '' },
      ],
      peerShells: ['@prisma/orm-target-postgres'],
    },
  ],
  [
    '@prisma/orm-extension-pgvector',
    {
      dir: 'packages/9-public/@prisma/orm-extension-pgvector',
      kind: 'extension',
      packages: [
        {
          dir: 'packages/3-extensions/pgvector',
          name: '@prisma-next/extension-pgvector',
          entry: '',
        },
      ],
      peerShells: ['@prisma/orm-target-postgres'],
    },
  ],
  [
    '@prisma/orm-extension-paradedb',
    {
      dir: 'packages/9-public/@prisma/orm-extension-paradedb',
      kind: 'extension',
      packages: [
        {
          dir: 'packages/3-extensions/paradedb',
          name: '@prisma-next/extension-paradedb',
          entry: '',
        },
      ],
      // ParadeDB registers its index type against the SQL family rather than
      // reaching the target at run time, so unlike its siblings it has no
      // shared registry to keep single-instance. It declares the peer anyway:
      // every Postgres extension pack states the same install requirement, and
      // a pack that quietly did not would read as a pack that works without
      // Postgres.
      peerShells: ['@prisma/orm-target-postgres'],
    },
  ],
  [
    '@prisma/orm-extension-supabase',
    {
      dir: 'packages/9-public/@prisma/orm-extension-supabase',
      kind: 'extension',
      packages: [
        {
          dir: 'packages/3-extensions/supabase',
          name: '@prisma-next/extension-supabase',
          entry: '',
        },
      ],
      peerShells: ['@prisma/orm-target-postgres'],
    },
  ],
  [
    '@prisma/orm-extension-arktype-json',
    {
      dir: 'packages/9-public/@prisma/orm-extension-arktype-json',
      kind: 'extension',
      packages: [
        {
          dir: 'packages/3-extensions/arktype-json',
          name: '@prisma-next/extension-arktype-json',
          entry: '',
        },
      ],
      peerShells: ['@prisma/orm-target-postgres'],
    },
  ],
  [
    '@prisma/orm-extension-middleware-cache',
    {
      dir: 'packages/9-public/@prisma/orm-extension-middleware-cache',
      kind: 'extension',
      packages: [
        {
          dir: 'packages/3-extensions/middleware-cache',
          name: '@prisma-next/middleware-cache',
          entry: '',
        },
      ],
    },
  ],
]);

/** Export subpaths that never ship in a shell (test-only surfaces). */
export const excludedSubpaths: readonly RegExp[] = [/^\.\/test(\/|$)/];
