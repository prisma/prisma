import Debug from '@prisma/debug'
import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { promisify } from 'util'

import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

const debug = Debug('prisma:getConfig')

const unlink = promisify(fs.unlink)

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

export async function getConfig(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  let data: ConfigMetaFormat | undefined
  if (cliEngineBinaryType === BinaryType.libqueryEngine) {
    data = await getConfigNodeAPI(options)
  } else {
    data = await getConfigBinary(options)
  }
  return data
}

async function getConfigNodeAPI(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine, options.prismaPath)
  await isNodeAPISupported()
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  try {
    const NodeAPIQueryEngineLibrary = load<NodeAPILibraryTypes.Library>(queryEnginePath)
    if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
      // cause a Rust panic
      await NodeAPIQueryEngineLibrary.debugPanic('FORCE_PANIC_QUERY_ENGINE_GET_CONFIG')
    }

    const data: ConfigMetaFormat = await NodeAPIQueryEngineLibrary.getConfig({
      datamodel: options.datamodel,
      datasourceOverrides: {},
      ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
      env: process.env,
    })
    return data
  } catch (e: any) {
    // TODO: if e.is_panic is true, throw a RustPanic error

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
}

// TODO Add comments
// TODO Rename datamodelPath to schemaPath
async function getConfigBinary(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const queryEnginePath = await resolveBinary(BinaryType.queryEngine, options.prismaPath)
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  try {
    // If we do not get the path we write the datamodel to a tmp location
    let tempDatamodelPath: string | undefined
    if (!options.datamodelPath) {
      try {
        tempDatamodelPath = await tmpWrite(options.datamodel!)
      } catch (err) {
        throw new GetConfigError('Unable to write temp data model path')
      }
    }
    const engineArgs = []

    const args = options.ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []

    if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
      await execa(
        queryEnginePath,
        [...engineArgs, 'cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_CONFIG'],
        {
          cwd: options.cwd,
          env: {
            PRISMA_DML_PATH: options.datamodelPath ?? tempDatamodelPath,
            RUST_BACKTRACE: '1',
          },
          maxBuffer: MAX_BUFFER,
        },
      )
    }

    const result = await execa(queryEnginePath, [...engineArgs, 'cli', 'get-config', ...args], {
      cwd: options.cwd,
      env: {
        PRISMA_DML_PATH: options.datamodelPath ?? tempDatamodelPath,
        RUST_BACKTRACE: '1',
      },
      maxBuffer: MAX_BUFFER,
    })

    if (tempDatamodelPath) {
      await unlink(tempDatamodelPath)
    }

    const data: ConfigMetaFormat = JSON.parse(result.stdout)
    return data
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
}
