import Process from '@prisma/engine-core/dist/process'
import path from 'path'
import through from 'through2'
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
  prismaPath = path.join(__dirname, '../../runtime/prisma'), // improve the binary resolution
): Promise<ExternalDMMF.Document> {
  const child = new Process(prismaPath, 'cli', '--dmmf')
  let dmmf
  let error
  child.cwd(cwd)
  child.env({ PRISMA_DML: datamodel, RUST_BACKTRACE: '1' })
  child.stdout(
    concat(d => {
      try {
        dmmf = JSON.parse(d)
      } catch (e) {
        error = d
      }
    }),
  )
  child.stderr(process.stderr)
  await child.run()
  if (error) {
    throw new Error(error)
  }
  return dmmf
}

function concat(fn: (result: string) => void): NodeJS.WriteStream {
  let buf = ''
  function transform(chunk, enc, callback) {
    buf += chunk.toString()
    callback()
  }
  function flush(callback) {
    fn(buf)
    callback()
  }
  return through(transform, flush)
}

export interface GetDmmfOptions {
  datamodel: string
  cwd?: string
  prismaPath?: string
}

export async function getDMMF({ datamodel, cwd, prismaPath }: GetDmmfOptions): Promise<DMMF.Document> {
  const externalDmmf = await getRawDMMF(datamodel, cwd, prismaPath)
  const dmmf = transformDmmf(externalToInternalDmmf(externalDmmf))
  checkBlacklist(dmmf.datamodel)

  return dmmf
}
