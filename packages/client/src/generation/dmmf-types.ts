import { DMMF } from '@prisma/generator-helper'

export { DMMF }

export type BaseDMMF = {
  readonly datamodel: Omit<DMMF.Datamodel, 'indexes'>
}
