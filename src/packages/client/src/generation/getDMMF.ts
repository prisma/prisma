import { DMMF } from '@prisma/generator-helper'
import {
  getDMMF as getRawDMMF,
  GetDMMFOptions,
} from '@prisma/sdk/dist/engine-commands/getDmmf'
import { DMMF as PrismaClientDMMF } from '../runtime/dmmf-types'
import { externalToInternalDmmf } from '../runtime/externalToInternalDmmf'

export function getPrismaClientDMMF(
  dmmf: DMMF.Document,
): PrismaClientDMMF.Document {
  return externalToInternalDmmf(dmmf)
}

// Mostly used for tests
export async function getDMMF(
  options: GetDMMFOptions,
): Promise<PrismaClientDMMF.Document> {
  const dmmf = await getRawDMMF(options)
  return getPrismaClientDMMF(dmmf)
}
