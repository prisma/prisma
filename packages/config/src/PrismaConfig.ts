import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import type { LoadedFile } from '@prisma/schema-files-loader'
import { Schema } from 'effect'
import type { Either } from 'effect/Either'
import { identity } from 'effect/Function'
import type { ParseError } from 'effect/ParseResult'

// Note: This is a duplicate of `GetSchemaResult` in `packages/internals/src/cli/getSchema.ts`.
// TODO: move this in `@prisma/schema-files-loader`, and import it from there.
type GetSchemaResult = {
  /**
   * A path from which schema was loaded.
   * Can be either folder or a single file
   */
  schemaPath: string
  /**
   * Base dir for all of the schema files.
   * In-multi file mode, this is equal to `schemaPath`.
   * In single-file mode, this is a parent directory of
   * a file
   */
  schemaRootDir: string
  /**
   * All loaded schema files
   */
  schemas: Array<LoadedFile>
}

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

// Define a schema for the `getPSLSchema` function
const GetPSLSchemaSchema = Schema.declare(
  (input: any): input is () => Promise<GetSchemaResult> => {
    return input instanceof Function
  },
  {
    identifier: 'GetPSLSchema',
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

// Define the schema for the `schema` property
const PrismaSchemaConfigSchema = Schema.Struct({
  /**
   * Loads the schema, throws an error if it is not found.
   * If provided, Prisma will use this function rather than using `getSchema` from `@prisma/internals`.
   */
  getPSLSchema: GetPSLSchemaSchema,

  /**
   * Describe whether the schema returned by `getPSLSchema` is a single file or a multi-file schema.
   */
  kind: Schema.Literal('single', 'multi'),
})

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
