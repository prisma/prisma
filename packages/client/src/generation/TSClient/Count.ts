import indent from 'indent-string'

import { DMMF } from '../dmmf-types'
import * as ts from '../ts-builders'
import { capitalize, getFieldArgName, getSelectName } from '../utils'
import { ArgsType, MinimalArgsType } from './Args'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { TS } from './Generatable'
import { GenerateContext } from './GenerateContext'
import { buildOutputType } from './Output'

export class Count implements Generatable {
  constructor(protected readonly type: DMMF.OutputType, protected readonly context: GenerateContext) {}
  protected get argsTypes(): Generatable[] {
    const argsTypes: Generatable[] = []

    argsTypes.push(new ArgsType([], this.type, this.context))

    for (const field of this.type.fields) {
      if (field.args.length > 0) {
        argsTypes.push(
          new MinimalArgsType(
            field.args,
            this.type,
            this.context,
            undefined,
            getCountArgsType(this.type.name, field.name),
          ),
        )
      }
    }

    return argsTypes
  }
  public toTS(): string {
    const { type } = this
    const { name } = type
    const outputType = buildOutputType(type)

    return `
/**
 * Count Type ${name}
 */

${ts.stringify(outputType)}

export type ${getSelectName(name)}<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
${indent(
  type.fields
    .map((field) => {
      const types = ['boolean']
      if (field.outputType.location === 'outputObjectTypes') {
        types.push(getFieldArgName(field, this.type.name))
      }

      // TODO: what should happen if both args and output types are present?
      // Right new, they both will be part of the union, but is it correct?

      if (field.args.length > 0) {
        types.push(getCountArgsType(name, field.name))
      }

      return `${field.name}?: ${types.join(' | ')}`
    })
    .join('\n'),
  TAB_SIZE,
)}
}

// Custom InputTypes
${this.argsTypes.map((gen) => TS(gen)).join('\n')}
`
  }
}

function getCountArgsType(typeName: string, fieldName: string) {
  return `${typeName}Count${capitalize(fieldName)}Args`
}
