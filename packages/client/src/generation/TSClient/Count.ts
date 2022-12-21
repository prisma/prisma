import type { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'

import type { DMMFHelper } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { capitalize, getFieldArgName, getSelectName } from '../utils'
import { ArgsType, MinimalArgsType } from './Args'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { TS } from './Generatable'
import { OutputType } from './Output'
import { PayloadType } from './Payload'
import { ifExtensions } from './utils/ifExtensions'

export class Count implements Generatable {
  constructor(
    protected readonly type: DMMF.OutputType,
    protected readonly dmmf: DMMFHelper,
    protected readonly genericsInfo: GenericArgsInfo,
    protected readonly generator?: GeneratorConfig,
  ) {}
  protected get argsTypes(): Generatable[] {
    const argsTypes: Generatable[] = []

    argsTypes.push(new ArgsType([], this.type, this.genericsInfo))

    for (const field of this.type.fields) {
      if (field.args.length > 0) {
        argsTypes.push(
          new MinimalArgsType(
            field.args,
            this.type,
            this.genericsInfo,
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
    const outputType = new OutputType(this.dmmf, this.type)

    return `
/**
 * Count Type ${name}
 */

${outputType.toTS()}

export type ${getSelectName(name)}${ifExtensions(
      '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
      '',
    )} = {
${indent(
  type.fields
    .map((field) => {
      const types = ['boolean']
      if (field.outputType.location === 'outputObjectTypes') {
        types.push(getFieldArgName(field))
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

${ifExtensions('', new PayloadType(outputType, this.dmmf, false).toTS())}



// Custom InputTypes
${this.argsTypes.map((gen) => TS(gen)).join('\n')}
`
  }
}

function getCountArgsType(typeName: string, fieldName: string) {
  return `${typeName}Count${capitalize(fieldName)}Args`
}
