import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import { Schema as Shape } from 'effect'
import type { Either } from 'effect/Either'
import { identity, pipe } from 'effect/Function'
import type { ParseError } from 'effect/ParseResult'

// Define the shape for the `createAdapter` function
const createAdapterShape = <Env>() =>
  Shape.declare(
    (input: any): input is (env: Env) => Promise<QueryableDriverAdapter> => {
      return input instanceof Function
    },
    {
      identifier: 'CreateAdapter<Env>',
      encode: identity,
      decode: identity,
    },
  )

// Define the shape for the `studio` property
const createPrismaStudioConfigInternalShape = <Env>() =>
  Shape.Struct({
    /**
     * Instantiates the Prisma driver adapter to use for Prisma Studio.
     */
    createAdapter: createAdapterShape<Env>(),
  })

const PrismaConfigSchemaSingleShape = Shape.Struct({
  /**
   * Tell Prisma to use a single `.prisma` schema file.
   */
  kind: Shape.Literal('single'),
  /**
   * The path to a single `.prisma` schema file.
   */
  filenamePath: Shape.String,
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
  folder: Shape.String,
})

// Define the shape for the `schema` property.
// This is shared between `PrismaConfig` and `PrismaConfigInput`.
const PrismaSchemaConfigShape = Shape.Union(PrismaConfigSchemaSingleShape, PrismaConfigSchemaMultiShape)
export type PrismaSchemaConfigShape = typeof PrismaSchemaConfigShape.Type

// Define the shape for the `PrismaConfigInternal` type.
// We don't want people to construct this type directly (structurally), so we turn it opaque via a branded type.
export const createPrismaConfigInternalShape = <Env = any>() =>
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
       * The configuration for Prisma Studio.
       */
      studio: Shape.optional(createPrismaStudioConfigInternalShape<Env>()),
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
export type PrismaConfigInternal<Env = any> = ReturnType<typeof createPrismaConfigInternalShape<Env>>['Type']

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type Shape.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfigInternalShape<Env = any>(
  input: unknown,
): Either<PrismaConfigInternal<Env>, ParseError> {
  return Shape.decodeUnknownEither(createPrismaConfigInternalShape<Env>(), {})(input, {
    onExcessProperty: 'error',
  })
}
