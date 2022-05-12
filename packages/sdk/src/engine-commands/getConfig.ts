import Debug from '@prisma/debug'
import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'

import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

const debug = Debug('prisma:getConfig')

const MAX_BUFFER = 1_000_000_000

export interface ConfigMetaFormat {
  datasources: DataSource[] | []
  generators: GeneratorConfig[] | []
  warnings: string[] | []
}

export type GetConfigOptions = {
  datamodel: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
  ignoreEnvVarErrors?: boolean
}
export class GetConfigError extends Error {
  constructor(message: string) {
    super(chalk.redBright.bold('Get config: ') + message)
  }
}
// TODO add error handling functions
export async function getConfig(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  let data: ConfigMetaFormat | undefined
  if (cliEngineBinaryType === BinaryType.libqueryEngine) {
    data = await getConfigNodeAPI(options)
  } else {
    data = await getConfigBinary(options)
  }

  if (!data) throw new GetConfigError(`Failed to return any data`)

  // TODO This has been outdated for ages and needs to be handled differently and/or removed
  if (
    data.datasources?.[0]?.provider === 'sqlite' &&
    data.generators.some((g) => g.previewFeatures.includes('createMany'))
  ) {
    const message = `Database provider "sqlite" and the preview feature "createMany" can't be used at the same time.
  Please either remove the "createMany" feature flag or use any other database type that Prisma supports: postgres, mysql or sqlserver.`
    throw new GetConfigError(message)
  }

  return data
}

async function getConfigNodeAPI(options: GetConfigOptions): Promise<ConfigMetaFormat | undefined> {
  let data: ConfigMetaFormat | undefined

  const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine, options.prismaPath)
  await isNodeAPISupported()
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  try {
    const NodeAPIQueryEngineLibrary = load<NodeAPILibraryTypes.Library>(queryEnginePath)
    data = await NodeAPIQueryEngineLibrary.getConfig({
      datamodel: options.datamodel,
      datasourceOverrides: {},
      ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
      env: process.env,
    })
  } catch (e: any) {
    let error
    try {
      error = JSON.parse(e.message)
    } catch {
      throw e
    }
    let message: string
    if (error.error_code === 'P1012') {
      message = chalk.redBright(`Schema Parsing ${error.error_code}\n\n`) + error.message + '\n'
    } else {
      message = chalk.redBright(`${error.error_code}\n\n`) + error
    }
    throw new GetConfigError(message)
  }

  return data
}

// TODO Add comments
// TODO Rename datamodelPath to schemaPath
async function getConfigBinary(options: GetConfigOptions): Promise<ConfigMetaFormat | undefined> {
  let data: ConfigMetaFormat | undefined

  const queryEnginePath = await resolveBinary(BinaryType.queryEngine, options.prismaPath)
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  try {
    const engineArgs = []

    const args = options.ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []
    const params = {
      cwd: options.cwd,
      env: {
        RUST_BACKTRACE: '1',
        PRISMA_DML: undefined,
      },
      maxBuffer: MAX_BUFFER,
    }

    if (options.datamodel) {
      // @ts-ignore
      params.env.PRISMA_DML = Buffer.from(options.datamodel).toString('base64')
    } else if (options.datamodelPath) {
      const schema = fs.readFileSync(options.datamodelPath, 'utf-8')
      // @ts-ignore
      params.env.PRISMA_DML = Buffer.from(schema).toString('base64')
    }
    debug(`getConfigBinary PRISMA_DML: ${params.env.PRISMA_DML}`)

    const result = await execa(queryEnginePath, [...engineArgs, 'cli', 'get-config', ...args], params)
    data = JSON.parse(result.stdout)
  } catch (e: any) {
    if (e.stderr || e.stdout) {
      const error = e.stderr ? e.stderr : e.stout
      let jsonError, message
      try {
        jsonError = JSON.parse(error)
        message = `${chalk.redBright(jsonError.message)}\n`
        if (jsonError.error_code) {
          if (jsonError.error_code === 'P1012') {
            message = chalk.redBright(`Schema Parsing ${jsonError.error_code}\n\n`) + message
          } else {
            message = chalk.redBright(`${jsonError.error_code}\n\n`) + message
          }
        }
      } catch (e) {
        // if JSON parse / pretty handling fails, fallback to simple printing
        throw new GetConfigError(error)
      }

      throw new GetConfigError(message)
    }

    throw new GetConfigError(e)
  }
  return data
}
