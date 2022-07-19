import type { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'

import type { DMMFHelper } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import { getFieldArgName, getSelectName } from '../utils'
import { ArgsType } from './Args'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { TS } from './Generatable'
import type { ExportCollector } from './helpers'
import { OutputType } from './Output'
import { PayloadType } from './Payload'

export class Count implements Generatable {
  constructor(
    protected readonly type: DMMF.OutputType,
    protected readonly dmmf: DMMFHelper,
    protected readonly generator?: GeneratorConfig,
    protected readonly collector?: ExportCollector,
  ) {}
  protected get argsTypes(): Generatable[] {
    const argsTypes: Generatable[] = []

    argsTypes.push(new ArgsType([], this.type))

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

export type ${getSelectName(name)} = {
${indent(
  type.fields
    .map(
      (f) => `${f.name}?: boolean` + (f.outputType.location === 'outputObjectTypes' ? ` | ${getFieldArgName(f)}` : ''),
    )
    .join('\n'),
  TAB_SIZE,
)}
}

${new PayloadType(outputType, false).toTS()}



// Custom InputTypes
${this.argsTypes.map((gen) => TS(gen)).join('\n')}
`
  }
}
