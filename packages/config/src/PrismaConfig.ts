import {
  Debug,
  ErrorCapturingSqlMigrationAwareDriverAdapterFactory,
  SqlMigrationAwareDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'
import { Either, identity, Schema as Shape } from 'effect'
import { pipe } from 'effect/Function'

import { defineConfig } from './defineConfig'
import { PrismaConfigPackageJson, PrismaConfigPackageJsonShape } from './loadConfigFromPackageJson'
import type { Simplify } from './utils'

const debug = Debug('prisma:config:PrismaConfig')

const SqlMigrationAwareDriverAdapterFactoryShape = Shape.declare(
  (input: any): input is () => Promise<SqlMigrationAwareDriverAdapterFactory> => {
    return typeof input === 'function'
  },
  {
    identifier: 'SqlMigrationAwareDriverAdapterFactory',
    encode: identity,
    decode: identity,
  },
)

export type SqlMigrationAwareDriverAdapterFactoryShape =
  | undefined
  | (() => Promise<SqlMigrationAwareDriverAdapterFactory>)

const ErrorCapturingSqlMigrationAwareDriverAdapterFactoryShape = Shape.declare(
  (input: any): input is () => Promise<ErrorCapturingSqlMigrationAwareDriverAdapterFactory> => {
    return typeof input === 'function'
  },
  {
    identifier: 'ErrorCapturingSqlMigrationAwareDriverAdapterFactory',
    encode: identity,
    decode: identity,
  },
)

export type ExperimentalConfig = {
  /**
   * Enable experimental adapter support.
   */
  adapter?: boolean
  /**
   * Enable experimental Prisma Studio features.
   */
  studio?: boolean
  /**
   * Enable experimental external tables support.
   */
  externalTables?: boolean
  /**
   * Enable experimental extensions support. This is required to use the `extensions` config option.
   */
  extensions?: boolean
}

const SchemaEngineConfigClassicShape = Shape.Struct({
  engine: Shape.Literal('classic'),
  datasource: Shape.Struct({
    url: Shape.String,
    directUrl: Shape.optional(Shape.String),
    shadowDatabaseUrl: Shape.optional(Shape.String),
  }),
})

const SchemaEngineConfigJsShape = Shape.Struct({
  engine: Shape.Literal('js'),
  adapter: SqlMigrationAwareDriverAdapterFactoryShape,
})

const SchemaEngineConfigAbsentShape = Shape.Struct({
  engine: Shape.optional(Shape.Never),
})

const SchemaEngineConfigShape = Shape.Union(
  SchemaEngineConfigClassicShape,
  SchemaEngineConfigJsShape,
  SchemaEngineConfigAbsentShape,
)

type SchemaEngineConfigJs = {
  /**
   * Uses the new, unstable JavaScript based Schema Engine.
   */
  engine: 'js'
  /**
   * The function that instantiates the driver adapter to use for the JavaScript based Schema Engine.
   */
  adapter: () => Promise<SqlMigrationAwareDriverAdapterFactory>
}

type SchemaEngineConfigJsInternal = {
  /**
   * Uses the new, unstable JavaScript based Schema Engine.
   */
  engine: 'js'
  /**
   * The function that instantiates the driver adapter to use for the JavaScript based Schema Engine.
   */
  adapter: () => Promise<ErrorCapturingSqlMigrationAwareDriverAdapterFactory>
}

export type SchemaEngineConfigClassicDatasource = {
  url: string
  directUrl?: string
  shadowDatabaseUrl?: string
}

type SchemaEngineConfigClassic = {
  /**
   * Uses the "old classic" Schema Engine binary
   */
  engine: 'classic'
  /**
   * The database connection configuration, which overwrites the `datasource` block's `url`-like attributes in the Prisma schema file.
   */
  datasource: SchemaEngineConfigClassicDatasource
}

type SchemaEngineConfigAbsent = {
  engine?: never
}

type SchemaEngineConfig = SchemaEngineConfigJs | SchemaEngineConfigClassic | SchemaEngineConfigAbsent

export type SchemaEngineConfigInternal =
  | SchemaEngineConfigJsInternal
  | SchemaEngineConfigClassic
  | SchemaEngineConfigAbsent

const SchemaEngineConfigJsInternal = Shape.Struct({
  engine: Shape.Literal('js'),
  adapter: ErrorCapturingSqlMigrationAwareDriverAdapterFactoryShape,
})

const SchemaEngineConfigInternal = Shape.Union(
  SchemaEngineConfigClassicShape,
  SchemaEngineConfigJsInternal,
  SchemaEngineConfigAbsentShape,
)

const ExperimentalConfigShape = Shape.Struct({
  adapter: Shape.optional(Shape.Boolean),
  studio: Shape.optional(Shape.Boolean),
  externalTables: Shape.optional(Shape.Boolean),
  extensions: Shape.optional(Shape.Boolean),
})

declare const __testExperimentalConfigShapeValueA: (typeof ExperimentalConfigShape)['Type']
declare const __testExperimentalConfigShapeValueB: ExperimentalConfig

// eslint-disable-next-line no-constant-condition
if (false) {
  __testExperimentalConfigShapeValueA satisfies ExperimentalConfig
  __testExperimentalConfigShapeValueB satisfies (typeof ExperimentalConfigShape)['Type']
}

export type MigrationsConfigShape = {
  /**
   * The path to the directory where Prisma should store migration files, and look for them.
   */
  path?: string
  /**
   * Provide a SQL script that will be used to setup external tables and enums during migration diffing.
   * Also see `tables.external` and `enums.external`.
   */
  initShadowDb?: string
  /**
   * The command to run to seed the database after schema migrations are applied.
   */
  seed?: string
}

const MigrationsConfigShape = Shape.Struct({
  path: Shape.optional(Shape.String),
  initShadowDb: Shape.optional(Shape.String),
  seed: Shape.optional(Shape.NonEmptyString),
})

// The exported types are re-declared manually instead of using the Shape.Type
// types because `effect` types make API Extractor crash, making it impossible
// to bundle them, and `effect` is too large to ship as a full dependency
// without bundling and tree-shaking. The following tests ensure that the
// exported types are structurally equal to the ones defined by the schemas.
declare const __testMigrationsConfigShapeValueA: (typeof MigrationsConfigShape)['Type']
declare const __testMigrationsConfigShapeValueB: MigrationsConfigShape

// eslint-disable-next-line no-constant-condition
if (false) {
  __testMigrationsConfigShapeValueA satisfies MigrationsConfigShape
  __testMigrationsConfigShapeValueB satisfies (typeof MigrationsConfigShape)['Type']
}

export type TablesConfigShape = {
  /**
   * List of tables that are externally managed.
   * Prisma will not modify the structure of these tables and not generate migrations for those tables.
   * These tables will still be represented in schema.prisma file and be available in the client API.
   */
  external?: string[]
}

const TablesConfigShape = Shape.Struct({
  external: Shape.optional(Shape.mutable(Shape.Array(Shape.String))),
})

declare const __testTablesConfigShapeValueA: (typeof TablesConfigShape)['Type']
declare const __testTablesConfigShapeValueB: TablesConfigShape

// eslint-disable-next-line no-constant-condition
if (false) {
  __testTablesConfigShapeValueA satisfies TablesConfigShape
  __testTablesConfigShapeValueB satisfies (typeof TablesConfigShape)['Type']
}

export type EnumsConfigShape = {
  /**
   * List of enums that are externally managed.
   * Prisma will not modify the structure of these enums and not generate migrations for those enums.
   * These enums will still be represented in schema.prisma file and be available in the client API.
   */
  external?: string[]
}

const EnumsConfigShape = Shape.Struct({
  external: Shape.optional(Shape.mutable(Shape.Array(Shape.String))),
})

declare const __testEnumsConfigShapeValueA: (typeof EnumsConfigShape)['Type']
declare const __testEnumsConfigShapeValueB: EnumsConfigShape

// eslint-disable-next-line no-constant-condition
if (false) {
  __testEnumsConfigShapeValueA satisfies EnumsConfigShape
  __testEnumsConfigShapeValueB satisfies (typeof EnumsConfigShape)['Type']
}

export type ViewsConfigShape = {
  /**
   * The path to the directory where Prisma should look for the view definitions, where *.sql files will be loaded.
   */
  path?: string
}

const ViewsConfigShape = Shape.Struct({
  path: Shape.optional(Shape.String),
})

declare const __testViewsConfigShapeValueA: (typeof ViewsConfigShape)['Type']
declare const __testViewsConfigShapeValueB: ViewsConfigShape

// eslint-disable-next-line no-constant-condition
if (false) {
  __testViewsConfigShapeValueA satisfies ViewsConfigShape
  __testViewsConfigShapeValueB satisfies (typeof ViewsConfigShape)['Type']
}

export type TypedSqlConfigShape = {
  /**
   * The path to the directory where Prisma should look for the `typedSql` queries, where *.sql files will be loaded.
   */
  path?: string
}

const TypedSqlConfigShape = Shape.Struct({
  path: Shape.optional(Shape.String),
})

declare const __testTypedSqlConfigShapeValueA: (typeof TypedSqlConfigShape)['Type']
declare const __testTypedSqlConfigShapeValueB: TypedSqlConfigShape

// eslint-disable-next-line no-constant-condition
if (false) {
  __testTypedSqlConfigShapeValueA satisfies TypedSqlConfigShape
  __testTypedSqlConfigShapeValueB satisfies (typeof TypedSqlConfigShape)['Type']
}

export type PrismaStudioConfigShape = {
  adapter: () => Promise<SqlMigrationAwareDriverAdapterFactory>
}

const PrismaStudioConfigShape = Shape.Struct({
  /**
   * Instantiates the Prisma driver adapter to use for Prisma Studio.
   */
  adapter: SqlMigrationAwareDriverAdapterFactoryShape,
})

declare const __testPrismaStudioConfigShapeValueA: (typeof PrismaStudioConfigShape)['Type']
declare const __testPrismaStudioConfigShapeValueB: PrismaStudioConfigShape

// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaStudioConfigShapeValueA satisfies PrismaStudioConfigShape
  __testPrismaStudioConfigShapeValueB satisfies (typeof PrismaStudioConfigShape)['Type']
}

// Ensure that the keys of the `PrismaConfig` type are the same as the keys of the `PrismaConfigInternal` type.
// (Except for the internal only `loadedFromFile` property)
// This prevents us from bugs caused by only updating one of the two types and shapes, without also updating the other one.
// Type assertion blocks below are for type safety only and may be skipped if union types are not strictly compatible.
declare const __testPrismaConfig: keyof (typeof PrismaConfigShape)['Type']
declare const __testPrismaConfigInternal: keyof Omit<
  (typeof PrismaConfigInternalShape)['Type'],
  'loadedFromFile' | 'deprecatedPackageJson'
>

// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfig satisfies typeof __testPrismaConfigInternal
  __testPrismaConfigInternal satisfies typeof __testPrismaConfig
}

const PrismaConfigUnconditionalShape = Shape.Struct({
  // engine: Shape.optional(Shape.Never),
  experimental: Shape.optional(ExperimentalConfigShape),
  schema: Shape.optional(Shape.String),
  studio: Shape.optional(PrismaStudioConfigShape),
  migrations: Shape.optional(MigrationsConfigShape),
  tables: Shape.optional(TablesConfigShape),
  enums: Shape.optional(EnumsConfigShape),
  views: Shape.optional(ViewsConfigShape),
  typedSql: Shape.optional(TypedSqlConfigShape),
  extensions: Shape.optional(Shape.Any),
})

// Define the shape for the user-facing `PrismaConfig` type.
const PrismaConfigShape = Shape.extend(SchemaEngineConfigShape, PrismaConfigUnconditionalShape)

type PrismaConfigUnconditional = {
  /**
   * Experimental feature gates. Each experimental feature must be explicitly enabled.
   */
  experimental?: Simplify<ExperimentalConfig>
  /**
   * The path to the schema file, or path to a folder that shall be recursively searched for *.prisma files.
   */
  schema?: string
  /**
   * The configuration for Prisma Studio.
   */
  studio?: Simplify<PrismaStudioConfigShape>
  /**
   * Configuration for Prisma migrations.
   */
  migrations?: Simplify<MigrationsConfigShape>
  /**
   * Configuration for the database table entities.
   */
  tables?: Simplify<TablesConfigShape>
  /**
   * Configuration for the database enum entities.
   */
  enums?: Simplify<EnumsConfigShape>
  /**
   * Configuration for the database view entities.
   */
  views?: Simplify<ViewsConfigShape>
  /**
   * Configuration for the `typedSql` preview feature.
   */
  typedSql?: Simplify<TypedSqlConfigShape>
}

/**
 * The configuration for the Prisma Development Kit, before it is passed to the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfig = PrismaConfigUnconditional & SchemaEngineConfig

declare const __testPrismaConfigValueA: (typeof PrismaConfigUnconditionalShape)['Type']
declare const __testPrismaConfigValueB: PrismaConfigUnconditional
// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfigValueA satisfies PrismaConfigUnconditional
  __testPrismaConfigValueB satisfies (typeof PrismaConfigUnconditionalShape)['Type']
}

/**
 * Validates that experimental features are enabled when using corresponding configuration options.
 */
function validateExperimentalFeatures(config: PrismaConfig): Either.Either<PrismaConfig, Error> {
  const experimental = config.experimental || {}

  // Check studio configuration
  if (config.studio && !experimental.studio) {
    return Either.left(new Error('The `studio` configuration requires `experimental.studio` to be set to `true`.'))
  }

  // Check external tables configuration
  if (config.tables?.external && !experimental.externalTables) {
    return Either.left(
      new Error('The `tables.external` configuration requires `experimental.externalTables` to be set to `true`.'),
    )
  }

  // Check external enums configuration
  if (config.enums?.external && !experimental.externalTables) {
    return Either.left(
      new Error('The `enums.external` configuration requires `experimental.externalTables` to be set to `true`.'),
    )
  }

  // Check migrations initShadowDb configuration
  if (config.migrations?.initShadowDb && !experimental.externalTables) {
    return Either.left(
      new Error(
        'The `migrations.initShadowDb` configuration requires `experimental.externalTables` to be set to `true`.',
      ),
    )
  }

  if (config['extensions'] && !experimental.extensions) {
    return Either.left(
      new Error('The `extensions` configuration requires `experimental.extensions` to be set to `true`.'),
    )
  }

  return Either.right(config)
}

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type Shape.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfigShape(input: unknown): Either.Either<PrismaConfig, Error> {
  return pipe(
    Shape.decodeUnknownEither(PrismaConfigShape, {})(input, {
      onExcessProperty: 'error',
    }),
    Either.flatMap((c) => validateExperimentalFeatures(c)),
  )
}

const PRISMA_CONFIG_INTERNAL_BRAND = Symbol.for('PrismaConfigInternal')

// Define the shape for the `PrismaConfigInternal` type.
// We don't want people to construct this type directly (structurally), so we turn it opaque via a branded type.
const PrismaConfigInternalShape = Shape.extend(
  PrismaConfigUnconditionalShape,
  Shape.extend(
    SchemaEngineConfigInternal,
    Shape.Struct({
      loadedFromFile: Shape.NullOr(Shape.String),
      deprecatedPackageJson: Shape.NullOr(
        Shape.Struct({
          config: PrismaConfigPackageJsonShape,
          loadedFromFile: Shape.String,
        }),
      ),
    }),
  ),
)

type _PrismaConfigInternal = Omit<PrismaConfig, 'engine' | 'datasource' | 'adapter'> & {
  loadedFromFile: string | null
  /**
   * The deprecated Prisma configuration from `package.json#prisma`.
   * This is set to `null` if no `package.json#prisma` config was found.
   * The configuration read from the Prisma config file (e.g., `prisma.config.ts`) takes precedence over
   * this `package.json#prisma` config.
   * @deprecated
   */
  deprecatedPackageJson: {
    /**
     * The Prisma configuration from `package.json#prisma`.
     * @deprecated
     */
    config: PrismaConfigPackageJson

    /**
     * The path from where the `package.json` config was loaded.
     * @deprecated
     */
    loadedFromFile: string
  } | null
} & (
    | {
        engine: 'classic'
        datasource: {
          url: string
          shadowDatabaseUrl?: string
        }
      }
    | {
        engine: 'js'
        adapter: () => Promise<ErrorCapturingSqlMigrationAwareDriverAdapterFactory>
      }
    | {
        engine?: never
      }
  )

/**
 * The configuration for the Prisma Development Kit, after it has been parsed and processed
 * by the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfigInternal = _PrismaConfigInternal & {
  __brand: typeof PRISMA_CONFIG_INTERNAL_BRAND
}

function brandPrismaConfigInternal(config: _PrismaConfigInternal): PrismaConfigInternal {
  Object.defineProperty(config, '__brand', {
    value: PRISMA_CONFIG_INTERNAL_BRAND,
    writable: true,
    configurable: true,
    enumerable: false,
  })
  return config as PrismaConfigInternal
}

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfigInternal` type Shape.
 * This function may fail, but it will never throw.
 */
function parsePrismaConfigInternalShape(input: unknown): Either.Either<PrismaConfigInternal, Error> {
  debug('Parsing PrismaConfigInternal: %o', input)

  // Bypass the parsing step when the input is already an object with the correct internal brand.
  if (typeof input === 'object' && input !== null && input['__brand'] === PRISMA_CONFIG_INTERNAL_BRAND) {
    debug('Short-circuit: input is already a PrismaConfigInternal object')
    return Either.right(input as PrismaConfigInternal)
  }

  return pipe(
    Shape.decodeUnknownEither(PrismaConfigInternalShape, {})(input, {
      onExcessProperty: 'error',
    }),
    // Brand the output type to make `PrismaConfigInternal` opaque, without exposing the `Effect/Brand` type
    // to the public API.
    // This is done to work around the following issues:
    // - https://github.com/microsoft/rushstack/issues/1308
    // - https://github.com/microsoft/rushstack/issues/4034
    // - https://github.com/microsoft/TypeScript/issues/58914
    Either.map(brandPrismaConfigInternal),
  )
}

export function makePrismaConfigInternal(makeArgs: _PrismaConfigInternal): PrismaConfigInternal {
  return brandPrismaConfigInternal(makeArgs)
}

export function parseDefaultExport(defaultExport: unknown) {
  const parseResultEither = pipe(
    // If the given config conforms to the `PrismaConfig` shape, feed it to `defineConfig`.
    parsePrismaConfigShape(defaultExport),
    Either.map((config) => {
      debug('Parsed `PrismaConfig` shape: %o', config)
      return defineConfig(config)
    }),
    // Otherwise, try to parse it as a `PrismaConfigInternal` shape.
    Either.orElse(() => parsePrismaConfigInternalShape(defaultExport)),
  )

  // Failure case
  if (Either.isLeft(parseResultEither)) {
    throw parseResultEither.left
  }

  // Success case
  return parseResultEither.right
}
