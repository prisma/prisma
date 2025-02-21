import { Debug } from '@prisma/driver-adapter-utils'
import { Either, Schema as Shape } from 'effect'
import { pipe } from 'effect/Function'

import { defineConfig } from './defineConfig'

const debug = Debug('prisma:config:PrismaConfig')

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

// export type PrismaSchemaConfigShape = typeof PrismaSchemaConfigShape.Type
export type PrismaSchemaConfigShape
  = {
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
// export type PrismaConfig = ReturnType<typeof createPrismaConfigShape>['Type']
export type PrismaConfig = {
  /**
   * Whether features with an unstable API are enabled.
   */
  earlyAccess: true
  /**
   * The configuration for the Prisma schema file(s).
   */
  schema?: PrismaSchemaConfigShape
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
    schema: Shape.optional(PrismaSchemaConfigShape),
    loadedFromFile: Shape.NullOr(Shape.String),
  })

// type _PrismaConfigInternal = ReturnType<typeof createPrismaConfigInternalShape>['Type']
type _PrismaConfigInternal = {
  /**
   * Whether features with an unstable API are enabled.
   */
  earlyAccess: true
  /**
   * The configuration for the Prisma schema file(s).
   */
  schema?: PrismaSchemaConfigShape
  /**
   * The path from where the config was loaded.
   * It's set to `null` if no config file was found and only default config is applied.
   */
  loadedFromFile: string | null
}

/**
 * The configuration for the Prisma Development Kit, after it has been parsed and processed
 * by the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfigInternal = _PrismaConfigInternal & { __brand: typeof PRISMA_CONFIG_INTERNAL_BRAND }

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
