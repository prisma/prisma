import Debug from '@prisma/debug'
import { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { DataSource, GeneratorConfig } from '@prisma/generator-helper'
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
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
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
export async function getConfig(
  options: GetConfigOptions,
): Promise<ConfigMetaFormat> {
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

async function getConfigNodeAPI(
  options: GetConfigOptions,
): Promise<ConfigMetaFormat> {
  let data: ConfigMetaFormat | undefined
  const queryEnginePath = await resolveBinary(
    BinaryType.libqueryEngine,
    options.prismaPath,
  )
  await isNodeAPISupported()
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)
  try {
    const NodeAPIQueryEngineLibrary =
      load<NodeAPILibraryTypes.Library>(queryEnginePath)
    data = await NodeAPIQueryEngineLibrary.getConfig({
      datamodel: options.datamodel,
      datasourceOverrides: {},
      ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
      env: process.env,
    })
  } catch (e) {
    let error
    try {
      error = JSON.parse(e.message)
    } catch {
      throw e
    }
    let message: string
    if (error.error_code === 'P1012') {
      message =
        chalk.redBright(`Schema Parsing ${error.error_code}\n\n`) +
        error.message +
        '\n'
    } else {
      message = chalk.redBright(`${error.error_code}\n\n`) + error
    }
    throw new GetConfigError(message)
  }
  return data
}

async function getConfigBinary(
  options: GetConfigOptions,
): Promise<ConfigMetaFormat | undefined> {
  let data: ConfigMetaFormat | undefined

  const queryEnginePath = await resolveBinary(
    BinaryType.queryEngine,
    options.prismaPath,
  )
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  try {
    let tempDatamodelPath: string | undefined = options.datamodelPath
    if (!tempDatamodelPath) {
      try {
        tempDatamodelPath = await tmpWrite(options.datamodel!)
      } catch (err) {
        throw new GetConfigError('Unable to write temp data model path')
      }
    }
    const engineArgs = []

    const args = options.ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []

    const result = await execa(
      queryEnginePath,
      [...engineArgs, 'cli', 'get-config', ...args],
      {
        cwd: options.cwd,
        env: {
          PRISMA_DML_PATH: tempDatamodelPath,
          RUST_BACKTRACE: '1',
        },
        maxBuffer: MAX_BUFFER,
      },
    )

    if (!options.datamodelPath) {
      await unlink(tempDatamodelPath)
    }

    data = JSON.parse(result.stdout)
  } catch (e) {
    if (e.stderr || e.stdout) {
      const error = e.stderr ? e.stderr : e.stout
      let jsonError, message
      try {
        jsonError = JSON.parse(error)
        message = `${chalk.redBright(jsonError.message)}\n`
        if (jsonError.error_code) {
          if (jsonError.error_code === 'P1012') {
            message =
              chalk.redBright(`Schema Parsing ${jsonError.error_code}\n\n`) +
              message
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
