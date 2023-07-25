import { DMMF } from '../dmmf-types'
import { getFieldRefsTypeName, getRefAllowedTypeName } from '../utils'
import { Generatable } from './Generatable'

export class ModelFieldRefs implements Generatable {
  constructor(protected outputType: DMMF.OutputType) {}
  toTS() {
    const { name } = this.outputType
    return `

/**
 * Fields of the ${name} model
 */ 
interface ${getFieldRefsTypeName(name)} {
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
        return `  readonly ${field.name}: FieldRef<"${name}", ${refTypeName}>`
      })
      .join('\n')
  }
}
