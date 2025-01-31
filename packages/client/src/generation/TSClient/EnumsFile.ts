import { datamodelEnumToSchemaEnum } from '@prisma/generator-helper'

import { Enum } from './Enum'
import { GenerateContext } from './GenerateContext'

export function createEnumsFile(context: GenerateContext): string {
  const modelEnums: string[] = []
  for (const datamodelEnum of context.dmmf.datamodel.enums) {
    modelEnums.push(new Enum(datamodelEnumToSchemaEnum(datamodelEnum), false).toTS())
  }
  return modelEnums.join('\n\n')
}
