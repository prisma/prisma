import chalk from 'chalk'
import execa from 'execa'
import { DMMF, DataSource, GeneratorConfig } from '@prisma/generator-helper'
import tmpWrite from 'temp-write'
import fs from 'fs'
import { promisify } from 'util'
import Debug from '@prisma/debug'
import { resolveBinary, EngineType } from './resolveBinary'
const debug = Debug('prisma:engineCommands')

const unlink = promisify(fs.unlink)

const MAX_BUFFER = 1_000_000_000

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
}

export type GetDMMFOptions = {
  datamodel?: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
  enableExperimental?: string[]
}

export async function getDMMF({
  datamodel,
  cwd = process.cwd(),
  prismaPath: queryEnginePath,
  datamodelPath,
  retry = 4,
  enableExperimental,
}: GetDMMFOptions): Promise<DMMF.Document> {
  queryEnginePath = await resolveBinary('query-engine', queryEnginePath)
  let result
  try {
    let tempDatamodelPath: string | undefined = datamodelPath
    if (!tempDatamodelPath) {
      try {
        tempDatamodelPath = await tmpWrite(datamodel!)
      } catch (err) {
        throw new Error(
          chalk.redBright.bold('Get DMMF ') +
            'unable to write temp data model path',
        )
      }
    }

    const options = {
      cwd,
      env: {
        PRISMA_DML_PATH: tempDatamodelPath,
        RUST_BACKTRACE: '1',
        ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
      },
      maxBuffer: MAX_BUFFER,
    }

    const removedFeatureFlagMap = {
      insensitiveFilters: `${chalk.blueBright(
        'info',
      )} The preview flag "insensitiveFilters" is not needed anymore, please remove it from your schema.prisma`,
      atomicNumberOperations: `${chalk.blueBright(
        'info',
      )} The preview flag "atomicNumberOperations" is not needed anymore, please remove it from your schema.prisma`,
      connectOrCreate: `${chalk.blueBright(
        'info',
      )} The preview flag "connectOrCreate" is not needed anymore, please remove it from your schema.prisma`,
      transaction: `${chalk.blueBright(
        'info',
      )} The preview flag "transactionApi" is not needed anymore, please remove it from your schema.prisma`,
      transactionApi: `${chalk.blueBright(
        'info',
      )} The preview flag "transactionApi" is not needed anymore, please remove it from your schema.prisma`,
      uncheckedScalarInputs: `${chalk.blueBright(
        'info',
      )} The preview flag "uncheckedScalarInputs" is not needed anymore, please remove it from your schema.prisma`,
      nativeTypes: `${chalk.blueBright(
        'info',
      )} The preview flag "nativeTypes" is not needed anymore, please remove it from your schema.prisma`,
    }

    if (enableExperimental) {
      enableExperimental = enableExperimental
        .filter((f) => {
          if(f === 'napi'){
            return false
          }
          const removeMessage = removedFeatureFlagMap[f]
          if (removeMessage) {
            if (!process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS) {
              console.log(removeMessage)
            }
            return false
          }

          return true
        })
        .filter(
          (e) =>
            ![
              'middlewares',
              'aggregateApi',
              'distinct',
              'aggregations',
              'nativeTypes',
              'atomicNumberOperations',
            ].includes(e),
        )
    }

    const experimentalFlags =
      enableExperimental &&
      Array.isArray(enableExperimental) &&
      enableExperimental.length > 0
        ? [`--enable-experimental=${enableExperimental.join(',')}`]
        : []

    const args = [...experimentalFlags, '--enable-raw-queries', 'cli', 'dmmf']

    result = await execa(queryEnginePath, args, options)

    if (!datamodelPath) {
      await unlink(tempDatamodelPath)
    }

    if (result.stdout.includes('Please wait until the') && retry > 0) {
      debug('Retrying after "Please wait until"')
      await new Promise((r) => setTimeout(r, 5000))
      return getDMMF({
        datamodel,
        cwd,
        prismaPath: queryEnginePath,
        datamodelPath,
        retry: retry - 1,
      })
    }

    // necessary, as sometimes the query engine prints some other stuff
    const firstCurly = result.stdout.indexOf('{')
    const stdout = result.stdout.slice(firstCurly)

    return JSON.parse(stdout)
  } catch (e) {
    debug('getDMMF failed', e)
    // If this unlikely event happens, try it at least once more
    if (
      e.message.includes('Command failed with exit code 26 (ETXTBSY)') &&
      retry > 0
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      debug('Retrying after ETXTBSY')
      return getDMMF({
        datamodel,
        cwd,
        prismaPath: queryEnginePath,
        datamodelPath,
        retry: retry - 1,
      })
    }
    const output = e.stderr || e.stdout
    if (output) {
      let json
      try {
        json = JSON.parse(output)
      } catch (e) {
        //
      }
      let message = (json && json.message) || output

      if (
        message.includes(
          'debian-openssl-1.1.x: error while loading shared libraries: libssl.so.1.1: cannot open shared object file: No such file or directory',
        ) ||
        message.includes(
          'debian-openssl-1.0.x: error while loading shared libraries: libssl.so.1.0.0: cannot open shared object file: No such file or directory',
        )
      ) {
        message += `\n${chalk.green(
          `Your linux installation misses the openssl package. You can install it like so:\n`,
        )}${chalk.green.bold(
          'apt-get -qy update && apt-get -qy install openssl',
        )}`
      }

      throw new Error(chalk.redBright.bold('Schema parsing\n') + message)
    }
    if (e.message.includes('in JSON at position')) {
      throw new Error(
        `Problem while parsing the query engine response at ${queryEnginePath}. ${result.stdout}\n${e.stack}`,
      )
    }
    throw new Error(e)
  }
}

export type GetConfigOptions = {
  datamodel?: string
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
  queryEnginePath = await resolveBinary('query-engine', queryEnginePath)

  let tempDatamodelPath: string | undefined = datamodelPath
  if (!tempDatamodelPath) {
    try {
      tempDatamodelPath = await tmpWrite(datamodel!)
    } catch (err) {
      throw new Error(
        chalk.redBright.bold('Get DMMF ') +
          'unable to write temp data model path',
      )
    }
  }

  const args = ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []

  try {
    const result = await execa(
      queryEnginePath,
      ['cli', 'get-config', ...args],
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

    const data: ConfigMetaFormat = JSON.parse(result.stdout)

    if (
      data.datasources?.[0]?.provider?.[0] === 'sqlite' &&
      data.generators.some((g) => g.previewFeatures.includes('createMany'))
    ) {
      throw new Error(`Database provider "sqlite" and the preview feature "createMany" can't be used at the same time.
Please either remove the "createMany" feature flag or use any other database type that Prisma supports: postgres, mysql or sqlserver.`)
    }

    return data
  } catch (e) {
    if (e.stderr || e.stdout) {
      const error = e.stderr ? e.stderr : e.stout
      let jsonError, message
      try {
        jsonError = JSON.parse(error)
        message = `${chalk.redBright.bold('Get config ')}\n${chalk.redBright(
          jsonError.message,
        )}\n`
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
        throw new Error(chalk.redBright.bold('Get config ') + error)
      }

      throw new Error(message)
    }

    throw new Error(chalk.redBright.bold('Get config: ') + e)
  }
}

// can be used by passing either
// the schema as a string
// or a path to the schema file
export async function formatSchema({ schema }: { schema: string })
export async function formatSchema({ schemaPath }: { schemaPath: string })
export async function formatSchema({
  schemaPath,
  schema,
}: {
  schemaPath?: string
  schema?: string
}): Promise<string> {
  if (!schema && !schemaPath) {
    throw new Error(`Paramater schema or schemaPath must be passed.`)
  }

  const prismaFmtPath = await resolveBinary('prisma-fmt')
  const showColors = !process.env.NO_COLOR && process.stdout.isTTY

  const options = {
    env: {
      RUST_BACKTRACE: '1',
      ...(showColors ? { CLICOLOR_FORCE: '1' } : {}),
    },
    maxBuffer: MAX_BUFFER,
  } as execa.Options

  let result
  if (schemaPath) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema at ${schemaPath} does not exist.`)
    }
    result = await execa(prismaFmtPath, ['format', '-i', schemaPath], options)
  } else if (schema) {
    result = await execa(prismaFmtPath, ['format'], {
      ...options,
      input: schema,
    })
  }

  return result.stdout
}

export async function getVersion(
  enginePath?: string,
  binaryName: EngineType = 'query-engine',
): Promise<string> {
  enginePath = await resolveBinary(binaryName, enginePath)

  const result = await execa(enginePath, ['--version'], {
    maxBuffer: MAX_BUFFER,
  })

  return result.stdout
}
