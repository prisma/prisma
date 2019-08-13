import { getPlatform } from '@prisma/get-platform'
import chalk from 'chalk'
import execa = require('execa')
import path from 'path'
import { ExternalDMMF } from '../runtime/dmmf-types'

export async function getRawDMMF(
  datamodel: string,
  cwd = process.cwd(),
  prismaPath?: string,
  datamodelPath?: string,
): Promise<ExternalDMMF.Document> {
  prismaPath = prismaPath || path.join(__dirname, `../query-engine-${await getPlatform()}`)
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
): Promise<ExternalDMMF.Document> {
  prismaPath = prismaPath || path.join(__dirname, `../query-engine-${await getPlatform()}`)
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
    throw new Error(e)
  }
}

export interface WholeDmmf {
  dmmf: any
  config: any
}

export async function dmmfToDml(input: WholeDmmf, prismaPath?: string): Promise<string> {
  prismaPath = prismaPath || path.join(__dirname, `../query-engine-${await getPlatform()}`)
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
