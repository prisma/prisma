import { getPlatform } from '@prisma/get-platform'
import chalk from 'chalk'
import execa from 'execa'
import path from 'path'
import { ConfigMetaFormat } from './isdlToDatamodel2'
import { DMMF } from '@prisma/generator-helper'
import tmpWrite from 'temp-write'
import fs from 'fs'
import { promisify } from 'util'

const unlink = promisify(fs.unlink)

async function getPrismaPath(): Promise<string> {
  // tslint:disable-next-line
  const dir = eval('__dirname')
  const platform = await getPlatform()
  const extension = platform === 'windows' ? '.exe' : ''
  const relative = `../query-engine-${platform}${extension}`
  return path.join(dir, relative)
}

export type GetDMMFOptions = {
  datamodel: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  skipRetry?: boolean
}

export async function getDMMF({
  datamodel,
  cwd = process.cwd(),
  prismaPath,
  datamodelPath,
  skipRetry,
}: GetDMMFOptions): Promise<DMMF.Document> {
  prismaPath = prismaPath || (await getPrismaPath())
  let result
  try {
    result = await execa(prismaPath, ['cli', '--dmmf'], {
      cwd,
      env: {
        ...process.env,
        PRISMA_DML: datamodel,
        PRISMA_SDL_PATH: datamodelPath,
        RUST_BACKTRACE: '1',
      },
    })

    return JSON.parse(result.stdout)
  } catch (e) {
    // If this unlikely event happens, try it at least once more
    if (e.message.includes('Command failed with exit code 26 (ETXTBSY)')) {
      await new Promise(resolve => {
        process.nextTick(resolve)
      })
      return getDMMF({
        datamodel,
        cwd,
        prismaPath,
        datamodelPath,
        skipRetry: true,
      })
    }
    if (e.stderr) {
      throw new Error(chalk.redBright.bold('Schema parsing ') + e.stderr)
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
  prismaPath = prismaPath || (await getPrismaPath())
  try {
    const result = await execa(
      prismaPath,
      ['cli', '--get_config', JSON.stringify({ datamodel }) + '\n'],
      {
        cwd,
        env: {
          ...process.env,
          PRISMA_DML: datamodel,
          PRISMA_SDL_PATH: datamodelPath,
          RUST_BACKTRACE: '1',
        },
      },
    )

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
    const args = ['cli', '--dmmf_to_dml', filePath]
    const result = await execa(prismaPath, args, {
      env: {
        ...process.env,
        RUST_BACKTRACE: '1',
      },
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
