import * as DMMF from '@prisma/dmmf'

export { DMMF }

export type BaseDMMF = {
  readonly datamodel: Omit<DMMF.Datamodel, 'indexes'>
}
