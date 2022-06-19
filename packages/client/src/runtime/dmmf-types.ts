import { DMMF } from '@prisma/generator-helper'

export { DMMF }

export type BundledDMMF = Pick<DMMF.Document, 'datamodel' | 'mappings'>
