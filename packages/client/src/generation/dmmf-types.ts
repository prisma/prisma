import { DMMF } from '@prisma/generator-helper'

export { DMMF }

export type BaseDMMF = Pick<DMMF.Document, 'datamodel'>
