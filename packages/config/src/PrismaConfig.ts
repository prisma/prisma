import {
  Debug,
  ErrorCapturingSqlMigrationAwareDriverAdapterFactory,
  SqlDriverAdapter,
  SqlMigrationAwareDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'
import { Either, identity, Schema as Shape } from 'effect'
import { pipe } from 'effect/Function'

import { defineConfig } from './defineConfig'

const debug = Debug('prisma:config:PrismaConfig')

type EnvVars = Record<string, string | undefined>

const errorCapturingSqlQueryableShape = Shape.declare(
  (input: any): input is SqlDriverAdapter => {
    // TODO: add `Symbol` checks instead.
    return typeof input['provider'] === 'string' && typeof input['adapterName'] === 'string'
  },
  {
    identifier: 'SqlDriverAdapter',
    encode: identity,
    decode: identity,
  },
)

const errorCapturingSqlDriverAdapterFactoryShape = Shape.declare(
  (input: any): input is ErrorCapturingSqlMigrationAwareDriverAdapterFactory => {
    // TODO: add `Symbol` checks instead.
    return (
      typeof input['provider'] === 'string' &&
      typeof input['adapterName'] === 'string' &&
      typeof input['errorRegistry'] === 'object' &&
      input['connect'] instanceof Function &&
      input['connectToShadowDb'] instanceof Function
    )
  },
  {
    identifier: 'ErrorCapturingSqlMigrationAwareDriverAdapterFactory',
    encode: identity,
    decode: identity,
  },
)

export type PrismaStudioConfigShape<Env extends EnvVars = never> = {
  adapter: (env: Env) => Promise<SqlDriverAdapter>
}

export type PrismaStudioConfigInternalShape = {
  adapter: SqlDriverAdapter
}

const prismaStudioConfigInternalShape = Shape.Struct({
  /**
   * Instantiates the Prisma driver adapter to use for Prisma Studio.
   */
  adapter: errorCapturingSqlQueryableShape,
})

export type PrismaMigrateConfigShape<Env extends EnvVars = never> = {
  adapter: (env: Env) => Promise<SqlMigrationAwareDriverAdapterFactory>
}

export type PrismaMigrateConfigInternalShape = {
  adapter: ErrorCapturingSqlMigrationAwareDriverAdapterFactory
}

const prismaMigrateConfigInternalShape = Shape.Struct({
  /**
   * Instantiates the Prisma driver adapter to use for Prisma Migrate + Introspect.
   */
  adapter: errorCapturingSqlDriverAdapterFactoryShape,
})

// The exported types are re-declared manually instead of using the Shape.Type
// types because `effect` types make API Extractor crash, making it impossible
// to bundle them, and `effect` is too large to ship as a full dependency
// without bundling and tree-shaking. The following tests ensure that the
// exported types are structurally equal to the ones defined by the schemas.
declare const __testPrismaStudioConfigShapeValueA: (typeof prismaStudioConfigInternalShape)['Type']
declare const __testPrismaStudioConfigShapeValueB: PrismaStudioConfigInternalShape
declare const __testPrismaMigrateConfigShapeValueA: (typeof prismaMigrateConfigInternalShape)['Type']
declare const __testPrismaMigrateConfigShapeValueB: PrismaMigrateConfigInternalShape

// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaStudioConfigShapeValueA satisfies PrismaStudioConfigInternalShape
  __testPrismaStudioConfigShapeValueB satisfies (typeof prismaStudioConfigInternalShape)['Type']
  __testPrismaMigrateConfigShapeValueA satisfies PrismaMigrateConfigInternalShape
  __testPrismaMigrateConfigShapeValueB satisfies (typeof prismaMigrateConfigInternalShape)['Type']
}

// Define the shape for the `PrismaConfig` type.
const createPrismaConfigShape = () =>
  Shape.Struct({
    earlyAccess: Shape.Literal(true),
    schema: Shape.optional(Shape.String),
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
   * The configuration for Prisma Studio.
   */
  studio?: PrismaStudioConfigShape<Env>
  /**
   * The configuration for Prisma Migrate + Introspect
   */
  migrate?: PrismaMigrateConfigShape<Env>
}

declare const __testPrismaConfigValueA: ReturnType<typeof createPrismaConfigShape>['Type']
declare const __testPrismaConfigValueB: PrismaConfig
// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaConfigValueA satisfies PrismaConfig
  __testPrismaConfigValueB satisfies ReturnType<typeof createPrismaConfigShape>['Type']
}

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type Shape.
 * This function may fail, but it will never throw.
 */
function parsePrismaConfigShape(input: unknown): Either.Either<PrismaConfig, Error> {
  return Shape.decodeUnknownEither(createPrismaConfigShape(), {})(input, {
    onExcessProperty: 'error',
  })
}

const PRISMA_CONFIG_INTERNAL_BRAND = Symbol.for('PrismaConfigInternal')

// Define the shape for the `PrismaConfigInternal` type.
// We don't want people to construct this type directly (structurally), so we turn it opaque via a branded type.
const createPrismaConfigInternalShape = () =>
  Shape.Struct({
    earlyAccess: Shape.Literal(true),
    schema: Shape.optional(Shape.String),
    studio: Shape.optional(prismaStudioConfigInternalShape),
    migrate: Shape.optional(prismaMigrateConfigInternalShape),
    loadedFromFile: Shape.NullOr(Shape.String),
  })

type _PrismaConfigInternal = {
  /**
   * Whether features with an unstable API are enabled.
   */
  earlyAccess: true
  /**
   * The path to the schema file or path to a folder that shall be recursively searched for .prisma files.
   */
  schema?: string
  /**
   * The configuration for Prisma Studio.
   */
  studio?: PrismaStudioConfigInternalShape
  /**
   * The configuration for Prisma Migrate + Introspect
   */
  migrate?: PrismaMigrateConfigInternalShape
  /**
   * The path from where the config was loaded.
   * It's set to `null` if no config file was found and only default config is applied.
   */
  loadedFromFile: string | null
}

declare const __testPrismaConfigInternalValueA: ReturnType<typeof createPrismaConfigInternalShape>['Type']
declare const __testPrismaConfigInternalValueB: _PrismaConfigInternal
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
    Shape.decodeUnknownEither(createPrismaConfigInternalShape(), {})(input, {
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
  return pipe(createPrismaConfigInternalShape().make(makeArgs), brandPrismaConfigInternal)
}

export async function parseDefaultExport(defaultExport: unknown) {
  const parseConfigShapeEither = parsePrismaConfigShape(defaultExport)

  // If the input conforms to `PrismaConfig` shape, feed it to `defineConfig`
  if (Either.isRight(parseConfigShapeEither)) {
    const config = parseConfigShapeEither.right
    debug('Parsed `PrismaConfig` shape: %o', config)

    // Handle async defineConfig
    return await defineConfig(config)
  }

  // Otherwise, try to parse it as a `PrismaConfigInternal` shape
  const parseInternalShapeEither = parsePrismaConfigInternalShape(defaultExport)

  // Failure case for both attempts
  if (Either.isLeft(parseInternalShapeEither)) {
    throw parseInternalShapeEither.left
  }

  // Success case - already internal config
  return parseInternalShapeEither.right
}
