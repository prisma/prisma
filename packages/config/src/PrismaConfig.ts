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
      identifier: 'createAdapter<Env>',
      encode: identity,
      decode: identity,
    },
  )

// Define the schema for the `studio` property
const createPrismaStudioConfigSchema = <Env>() =>
  Schema.Struct({
    /**
     * Istantiates the Prisma driver adapter to use for Prisma Studio.
     */
    createAdapter: createAdapterSchema<Env>(),
  })

// Define the schema for the `PrismaConfig` type
const createPrismaConfigSchema = <Env = any>() =>
  Schema.Struct({
    /**
     * Whether experimental features are enabled.
     */
    experimental: Schema.Literal(true),
    /**
     * The configuration for Prisma Studio.
     */
    studio: Schema.optional(createPrismaStudioConfigSchema<Env>()),
  })

/**
 * The configuration for the Prisma Development Kit.
 */
export type PrismaConfig<Env> = ReturnType<typeof createPrismaConfigSchema<Env>>['Type']

/**
 * Parse a given input object to ensure it conforms to the `PrismaConfig` type schema.
 * This function may fail, but it will never throw.
 */
export function parsePrismaConfig<Env = any>(input: unknown): Either<PrismaConfig<Env>, ParseError> {
  return Schema.decodeUnknownEither(createPrismaConfigSchema<Env>(), {})(input, {
    onExcessProperty: 'error',
  })
}
