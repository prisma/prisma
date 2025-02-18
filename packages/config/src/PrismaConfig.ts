import { Schema as Shape } from 'effect'
import type { Either } from 'effect/Either'
import { pipe } from 'effect/Function'
import type { ParseError } from 'effect/ParseResult'

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
export function parsePrismaConfigShape(input: unknown): Either<PrismaConfig, ParseError> {
  return Shape.decodeUnknownEither(createPrismaConfigShape(), {})(input, {
    onExcessProperty: 'error',
  })
}

// Define the shape for the `PrismaConfigInternal` type.
// We don't want people to construct this type directly (structurally), so we turn it opaque via a branded type.
export const createPrismaConfigInternalShape = () =>
  pipe(
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
    }),
    Shape.brand('PrismaConfigInternal'),
  )

/**
 * The configuration for the Prisma Development Kit, after it has been parsed and processed
 * by the `defineConfig` function.
 * Thanks to the branding, this type is opaque and cannot be constructed directly.
 */
export type PrismaConfigInternal = ReturnType<typeof createPrismaConfigInternalShape>['Type']

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfigInternal` type Shape.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfigInternalShape(input: unknown): Either<PrismaConfigInternal, ParseError> {
  return Shape.decodeUnknownEither(createPrismaConfigInternalShape(), {})(input, {
    onExcessProperty: 'error',
  })
}
