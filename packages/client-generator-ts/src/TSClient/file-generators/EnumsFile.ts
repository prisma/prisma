import { datamodelEnumToSchemaEnum } from '@prisma/dmmf'

import { Enum } from '../Enum'
import { GenerateContext } from '../GenerateContext'

const jsDocHeader = `/**
* This file exports all enum related types from the schema.
*
* 🟢 You can import this file directly.
*/
`

export function createEnumsFile(context: GenerateContext): string {
  const modelEnums: string[] = []
  for (const datamodelEnum of context.dmmf.datamodel.enums) {
    modelEnums.push(new Enum(datamodelEnumToSchemaEnum(datamodelEnum), false).toTS())
  }

  // Cannot have a fully empty file, so we export a constant to indicate that there are no enums
  if (modelEnums.length === 0) return 'export const __NO_ENUMS__ = true'

  return jsDocHeader + modelEnums.join('\n\n')
}
