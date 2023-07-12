import indent from 'indent-string'

import { DMMF } from '../dmmf-types'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { getIncludeName, getModelArgName, getSelectName } from '../utils'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { getArgFieldJSDoc } from './helpers'
import { InputField } from './Input'

export class ArgsType implements Generatable {
  private generatedName: string | null = null
  private comment: string | null = null
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly type: DMMF.OutputType,
    protected readonly genericsInfo: GenericArgsInfo,
    protected readonly action?: DMMF.ModelAction,
  ) {}
  public setGeneratedName(name: string): this {
    this.generatedName = name
    return this
  }

  public setComment(comment: string): this {
    this.comment = comment
    return this
  }

  public toTS(): string {
    const { action, args } = this
    const { name } = this.type
    for (const arg of args) {
      arg.comment = getArgFieldJSDoc(this.type, action, arg)
    }

    const selectName = getSelectName(name)

    const argsToGenerate: DMMF.SchemaArg[] = [
      {
        name: 'select',
        isRequired: false,
        isNullable: true,
        inputTypes: [
          {
            type: selectName,
            location: 'inputObjectTypes',
            isList: false,
          },
          {
            type: 'null',
            location: 'scalar',
            isList: false,
          },
        ],
        comment: `Select specific fields to fetch from the ${name}`,
      },
    ]

    const hasRelationField = this.type.fields.some((f) => f.outputType.location === 'outputObjectTypes')

    if (hasRelationField) {
      const includeName = getIncludeName(name)
      argsToGenerate.push({
        name: 'include',
        isRequired: false,
        isNullable: true,
        inputTypes: [
          {
            type: includeName,
            location: 'inputObjectTypes',
            isList: false,
          },
          {
            type: 'null',
            location: 'scalar',
            isList: false,
          },
        ],
        comment: `Choose, which related nodes to fetch as well.`,
      })
    }

    argsToGenerate.push(...args)
    const generatedName = this.generatedName ?? getModelArgName(name, action)

    return `
/**
 * ${this.getGeneratedComment()}
 */
export type ${generatedName}<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
${indent(argsToGenerate.map((arg) => new InputField(arg, this.genericsInfo).toTS()).join('\n'), TAB_SIZE)}
}
`
  }

  private getGeneratedComment() {
    return this.comment ?? `${this.type.name} ${this.action ?? 'without action'}`
  }
}

export class MinimalArgsType implements Generatable {
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly type: DMMF.OutputType,
    protected readonly genericsInfo: GenericArgsInfo,
    protected readonly action?: DMMF.ModelAction,
    protected readonly generatedTypeName = getModelArgName(type.name, action),
  ) {}
  public toTS(): string {
    const { action, args } = this
    const { name } = this.type

    for (const arg of args) {
      arg.comment = getArgFieldJSDoc(this.type, action, arg)
    }

    return `
/**
 * ${name} ${action ? action : 'without action'}
 */
export type ${this.generatedTypeName}<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
${indent(
  args
    .map((arg) => {
      return new InputField(arg, this.genericsInfo).toTS()
    })
    .join('\n'),
  TAB_SIZE,
)}
}
`
  }
}
