import { getPlatform } from '@prisma/get-platform'
import chalk from 'chalk'
import execa = require('execa')
import path from 'path'
import { DMMF, ExternalDMMF } from '../runtime/dmmf-types'
import { externalToInternalDmmf } from '../runtime/externalToInternalDmmf'
import { transformDmmf } from '../runtime/transformDmmf'

const modelBlacklist = {
  // helper types
  Enumerable: true,
  MergeTruthyValues: true,
  CleanupNever: true,
  AtLeastOne: true,
  OnlyOne: true,
  // scalar filters
  StringFilter: true,
  IDFilter: true,
  FloatFilter: true,
  IntFilter: true,
  BooleanFilter: true,
  DateTimeFilter: true,
  // nullable scalar filters
  NullableStringFilter: true,
  NullableIDFilter: true,
  NullableFloatFilter: true,
  NullableIntFilter: true,
  NullableBooleanFilter: true,
  NullableDateTimeFilter: true,
  // photon classes
  PhotonFetcher: true,
  Photon: true,
  Engine: true,
  PhotonOptions: true,
}

const fieldBlacklist = {
  AND: true,
  OR: true,
  NOT: true,
}

/**
 * Checks if a model or field shouldn't be there
 * @param document DMMF.Document
 */
function checkBlacklist(sdl: DMMF.Datamodel) {
  for (const model of sdl.models) {
    if (modelBlacklist[model.name]) {
      throw new Error(`Model name ${model.name} is a reserved name and not allowed in the datamodel`)
    }
    for (const field of model.fields) {
      if (fieldBlacklist[field.name]) {
        throw new Error(`Field ${model.name}.${field.name} is a reserved name and not allowed in the datamodel`)
      }
    }
  }
}

export async function getRawDMMF(
  datamodel: string,
  cwd = process.cwd(),
  prismaPath?: string,
  datamodelPath?: string,
): Promise<ExternalDMMF.Document> {
  prismaPath = prismaPath || path.join(__dirname, `../../query-engine-${await getPlatform()}`)
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

export interface GetDmmfOptions {
  datamodel: string
  datamodelPath?: string
  cwd?: string
  prismaPath?: string
}

export async function getDMMF({ datamodel, cwd, prismaPath, datamodelPath }: GetDmmfOptions): Promise<DMMF.Document> {
  const externalDmmf = await getRawDMMF(datamodel, cwd, prismaPath, datamodelPath)
  const dmmf = transformDmmf(externalToInternalDmmf(externalDmmf))
  checkBlacklist(dmmf.datamodel)

  return dmmf
}
