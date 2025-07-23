import { uncapitalize } from '@prisma/client-common'
import { DMMFHelper } from '@prisma/client-generator-common/dmmf'
import { getOmitName } from '@prisma/client-generator-common/name-utils'
import * as ts from '@prisma/ts-builders'

export function globalOmitConfig(dmmf: DMMFHelper) {
  const objectType = ts.objectType().addMultiple(
    dmmf.datamodel.models.map((model) => {
      const type = ts.namedType(getOmitName(model.name))
      return ts.property(uncapitalize(model.name), type).optional()
    }),
  )

  return ts.moduleExport(ts.typeDeclaration('GlobalOmitConfig', objectType))
}
