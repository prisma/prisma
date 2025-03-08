import type { DMMF } from '@prisma/generator-helper'

import type { DMMFHelper } from '../../dmmf'

export function getModelActions(dmmf: DMMFHelper, name: string) {
  const mapping = dmmf.mappingsMap[name] ?? { model: name, plural: `${name}s` }

  const mappingKeys = Object.keys(mapping).filter(
    (key) => key !== 'model' && key !== 'plural' && mapping[key],
  ) as DMMF.ModelAction[]

  if ('aggregate' in mapping) {
    mappingKeys.push('count' as DMMF.ModelAction)
  }

  return mappingKeys
}
