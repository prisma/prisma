import * as DMMF from '@prisma/dmmf'

import { getFieldRefsTypeName, getRefAllowedTypeName } from '../utils'

export class ModelFieldRefs {
  constructor(protected outputType: DMMF.OutputType) {}
  toTS() {
    const { name } = this.outputType
    return `

/**
 * Fields of the ${name} model
 */
export interface ${getFieldRefsTypeName(name)} {
${this.stringifyFields()}
}
    `
  }

  private stringifyFields() {
    const { name } = this.outputType
    return this.outputType.fields
      .filter((field) => field.outputType.location !== 'outputObjectTypes')
      .map((field) => {
        const fieldOutput = field.outputType
        const refTypeName = getRefAllowedTypeName(fieldOutput)
        return `  readonly ${field.name}: Prisma.FieldRef<"${name}", ${refTypeName}>`
      })
      .join('\n')
  }
}
