import indent from 'indent-string';
import { DMMF } from '../../runtime/dmmf-types'
import { GraphQLScalarToJSTypeTable, JSOutputTypeToInputType } from '../../runtime/utils/common'
import { uniqueBy } from '../../runtime/utils/uniqueBy'
import { tab } from './constants';
import { Generatable } from './Generatable'
import { ExportCollector, wrapComment } from './helpers'

export class InputField implements Generatable {
  constructor(
    protected readonly field: DMMF.SchemaArg,
    protected readonly prefixFilter = false,
  ) { }
  public toTS(): string {
    const { field } = this

    const fieldTypes = field.inputTypes.map((t) => {
      let type =
        typeof t.type === 'string'
          ? GraphQLScalarToJSTypeTable[t.type] || t.type
          : this.prefixFilter
            ? `Base${t.type.name}`
            : t.type.name
      type = JSOutputTypeToInputType[type] ?? type

      if (type === 'Null') {
        return 'null'
      }

      if (t.isList) {
        if (Array.isArray(type)) {
          return type.map(t => `Enumerable<${t}>`).join(' | ')
        } else {
          return `Enumerable<${type}>`
        }
      }

      if (Array.isArray(type)) {
        type = type.join(' | ')
      }

      return type
    })

    let fieldType
    if (fieldTypes.length === 2) {
      fieldType = `XOR<${fieldTypes[0]}, ${fieldTypes[1]}>`
    } else {
      fieldType = fieldTypes.join(' | ')
    }

    const optionalStr = field.isRequired ? '' : '?'
    const jsdoc = field.comment ? wrapComment(field.comment) + '\n' : ''

    return `${jsdoc}${field.name}${optionalStr}: ${fieldType}`
  }
}


export class InputType implements Generatable {
  constructor(protected readonly type: DMMF.InputType, protected readonly collector?: ExportCollector) { }
  public toTS(): string {
    const { type } = this
    this.collector?.addSymbol(type.name)

    const fields = uniqueBy(type.fields, (f) => f.name)
    // TO DISCUSS: Should we rely on TypeScript's error messages?
    const body = `Readonly<{
${indent(
      fields
        .map((arg) =>
          new InputField(arg /*, type.atLeastOne && !type.atMostOne*/).toTS(),
        )
        .join('\n'),
      tab,
    )}
}>`
    return `
export type ${type.name} = ${body}`
  }
}