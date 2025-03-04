import { Debug, type DriverAdapter } from '@prisma/driver-adapter-utils'
import { Either, identity, Schema as Shape } from 'effect'
import { pipe } from 'effect/Function'

import { defineConfig } from './defineConfig'

const debug = Debug('prisma:config:PrismaConfig')

type EnvVars = Record<string, string | undefined>

const adapterShape = <Env extends EnvVars = never>() =>
  Shape.declare(
    (input: any): input is (env: Env) => Promise<DriverAdapter> => {
      return input instanceof Function
    },
    {
      identifier: 'Adapter<Env>',
      encode: identity,
      decode: identity,
    },
  )

export type PrismaStudioConfigShape<Env extends EnvVars = never> = {
  adapter: (env: Env) => Promise<DriverAdapter>
}

const createPrismaStudioConfigInternalShape = <Env extends EnvVars = never>() =>
  Shape.Struct({
    /**
     * Instantiates the Prisma driver adapter to use for Prisma Studio.
     */
    adapter: adapterShape<Env>(),
  })

const PrismaConfigSchemaSingleShape = Shape.Struct({
  kind: Shape.Literal('single'),
  filePath: Shape.String,
})

const PrismaConfigSchemaMultiShape = Shape.Struct({
  kind: Shape.Literal('multi'),
  folderPath: Shape.String,
})

// Define the shape for the `schema` property.
// This is shared between `PrismaConfig` and `PrismaConfigInput`.
const PrismaSchemaConfigShape = Shape.Union(PrismaConfigSchemaSingleShape, PrismaConfigSchemaMultiShape)

export type PrismaSchemaConfigShape =
  | {
      /**
       * Tell Prisma to use a single `.prisma` schema file.
       */
      kind: 'single'
      /**
       * The path to a single `.prisma` schema file.
       */
      filePath: string
    }
  | {
      /**
       * Tell Prisma to use multiple `.prisma` schema files, via the `prismaSchemaFolder` preview feature.
       */
      kind: 'multi'
      /**
       * The path to a folder containing multiple `.prisma` schema files.
       * All of the files in this folder will be used.
       */
      folderPath: string
    }

// The exported types are re-declared manually instead of using the Shape.Type
// types because `effect` types make API Extractor crash, making it impossible
// to bundle them, and `effect` is too large to ship as a full dependency
// without bundling and tree-shaking. The following tests ensure that the
// exported types are structurally equal to the ones defined by the schemas.
declare const __testPrismaSchemaConfigShapeValueA: typeof PrismaSchemaConfigShape.Type
declare const __testPrismaSchemaConfigShapeValueB: PrismaSchemaConfigShape
declare const __testPrismaStudioConfigShapeValueA: ReturnType<typeof createPrismaStudioConfigInternalShape>['Type']
declare const __testPrismaStudioConfigShapeValueB: PrismaStudioConfigShape<EnvVars>

// eslint-disable-next-line no-constant-condition
if (false) {
  __testPrismaSchemaConfigShapeValueA satisfies PrismaSchemaConfigShape
  __testPrismaSchemaConfigShapeValueB satisfies typeof PrismaSchemaConfigShape.Type
  __testPrismaStudioConfigShapeValueA satisfies PrismaStudioConfigShape<EnvVars>
  __testPrismaStudioConfigShapeValueB satisfies ReturnType<typeof createPrismaStudioConfigInternalShape>['Type']
}

// Define the shape for the `PrismaConfig` type.
const createPrismaConfigShape = () =>
  Shape.Struct({
    earlyAccess: Shape.Literal(true),
    schema: Shape.optional(PrismaSchemaConfigShape),
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
   * The configuration for the Prisma schema file(s).
   */
  schema?: PrismaSchemaConfigShape
  /**
   * The configuration for Prisma Studio.
   */
  studio?: PrismaStudioConfigShape<Env>
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
const createPrismaConfigInternalShape = <Env extends EnvVars = never>() =>
  Shape.Struct({
    earlyAccess: Shape.Literal(true),
    schema: Shape.optional(PrismaSchemaConfigShape),
    studio: Shape.optional(createPrismaStudioConfigInternalShape<Env>()),
    loadedFromFile: Shape.NullOr(Shape.String),
  })

type _PrismaConfigInternal<Env extends EnvVars = never> = {
  /**
   * Whether features with an unstable API are enabled.
   */
  earlyAccess: true
  /**
   * The configuration for the Prisma schema file(s).
   */
  schema?: PrismaSchemaConfigShape
  /**
   * The configuration for Prisma Studio.
   */
  studio?: PrismaStudioConfigShape<Env>
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
  if (typeof input === 'object' && input !== null && input.__brand === PRISMA_CONFIG_INTERNAL_BRAND) {
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
