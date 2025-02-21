import { Debug } from '@prisma/driver-adapter-utils'
import { Either, Schema as Shape } from 'effect'
import { pipe } from 'effect/Function'
import type { ParseError } from 'effect/ParseResult'

const debug = Debug('prisma:config:PrismaConfig')

const PrismaConfigSchemaSingleShape = Shape.Struct({
  /**
   * Tell Prisma to use a single `.prisma` schema file.
   */
  kind: Shape.Literal('single'),
  /**
   * The path to a single `.prisma` schema file.
   */
  filePath: Shape.String,
})

const PrismaConfigSchemaMultiShape = Shape.Struct({
  /**
   * Tell Prisma to use multiple `.prisma` schema files, via the `prismaSchemaFolder` preview feature.
   */
  kind: Shape.Literal('multi'),
  /**
   * The path to a folder containing multiple `.prisma` schema files.
   * All of the files in this folder will be used.
   */
  folderPath: Shape.String,
})

// Define the shape for the `schema` property.
// This is shared between `PrismaConfig` and `PrismaConfigInput`.
const PrismaSchemaConfigShape = Shape.Union(PrismaConfigSchemaSingleShape, PrismaConfigSchemaMultiShape)
export type PrismaSchemaConfigShape = typeof PrismaSchemaConfigShape.Type

// Define the shape for the `PrismaConfig` type.
export const createPrismaConfigShape = () =>
  Shape.Struct({
    /**
     * Whether features with an unstable API are enabled.
     */
    earlyAccess: Shape.Literal(true),
    /**
     * The configuration for the Prisma schema file(s).
     */
    schema: Shape.optional(PrismaSchemaConfigShape),
  })

/**
 * The configuration for the Prisma Development Kit, before it is passed to the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfig = ReturnType<typeof createPrismaConfigShape>['Type']

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type Shape.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfigShape(input: unknown): Either.Either<PrismaConfig, ParseError> {
  return Shape.decodeUnknownEither(createPrismaConfigShape(), {})(input, {
    onExcessProperty: 'error',
  })
}

const PRISMA_CONFIG_INTERNAL_BRAND = Symbol.for('PrismaConfigInternal')

// Define the shape for the `PrismaConfigInternal` type.
// We don't want people to construct this type directly (structurally), so we turn it opaque via a branded type.
export const createPrismaConfigInternalShape = () =>
  Shape.Struct({
    /**
     * Whether features with an unstable API are enabled.
     */
    earlyAccess: Shape.Literal(true),
    /**
     * The configuration for the Prisma schema file(s).
     */
    schema: Shape.optional(PrismaSchemaConfigShape),
    /**
     * The path from where the config was loaded.
     * It's set to `null` if no config file was found and only default config is applied.
     */
    loadedFromFile: Shape.NullOr(Shape.String),
  })

type _PrismaConfigInternal = ReturnType<typeof createPrismaConfigInternalShape>['Type']

/**
 * The configuration for the Prisma Development Kit, after it has been parsed and processed
 * by the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfigInternal = _PrismaConfigInternal & { __brand: typeof PRISMA_CONFIG_INTERNAL_BRAND }

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfigInternal` type Shape.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfigInternalShape(input: unknown): Either.Either<PrismaConfigInternal, ParseError> {
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
    Either.map((config) => {
      debug('Parsing PrismaConfigInternal succeeded, branding the output')
      return { ...config, __brand: PRISMA_CONFIG_INTERNAL_BRAND }
    }),
  )
}

type MakeArgs = Parameters<ReturnType<typeof createPrismaConfigInternalShape>['make']>[0]

export function makePrismaConfigInternal(makeArgs: MakeArgs): PrismaConfigInternal {
  return {
    ...createPrismaConfigInternalShape().make(makeArgs),
    __brand: PRISMA_CONFIG_INTERNAL_BRAND,
  }
}
