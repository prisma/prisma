import {
  Debug,
  ErrorCapturingSqlMigrationAwareDriverAdapterFactory,
  SqlMigrationAwareDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'
import { Either, identity, Schema as Shape, Struct } from 'effect'
import { pipe } from 'effect/Function'

import { defineConfig } from './defineConfig'
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

const SetupExternalTablesShape = Shape.declare(
  (input: any): input is () => Promise<string> => {
    return typeof input === 'function'
  },
  {
    identifier: 'SetupExternalTables',
    encode: identity,
    decode: identity,
  },
)

export type MigrationsConfigShape = {
  /**
   * The path to the directory where Prisma should store migration files, and look for them.
   */
  path?: string
  /**
   * Provide a function to pass a SQL script that will be used to setup external tables during migration diffing.
   * Also see `tables.external`.
   */
  setupExternalTables?: () => Promise<string>
}

const MigrationsConfigShape = Shape.Struct({
  path: Shape.optional(Shape.String),
  setupExternalTables: Shape.optional(SetupExternalTablesShape),
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
declare const __testPrismaConfig: keyof (typeof PrismaConfigShape)['Type']
declare const __testPrismaConfigInternal: keyof Omit<(typeof PrismaConfigInternalShape)['Type'], 'loadedFromFile'>

// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfig satisfies typeof __testPrismaConfigInternal
  __testPrismaConfigInternal satisfies typeof __testPrismaConfig
}

// Define the shape for the user-facing `PrismaConfig` type.
const PrismaConfigShape = Shape.Struct({
  earlyAccess: Shape.Literal(true),
  schema: Shape.optional(Shape.String),
  studio: Shape.optional(PrismaStudioConfigShape),
  adapter: Shape.optional(SqlMigrationAwareDriverAdapterFactoryShape),
  migrations: Shape.optional(MigrationsConfigShape),
  tables: Shape.optional(TablesConfigShape),
  views: Shape.optional(ViewsConfigShape),
  typedSql: Shape.optional(TypedSqlConfigShape),
})

/**
 * The configuration for the Prisma Development Kit, before it is passed to the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfig = {
  /**
   * Whether features with an unstable API are enabled.
   */
  earlyAccess: true
  /**
   * The path to the schema file, or path to a folder that shall be recursively searched for *.prisma files.
   */
  schema?: string
  /**
   * The Driver Adapter used for Prisma CLI.
   */
  adapter?: () => Promise<SqlMigrationAwareDriverAdapterFactory>
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
   * Configuration for the database view entities.
   */
  views?: Simplify<ViewsConfigShape>
  /**
   * Configuration for the `typedSql` preview feature.
   */
  typedSql?: Simplify<TypedSqlConfigShape>
}

declare const __testPrismaConfigValueA: (typeof PrismaConfigShape)['Type']
declare const __testPrismaConfigValueB: PrismaConfig
// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfigValueA satisfies PrismaConfig
  __testPrismaConfigValueB satisfies (typeof PrismaConfigShape)['Type']
}

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type Shape.
 * This function may fail, but it will never throw.
 */
function parsePrismaConfigShape(input: unknown): Either.Either<PrismaConfig, Error> {
  return Shape.decodeUnknownEither(PrismaConfigShape, {})(input, {
    onExcessProperty: 'error',
  })
}

const PRISMA_CONFIG_INTERNAL_BRAND = Symbol.for('PrismaConfigInternal')

// Define the shape for the `PrismaConfigInternal` type.
// We don't want people to construct this type directly (structurally), so we turn it opaque via a branded type.
const PrismaConfigInternalShape = Shape.Struct({
  ...Struct.omit(PrismaConfigShape.fields, 'adapter'),
  adapter: Shape.optional(ErrorCapturingSqlMigrationAwareDriverAdapterFactoryShape),
  loadedFromFile: Shape.NullOr(Shape.String),
})

type _PrismaConfigInternal = Omit<PrismaConfig, 'adapter'> & {
  /**
   * The Driver Adapter used for Prisma CLI.
   */
  adapter?: () => Promise<ErrorCapturingSqlMigrationAwareDriverAdapterFactory>
  /**
   * The path from where the config was loaded.
   * It's set to `null` if no config file was found and only default config is applied.
   */
  loadedFromFile: string | null
}

declare const __testPrismaConfigInternalValueA: (typeof PrismaConfigInternalShape)['Type']
declare const __testPrismaConfigInternalValueB: _PrismaConfigInternal
// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfigInternalValueA satisfies _PrismaConfigInternal
  __testPrismaConfigInternalValueB satisfies (typeof PrismaConfigInternalShape)['Type']
}

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
  return pipe(PrismaConfigInternalShape.make(makeArgs), brandPrismaConfigInternal)
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
