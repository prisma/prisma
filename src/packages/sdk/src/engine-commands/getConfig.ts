import Debug from '@prisma/debug'
import { NApiEngineTypes } from '@prisma/engine-core'
import { EngineTypes } from '@prisma/fetch-engine'
import { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { promisify } from 'util'
import { resolveBinary } from '../resolveBinary'

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

export async function getConfig({
  datamodel,
  cwd = process.cwd(),
  prismaPath: queryEnginePath,
  datamodelPath,
  ignoreEnvVarErrors,
}: GetConfigOptions): Promise<ConfigMetaFormat> {
  const useNapi = process.env.PRISMA_FORCE_NAPI === 'true'
  if (useNapi) {
    queryEnginePath = await resolveBinary(
      EngineTypes.libqueryEngineNapi,
      queryEnginePath,
    )
  } else {
    queryEnginePath = await resolveBinary(
      EngineTypes.queryEngine,
      queryEnginePath,
    )
  }
  let data: ConfigMetaFormat | undefined
  debug(`Using ${useNapi ? 'N-API ' : ''}Query Engine at: ${queryEnginePath}`)
  if (useNapi) {
    try {
      const NApiQueryEngine = require(queryEnginePath) as NApiEngineTypes.NAPI
      data = await NApiQueryEngine.getConfig({
        datamodel: datamodel,
        datasourceOverrides: {},
        ignoreEnvVarErrors: ignoreEnvVarErrors ?? false,
      })
    } catch (e) {
      const error = JSON.parse(e.message)
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
  } else {
    try {
      let tempDatamodelPath: string | undefined = datamodelPath
      if (!tempDatamodelPath) {
        try {
          tempDatamodelPath = await tmpWrite(datamodel!)
        } catch (err) {
          throw new GetConfigError('Unable to write temp data model path')
        }
      }
      const engineArgs = []

      const args = ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []

      const result = await execa(
        queryEnginePath,
        [...engineArgs, 'cli', 'get-config', ...args],
        {
          cwd,
          env: {
            PRISMA_DML_PATH: tempDatamodelPath,
            RUST_BACKTRACE: '1',
          },
          maxBuffer: MAX_BUFFER,
        },
      )

      if (!datamodelPath) {
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
  }
  if (!data) throw new GetConfigError(`Failed to return any data`)
  if (
    data.datasources?.[0]?.provider?.[0] === 'sqlite' &&
    data.generators.some((g) => g.previewFeatures.includes('createMany'))
  ) {
    const message = `Database provider "sqlite" and the preview feature "createMany" can't be used at the same time.
  Please either remove the "createMany" feature flag or use any other database type that Prisma supports: postgres, mysql or sqlserver.`
    throw new GetConfigError(message)
  }

  return data
}

export class GetConfigError extends Error {
  constructor(message: string) {
    super(chalk.redBright.bold('Get config: ') + message)
  }
}
