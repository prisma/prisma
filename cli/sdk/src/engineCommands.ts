import { getPlatform } from '@prisma/get-platform'
import chalk from 'chalk'
import execa from 'execa'
import path from 'path'
import { DMMF, DataSource, GeneratorConfig } from '@prisma/generator-helper'
import tmpWrite from 'temp-write'
import fs from 'fs'
import { promisify } from 'util'
import Debug from 'debug'
const debug = Debug('engineCommands')

const unlink = promisify(fs.unlink)

const MAX_BUFFER = 1000 * 1000 * 1000

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}

async function getPrismaPath(): Promise<string> {
  // tslint:disable-next-line
  if (process.env.PRISMA_QUERY_ENGINE_BINARY) {
    if (!fs.existsSync(process.env.PRISMA_QUERY_ENGINE_BINARY)) {
      throw new Error(
        `Env var PRISMA_QUERY_ENGINE_BINARY is provided but provided path ${process.env.PRISMA_QUERY_ENGINE_BINARY} can't be resolved.`,
      )
    }
    return process.env.PRISMA_QUERY_ENGINE_BINARY
  }
  const dir = eval('__dirname')
  const platform = await getPlatform()
  const extension = platform === 'windows' ? '.exe' : ''
  const binaryName = `query-engine-${platform}${extension}`
  let prismaPath = path.join(dir, '..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return prismaPath
  }
  // for pkg
  prismaPath = path.join(dir, '../..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return prismaPath
  }

  prismaPath = path.join(__dirname, '..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return prismaPath
  }

  prismaPath = path.join(__dirname, '../..', binaryName)
  if (fs.existsSync(prismaPath)) {
    return prismaPath
  }

  // needed to come from @prisma/client/generator-build to @prisma/client/runtime
  prismaPath = path.join(__dirname, '../runtime', binaryName)
  if (fs.existsSync(prismaPath)) {
    return prismaPath
  }

  throw new Error(
    `Could not find query-engine binary. Searched in ${path.join(
      dir,
      '..',
      binaryName,
    )} and ${path.join(dir, '../..', binaryName)}`,
  )
}

export type GetDMMFOptions = {
  datamodel?: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
}

export async function getDMMF({
  datamodel,
  cwd = process.cwd(),
  prismaPath,
  datamodelPath,
  retry = 4,
}: GetDMMFOptions): Promise<DMMF.Document> {
  debug(`getDMMF, override prismaPath = ${prismaPath}`)
  prismaPath = prismaPath || (await getPrismaPath())
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
        PRISMA_DML_PATH: tempDatamodelPath!,
        RUST_BACKTRACE: '1',
        ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
      },
      maxBuffer: MAX_BUFFER,
    }

    result = await execa(
      prismaPath,
      ['--enable-raw-queries', 'cli', 'dmmf'],
      options,
    )

    if (!datamodelPath) {
      await unlink(tempDatamodelPath!)
    }

    if (result.stdout.includes('Please wait until the') && retry > 0) {
      debug('Retrying after "Please wait until"')
      await new Promise(r => setTimeout(r, 5000))
      return getDMMF({
        datamodel,
        cwd,
        prismaPath,
        datamodelPath,
        retry: retry - 1,
      })
    }

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
      await new Promise(resolve => setTimeout(resolve, 500))
      debug('Retrying after ETXTBSY')
      return getDMMF({
        datamodel,
        cwd,
        prismaPath,
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
        `Problem while parsing the query engine response at ${prismaPath}. ${result.stdout}\n${e.stack}`,
      )
    }
    throw new Error(e)
  }
}

export async function getConfig({
  datamodel,
  cwd = process.cwd(),
  prismaPath,
  datamodelPath,
}: GetDMMFOptions): Promise<ConfigMetaFormat> {
  debug(`getConfig, override prismaPath = ${prismaPath}`)
  prismaPath = prismaPath || (await getPrismaPath())

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

  try {
    const result = await execa(
      prismaPath,
      ['cli', 'get-config', tempDatamodelPath],
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

export interface WholeDmmf {
  dmmf: DMMF.Datamodel
  config: ConfigMetaFormat
}

export async function dmmfToDml(
  input: WholeDmmf,
  prismaPath?: string,
): Promise<string> {
  prismaPath = prismaPath || (await getPrismaPath())

  const filePath = await tmpWrite(JSON.stringify(input))
  try {
    const args = ['cli', 'dmmf-to-dml', filePath]
    debug(args)
    const result = await execa(prismaPath, args, {
      env: {
        ...process.env,
        RUST_BACKTRACE: '1',
      },
      maxBuffer: MAX_BUFFER,
    })

    await unlink(filePath)

    return result.stdout
  } catch (e) {
    if (e.stderr) {
      throw new Error(chalk.redBright.bold('DMMF To DML ') + e.stderr)
    }
    throw new Error(e)
  }
}

export async function getVersion(enginePath?: string): Promise<string> {
  enginePath = enginePath || (await getPrismaPath())

  debug(`Getting version of ${enginePath}`)
  const result = await execa(enginePath, ['--version'], {
    env: {
      ...process.env,
    },
    maxBuffer: MAX_BUFFER,
  })

  return result.stdout
}
