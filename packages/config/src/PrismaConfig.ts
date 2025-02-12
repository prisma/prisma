import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import { Schema as Shape } from 'effect'
import type { Either } from 'effect/Either'
import { identity } from 'effect/Function'
import type { ParseError } from 'effect/ParseResult'

// Define a schema for the `createAdapter` function
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

// Define the schema for the `studio` property
const createPrismaStudioConfigShape = <Env>() =>
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

// Define the schema for the `schema` property
const PrismaSchemaConfigShape = Shape.Union(PrismaConfigSchemaSingleShape, PrismaConfigSchemaMultiShape)
export type PrismaSchemaConfigShape = typeof PrismaSchemaConfigShape.Type

// Define the schema for the `PrismaConfig` type
const createPrismaConfigShape = <Env = any>() =>
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
    studio: Shape.optional(createPrismaStudioConfigShape<Env>()),
    /**
     * The path from where the config was loaded.
     * It's set to `null` if no config file was found and only default config is applied.
     */
    loadedFromFile: Shape.NullOr(Shape.String),
  })

/**
 * The configuration for the Prisma Development Kit.
 */
export type PrismaConfig<Env = any> = ReturnType<typeof createPrismaConfigShape<Env>>['Type']

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type Shape.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfigShape<Env = any>(input: unknown): Either<PrismaConfig<Env>, ParseError> {
  return Shape.decodeUnknownEither(createPrismaConfigShape<Env>(), {})(input, {
    onExcessProperty: 'error',
  })
}
