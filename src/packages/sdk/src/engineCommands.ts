import chalk from 'chalk'
import execa from 'execa'
import path from 'path'
import { DMMF, DataSource, GeneratorConfig } from '@prisma/generator-helper'
import tmpWrite from 'temp-write'
import fs from 'fs'
import { promisify } from 'util'
import Debug from '@prisma/debug'
import { resolveBinary } from './resolveBinary'
const debug = Debug('engineCommands')

const unlink = promisify(fs.unlink)

const MAX_BUFFER = 1000 * 1000 * 1000

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}

/**
 * This annotation is used for `node-file-trace`
 * See https://github.com/zeit/node-file-trace/issues/104
 */

path.join(__dirname, '../query-engine-darwin')
path.join(__dirname, '../introspection-engine-darwin')
path.join(__dirname, '../prisma-fmt-darwin')

path.join(__dirname, '../query-engine-debian-openssl-1.0.x')
path.join(__dirname, '../introspection-engine-debian-openssl-1.0.x')
path.join(__dirname, '../prisma-fmt-debian-openssl-1.0.x')

path.join(__dirname, '../query-engine-debian-openssl-1.1.x')
path.join(__dirname, '../introspection-engine-debian-openssl-1.1.x')
path.join(__dirname, '../prisma-fmt-debian-openssl-1.1.x')

path.join(__dirname, '../query-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../introspection-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../prisma-fmt-rhel-openssl-1.0.x')

path.join(__dirname, '../query-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../introspection-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../prisma-fmt-rhel-openssl-1.1.x')

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
        ...process.env,
        PRISMA_DML_PATH: tempDatamodelPath,
        RUST_BACKTRACE: '1',
        ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
      },
      maxBuffer: MAX_BUFFER,
    }

    if (enableExperimental) {
      enableExperimental = enableExperimental.filter(
        (e) => !['middlewares'].includes(e),
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
          ...process.env,
          PRISMA_DML_PATH: tempDatamodelPath,
          RUST_BACKTRACE: '1',
        },
        maxBuffer: MAX_BUFFER,
      },
    )

    if (!datamodelPath) {
      await unlink(tempDatamodelPath)
    }

    return JSON.parse(result.stdout)
  } catch (e) {
    if (e.stderr) {
      throw new Error(chalk.redBright.bold('Get config ') + e.stderr)
    }
    if (e.stdout) {
      throw new Error(chalk.redBright.bold('Get config ') + e.stdout)
    }
    throw new Error(chalk.redBright.bold('Get config ') + e)
  }
}

type FormatOptions = {
  schemaPath: string
}

export async function formatSchema({
  schemaPath,
}: FormatOptions): Promise<string> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema at ${schemaPath} does not exist.`)
  }
  const prismaFmtPath = await resolveBinary('prisma-fmt')
  const showColors = !process.env.NO_COLOR && process.stdout.isTTY

  const options = {
    env: {
      ...process.env,
      RUST_BACKTRACE: '1',
      ...(showColors ? { CLICOLOR_FORCE: '1' } : {}),
    },
    maxBuffer: MAX_BUFFER,
  }

  const result = await execa(
    prismaFmtPath,
    ['format', '-i', schemaPath],
    options,
  )

  return result.stdout
}

export async function getVersion(enginePath?: string): Promise<string> {
  enginePath = await resolveBinary('query-engine', enginePath)

  const result = await execa(enginePath, ['--version'], {
    env: {
      ...process.env,
    },
    maxBuffer: MAX_BUFFER,
  })

  return result.stdout
}
