import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import { Schema } from 'effect'
import type { Either } from 'effect/Either'
import { identity } from 'effect/Function'
import type { ParseError } from 'effect/ParseResult'

// Define a schema for the `createAdapter` function
const createAdapterSchema = <Env>() =>
  Schema.declare(
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
const createPrismaStudioConfigSchema = <Env>() =>
  Schema.Struct({
    /**
     * Instantiates the Prisma driver adapter to use for Prisma Studio.
     */
    createAdapter: createAdapterSchema<Env>(),
  })

const PrismaConfigSchemaSingleSchema = Schema.Struct({
  /**
   * Tell Prisma to use a single `.prisma` schema file.
   */
  kind: Schema.Literal('single'),
  /**
   * The path to a single `.prisma` schema file.
   */
  filenamePath: Schema.String,
})

const PrismaConfigSchemaMultiSchema = Schema.Struct({
  /**
   * Tell Prisma to use multiple `.prisma` schema files, via the `prismaSchemaFolder` preview feature.
   */
  kind: Schema.Literal('multi'),
  /**
   * The path to a folder containing multiple `.prisma` schema files.
   * All of the files in this folder will be used.
   */
  folder: Schema.String,
})

// Define the schema for the `schema` property
const PrismaSchemaConfigSchema = Schema.Union(PrismaConfigSchemaSingleSchema, PrismaConfigSchemaMultiSchema)
export type PrismaSchemaConfigSchema = typeof PrismaSchemaConfigSchema.Type

// Define the schema for the `PrismaConfig` type
const createPrismaConfigSchema = <Env = any>() =>
  Schema.Struct({
    /**
     * Whether features with an unstable API are enabled.
     */
    earlyAccess: Schema.Literal(true),
    /**
     * The configuration for the Prisma schema file(s).
     */
    schema: Schema.optional(PrismaSchemaConfigSchema),
    /**
     * The configuration for Prisma Studio.
     */
    studio: Schema.optional(createPrismaStudioConfigSchema<Env>()),
    /**
     * The path from where the config was loaded.
     * It's set to `null` if no config file was found and only default config is applied.
     */
    loadedFromFile: Schema.NullOr(Schema.String),
  })

/**
 * The configuration for the Prisma Development Kit.
 */
export type PrismaConfig<Env = any> = ReturnType<typeof createPrismaConfigSchema<Env>>['Type']

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type schema.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfig<Env = any>(input: unknown): Either<PrismaConfig<Env>, ParseError> {
  return Schema.decodeUnknownEither(createPrismaConfigSchema<Env>(), {})(input, {
    onExcessProperty: 'error',
  })
}
