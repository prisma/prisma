import { uncapitalize } from '@prisma/client-common'
import * as ts from '@prisma/ts-builders'

import { DMMFHelper } from '../dmmf'
import { getOmitName } from '../utils'

export function globalOmitConfig(dmmf: DMMFHelper) {
  const objectType = ts.objectType().addMultiple(
    dmmf.datamodel.models.map((model) => {
      const type = ts.namedType(`Prisma.${getOmitName(model.name)}`)
      return ts.property(uncapitalize(model.name), type).optional()
    }),
  )

  return ts.moduleExport(ts.typeDeclaration('GlobalOmitConfig', objectType))
}
