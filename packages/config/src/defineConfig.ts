import process from 'node:process'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { DriverAdapter as QueryableDriverAdapter} from '@prisma/driver-adapter-utils'
import { Debug } from '@prisma/driver-adapter-utils'

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the configuration for the Prisma Development Kit.
 */
export type PrismaConfigInput<Env> = {
  /**
   * The environment-variable loading strategy.
   */
  loadEnv?: () => Promise<Env>
  /**
   * The location of the Prisma schema file(s).
   */
  schema?: PrismaConfigInputSchema
  /**
   * The configuration for the Prisma Studio.
   */
  studio?: {
    /**
     * Istantiates the Prisma driver adapter to use for Prisma Studio.
     * @param env Dictionary of environment variables.
     * @returns The Prisma driver adapter to use for Prisma Studio.
     */
    adapter: (env: Env) => Promise<QueryableDriverAdapter>
  }
}

export type PrismaConfig<Env = any> = {
  env?: {
    /**
     * The environment-variable loading strategy.
     * If provided, Prisma will use this function rather than using `loadEnvFile` from `@prisma/internals`.
     * Note: `loadEnvFile` currently depends on the location of the schema file.
     */
    load: () => Promise<Env>
  }
  schema?: {
    /**
     * Loads the schema, throws an error if it is not found.
     * If provided, Prisma will use this function rather than using `getSchema` from `@prisma/internals`.
     */
    getSchemaWithPath: () => Promise<GetSchemaResult>
  }
  studio?: {
    /**
     * Istantiates the Prisma driver adapter to use for Prisma Studio.
     */
    createAdapter: (env: Env) => Promise<QueryableDriverAdapter>
  }
}

export function defineConfig<Env>(configInput: PrismaConfigInput<Env>): PrismaConfig<Env> {
  const cwd = process.cwd()
  const config: PrismaConfig<Env> = {}

  if (configInput.loadEnv) {
    config.env = {
      load: configInput.loadEnv,
    }

    debug('Prisma config [env]: %o', config.env)
  }

  if (configInput.schema) {
    const { kind } = configInput.schema

    if (kind === 'single') {
      const schemaPath = path.resolve(cwd, configInput.schema.filenamePath)
      const schemaRootDir = path.dirname(schemaPath)
      
      config.schema = {
        getSchemaWithPath: async () => {
          const filename = path.basename(schemaPath)
          const content = await fs.readFile(schemaPath, 'utf-8')
          return {
            schemaPath,
            schemaRootDir,
            schemas: [[filename, content]],
          }
        },
      }
    } else if (kind === 'multi') {
      const schemaPath = path.resolve(cwd, configInput.schema.folder)

      config.schema = {
        getSchemaWithPath: async () => {
          // TODO: use `@prisma/schema-files-loader`
          throw new Error('Not implemented')
        },
      }
    }

    debug('Prisma config [schema]: %o', config.schema)
  }

  if (configInput.studio) {
    config.studio = {
      createAdapter: configInput.studio.adapter,
    }

    debug('Prisma config [studio]: %o', config.studio)
  }

  return config
}

type PrismaConfigInputSchemaSingle = {
  /**
   * Tell Prisma to use a single `.prisma` schema file.
   */
  kind: 'single'
  /**
   * The path to the `.prisma` schema file.
   */
  filenamePath: string
}

type PrismaConfigInputSchemaMulti = {
  /**
   * Tell Prisma to use multiple `.prisma` schema files, via the `prismaSchemaFolder` preview feature.
   */
  kind: 'multi'
  /**
   * The path to a folder containing multiple `.prisma` schema files.
   * All of the files in this folder will be used.
   */
  folder: string
}

type PrismaConfigInputSchema = PrismaConfigInputSchemaSingle | PrismaConfigInputSchemaMulti

type MultipleSchemaTuple = [filename: string, content: string]
type MultipleSchemas = Array<MultipleSchemaTuple>

type GetSchemaResult = {
  /**
   * A path from which schema was loaded
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
  schemas: MultipleSchemas
}
