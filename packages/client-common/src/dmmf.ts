import * as DMMF from '@prisma/dmmf'

export type BaseDMMF = {
  readonly datamodel: Omit<DMMF.Datamodel, 'indexes'>
}
