import {
  Debug,
  ErrorCapturingSqlMigrationAwareDriverAdapterFactory,
  SqlMigrationAwareDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'
import { Either, identity, Schema as Shape } from 'effect'
import { pipe } from 'effect/Function'

import { defineConfig } from './defineConfig'

const debug = Debug('prisma:config:PrismaConfig')

type EnvVars = Record<string, string | undefined>

const sqlMigrationAwareDriverAdapterFactoryShape = <Env extends EnvVars = never>() =>
  Shape.declare(
    (input: any): input is (env: Env) => Promise<SqlMigrationAwareDriverAdapterFactory> => {
      return typeof input === 'function'
    },
    {
      identifier: 'SqlMigrationAwareDriverAdapterFactory<Env>',
      encode: identity,
      decode: identity,
    },
  )

const errorCapturingSqlMigrationAwareDriverAdapterFactoryShape = <Env extends EnvVars = never>() =>
  Shape.declare(
    (input: any): input is (env: Env) => Promise<ErrorCapturingSqlMigrationAwareDriverAdapterFactory> => {
      return typeof input === 'function'
    },
    {
      identifier: 'ErrorCapturingSqlMigrationAwareDriverAdapterFactory<Env>',
      encode: identity,
      decode: identity,
    },
  )

export type PrismaStudioConfigShape<Env extends EnvVars = never> = {
  /**
   * Instantiates the Prisma driver adapter to use for Prisma Studio.
   */
  adapter: (env: Env) => Promise<SqlMigrationAwareDriverAdapterFactory>
}

const createPrismaStudioConfigShape = <Env extends EnvVars = never>() =>
  Shape.Struct({
    adapter: sqlMigrationAwareDriverAdapterFactoryShape<Env>(),
  })

export type PrismaMigrateConfigShape<Env extends EnvVars = never> = {
  /**
   * Instantiates the Prisma driver adapter to use for Prisma Migrate + Introspect.
   */
  adapter?: (env: Env) => Promise<SqlMigrationAwareDriverAdapterFactory>
  /**
   * Path to the directory where migrations are stored.
   * If not provided, the migrations directory will be placed next to the schema file that defines the datasource block.
   * See https://www.prisma.io/docs/orm/prisma-schema/overview/location for more details.
   */
  migrationsDirectory?: string
}

const createPrismaMigrateConfigShape = <Env extends EnvVars = never>() =>
  Shape.Struct({
    adapter: Shape.optional(sqlMigrationAwareDriverAdapterFactoryShape<Env>()),
    migrationsDirectory: Shape.optional(Shape.String),
  })

export type PrismaMigrateConfigInternalShape<Env extends EnvVars = never> = {
  adapter?: (env: Env) => Promise<ErrorCapturingSqlMigrationAwareDriverAdapterFactory>
  migrationsDirectory?: string
}

const createPrismaMigrateConfigInternalShape = <Env extends EnvVars = never>() =>
  Shape.Struct({
    adapter: Shape.optional(errorCapturingSqlMigrationAwareDriverAdapterFactoryShape<Env>()),
    migrationsDirectory: Shape.optional(Shape.String),
  })

// The exported types are re-declared manually instead of using the Shape.Type
// types because `effect` types make API Extractor crash, making it impossible
// to bundle them, and `effect` is too large to ship as a full dependency
// without bundling and tree-shaking. The following tests ensure that the
// exported types are structurally equal to the ones defined by the schemas.
declare const __testPrismaStudioConfigShapeValueA: ReturnType<typeof createPrismaStudioConfigShape>['Type']
declare const __testPrismaStudioConfigShapeValueB: PrismaStudioConfigShape<EnvVars>
declare const __testPrismaMigrateConfigShapeValueA: ReturnType<typeof createPrismaMigrateConfigInternalShape>['Type']
declare const __testPrismaMigrateConfigShapeValueB: PrismaMigrateConfigInternalShape<EnvVars>

// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaStudioConfigShapeValueA satisfies PrismaStudioConfigShape<EnvVars>
  __testPrismaStudioConfigShapeValueB satisfies ReturnType<typeof createPrismaStudioConfigShape>['Type']
  __testPrismaMigrateConfigShapeValueA satisfies PrismaMigrateConfigInternalShape<EnvVars>
  __testPrismaMigrateConfigShapeValueB satisfies ReturnType<typeof createPrismaMigrateConfigInternalShape>['Type']
}

// Ensure that the keys of the `PrismaConfig` type are the same as the keys of the `PrismaConfigInternal` type.
// (Except for the internal only `loadedFromFile` property)
// This prevents us from bugs caused by only updating one of the two types and shapes, without also updating the other one.
declare const __testPrismaConfig: keyof ReturnType<typeof createPrismaConfigShape>['Type']
declare const __testPrismaConfigInternal: keyof Omit<
  ReturnType<typeof createPrismaConfigInternalShape>['Type'],
  'loadedFromFile'
>

// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfig satisfies typeof __testPrismaConfigInternal
  __testPrismaConfigInternal satisfies typeof __testPrismaConfig
}

// Define the shape for the `PrismaConfig` type.
const createPrismaConfigShape = <Env extends EnvVars = never>() =>
  Shape.Struct({
    earlyAccess: Shape.Literal(true),
    schema: Shape.optional(Shape.String),
    viewsDirectory: Shape.optional(Shape.String),
    typedSqlDirectory: Shape.optional(Shape.String),
    studio: Shape.optional(createPrismaStudioConfigShape<Env>()),
    migrate: Shape.optional(createPrismaMigrateConfigShape<Env>()),
  })

/**
 * The configuration for the Prisma Development Kit, before it is passed to the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfig<Env extends EnvVars = never> = {
  /**
   * Whether features with an unstable API are enabled.
   */
  earlyAccess: true
  /**
   * The path to the schema file or path to a folder that shall be recursively searched for .prisma files.
   */
  schema?: string
  /**
   * The path to the directory where view definition files are stored.
   */
  viewsDirectory?: string
  /**
   * The path to the directory where typed SQL definition files are stored.
   */
  typedSqlDirectory?: string
  /**
   * The configuration for Prisma Studio.
   */
  studio?: PrismaStudioConfigShape<Env>
  /**
   * The configuration for Prisma Migrate + Introspect
   */
  migrate?: PrismaMigrateConfigShape<Env>
}

declare const __testPrismaConfigValueA: ReturnType<typeof createPrismaConfigShape>['Type']
declare const __testPrismaConfigValueB: PrismaConfig<EnvVars>
// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfigValueA satisfies PrismaConfig<EnvVars>
  __testPrismaConfigValueB satisfies ReturnType<typeof createPrismaConfigShape>['Type']
}

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type Shape.
 * This function may fail, but it will never throw.
 */
function parsePrismaConfigShape<Env extends EnvVars = never>(input: unknown): Either.Either<PrismaConfig<Env>, Error> {
  return Shape.decodeUnknownEither(createPrismaConfigShape<Env>(), {})(input, {
    onExcessProperty: 'error',
  })
}

const PRISMA_CONFIG_INTERNAL_BRAND = Symbol.for('PrismaConfigInternal')

// Define the shape for the `PrismaConfigInternal` type.
// We don't want people to construct this type directly (structurally), so we turn it opaque via a branded type.
const createPrismaConfigInternalShape = <Env extends EnvVars = never>() =>
  Shape.Struct({
    earlyAccess: Shape.Literal(true),
    schema: Shape.optional(Shape.String),
    viewsDirectory: Shape.optional(Shape.String),
    typedSqlDirectory: Shape.optional(Shape.String),
    studio: Shape.optional(createPrismaStudioConfigShape<Env>()),
    migrate: Shape.optional(createPrismaMigrateConfigInternalShape<Env>()),
    loadedFromFile: Shape.NullOr(Shape.String),
  })

type _PrismaConfigInternal<Env extends EnvVars = never> = {
  /**
   * Whether features with an unstable API are enabled.
   */
  earlyAccess: true
  /**
   * The path to the schema file or path to a folder that shall be recursively searched for .prisma files.
   */
  schema?: string
  /**
   * The path to the directory where view definition files are stored.
   */
  viewsDirectory?: string
  /**
   * The path to the directory where typed SQL definition files are stored.
   */
  typedSqlDirectory?: string
  /**
   * The configuration for Prisma Studio.
   */
  studio?: PrismaStudioConfigShape<Env>
  /**
   * The configuration for Prisma Migrate + Introspect
   */
  migrate?: PrismaMigrateConfigInternalShape<Env>
  /**
   * The path from where the config was loaded.
   * It's set to `null` if no config file was found and only default config is applied.
   */
  loadedFromFile: string | null
}

declare const __testPrismaConfigInternalValueA: ReturnType<typeof createPrismaConfigInternalShape>['Type']
declare const __testPrismaConfigInternalValueB: _PrismaConfigInternal<EnvVars>
// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfigInternalValueA satisfies _PrismaConfigInternal
  __testPrismaConfigInternalValueB satisfies ReturnType<typeof createPrismaConfigInternalShape>['Type']
}

/**
 * The configuration for the Prisma Development Kit, after it has been parsed and processed
 * by the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfigInternal<Env extends EnvVars = never> = _PrismaConfigInternal<Env> & {
  __brand: typeof PRISMA_CONFIG_INTERNAL_BRAND
}

function brandPrismaConfigInternal<Env extends EnvVars = never>(
  config: _PrismaConfigInternal<Env>,
): PrismaConfigInternal<Env> {
  Object.defineProperty(config, '__brand', {
    value: PRISMA_CONFIG_INTERNAL_BRAND,
    writable: true,
    configurable: true,
    enumerable: false,
  })
  return config as PrismaConfigInternal<Env>
}

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfigInternal` type Shape.
 * This function may fail, but it will never throw.
 */
function parsePrismaConfigInternalShape<Env extends EnvVars = never>(
  input: unknown,
): Either.Either<PrismaConfigInternal<Env>, Error> {
  debug('Parsing PrismaConfigInternal: %o', input)

  // Bypass the parsing step when the input is already an object with the correct internal brand.
  if (typeof input === 'object' && input !== null && input['__brand'] === PRISMA_CONFIG_INTERNAL_BRAND) {
    debug('Short-circuit: input is already a PrismaConfigInternal object')
    return Either.right(input as PrismaConfigInternal<Env>)
  }

  return pipe(
    Shape.decodeUnknownEither(createPrismaConfigInternalShape<Env>(), {})(input, {
      onExcessProperty: 'error',
    }),
    // Brand the output type to make `PrismaConfigInternal` opaque, without exposing the `Effect/Brand` type
    // to the public API.
    // This is done to work around the following issues:
    // - https://github.com/microsoft/rushstack/issues/1308
    // - https://github.com/microsoft/rushstack/issues/4034
    // - https://github.com/microsoft/TypeScript/issues/58914
    Either.map(brandPrismaConfigInternal<Env>),
  )
}

export function makePrismaConfigInternal<Env extends EnvVars = never>(
  makeArgs: _PrismaConfigInternal<Env>,
): PrismaConfigInternal<Env> {
  return pipe(createPrismaConfigInternalShape<Env>().make(makeArgs), brandPrismaConfigInternal<Env>)
}

export function parseDefaultExport(defaultExport: unknown) {
  const parseResultEither = pipe(
    // If the given config conforms to the `PrismaConfig` shape, feed it to `defineConfig`.
    parsePrismaConfigShape<any>(defaultExport),
    Either.map((config) => {
      debug('Parsed `PrismaConfig` shape: %o', config)
      return defineConfig<any>(config)
    }),
    // Otherwise, try to parse it as a `PrismaConfigInternal` shape.
    Either.orElse(() => parsePrismaConfigInternalShape<any>(defaultExport)),
  )

  // Failure case
  if (Either.isLeft(parseResultEither)) {
    throw parseResultEither.left
  }

  // Success case
  return parseResultEither.right
}
