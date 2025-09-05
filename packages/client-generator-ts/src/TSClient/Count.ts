import { capitalize } from '@prisma/client-common'
import * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'
import indent from 'indent-string'

import { getFieldArgName, getSelectName } from '../utils'
import { ArgsTypeBuilder } from './Args'
import { TAB_SIZE } from './constants'
import { GenerateContext } from './GenerateContext'
import { buildOutputType } from './Output'

export class Count {
  constructor(
    protected readonly type: DMMF.OutputType,
    protected readonly context: GenerateContext,
  ) {}
  protected get argsTypes(): ts.Export<ts.TypeDeclaration>[] {
    const argsTypes: ts.Export<ts.TypeDeclaration>[] = []

    argsTypes.push(
      new ArgsTypeBuilder(this.type, this.context).addSelectArg().addIncludeArgIfHasRelations().createExport(),
    )

    for (const field of this.type.fields) {
      if (field.args.length > 0) {
        argsTypes.push(
          new ArgsTypeBuilder(this.type, this.context)
            .addSchemaArgs(field.args)
            .setGeneratedName(getCountArgsType(this.type.name, field.name))
            .createExport(),
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

export type ${getSelectName(
      name,
    )}<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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

${this.argsTypes.map((typeExport) => ts.stringify(typeExport)).join('\n\n')}
`
  }
}

function getCountArgsType(typeName: string, fieldName: string) {
  return `${typeName}Count${capitalize(fieldName)}Args`
}
