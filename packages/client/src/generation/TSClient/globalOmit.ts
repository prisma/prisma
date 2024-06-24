import { DMMFHelper } from '../dmmf'
import * as ts from '../ts-builders'
import { getOmitName } from '../utils'
import { lowerCase } from '../utils/common'

export function globalOmitConfig(dmmf: DMMFHelper) {
  const objectType = ts.objectType().addMultiple(
    dmmf.datamodel.models.map((model) => {
      const type = ts.namedType(getOmitName(model.name))
      return ts.property(lowerCase(model.name), type).optional()
    }),
  )

  return ts.moduleExport(ts.typeDeclaration('GlobalOmitConfig', objectType))
}
