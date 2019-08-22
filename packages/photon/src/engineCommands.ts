import { getPlatform } from '@prisma/get-platform'
import chalk from 'chalk'
import execa from 'execa'
import path from 'path'
import { ConfigMetaFormat } from './isdlToDatamodel2'
import { ExternalDMMF } from './runtime/dmmf-types'

async function getPrismaPath(): Promise<string> {
  // tslint:disable-next-line
  const dir = eval('__dirname')
  const relative = `../query-engine-${await getPlatform()}`
  return path.join(dir, relative)
}

export async function getRawDMMF(
  datamodel: string,
  cwd = process.cwd(),
  prismaPath?: string,
  datamodelPath?: string,
): Promise<ExternalDMMF.Document> {
  prismaPath = prismaPath || (await getPrismaPath())
  try {
    const result = await execa(prismaPath, ['cli', '--dmmf'], {
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
    if (e.stderr) {
      throw new Error(chalk.redBright.bold('Schema parsing ') + e.stderr)
    }
    throw new Error(e)
  }
}

export async function getConfig(
  datamodel: string,
  cwd = process.cwd(),
  prismaPath?: string,
  datamodelPath?: string,
): Promise<ConfigMetaFormat> {
  prismaPath = prismaPath || (await getPrismaPath())
  try {
    const result = await execa(prismaPath, ['cli', '--get_config', JSON.stringify({ datamodel }) + '\n'], {
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
    if (e.stderr) {
      throw new Error(chalk.redBright.bold('Get config ') + e.stderr)
    }
    if (e.stdout) {
      throw new Error(chalk.redBright.bold('Get config ') + e.stdout)
    }
    throw new Error(e)
  }
}

export interface WholeDmmf {
  dmmf: any
  config: any
}

export async function dmmfToDml(input: WholeDmmf, prismaPath?: string): Promise<string> {
  prismaPath = prismaPath || (await getPrismaPath())
  input = {
    config: input.config,
    dmmf: JSON.stringify(input.dmmf),
  }
  try {
    const result = await execa(prismaPath, ['cli', '--dmmf_to_dml', JSON.stringify(input)], {
      env: {
        ...process.env,
        RUST_BACKTRACE: '1',
      },
    })

    return result.stdout
  } catch (e) {
    if (e.stderr) {
      throw new Error(chalk.redBright.bold('DMMF To DML ') + e.stderr)
    }
    throw new Error(e)
  }
}
