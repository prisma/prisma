import indent from 'indent-string'

import { DMMF } from '../../runtime/dmmf-types'
import { lowerCase } from '../../runtime/utils/common'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { getIncludeName, getModelArgName, getSelectName } from '../utils'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { getArgFieldJSDoc } from './helpers'
import { InputField } from './Input'
import { ifExtensions } from './utils/ifExtensions'

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
    if (action === DMMF.ModelAction.findUnique || action === DMMF.ModelAction.findFirst) {
      return this.generateFindMethodArgs(action, name, argsToGenerate, generatedName)
    }

    return `
/**
 * ${this.getGeneratedComment()}
 */
export type ${generatedName}${ifExtensions(
      '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
      '',
    )} = {
${indent(argsToGenerate.map((arg) => new InputField(arg, false, false, this.genericsInfo).toTS()).join('\n'), TAB_SIZE)}
}
`
  }

  private generateFindMethodArgs(
    action: DMMF.ModelAction.findFirst | DMMF.ModelAction.findUnique,
    name: string,
    argsToGenerate: DMMF.SchemaArg[],
    modelArgName: string,
  ) {
    const baseTypeName = getBaseTypeName(name, action)
    const replacement =
      action === DMMF.ModelAction.findFirst ? DMMF.ModelAction.findFirstOrThrow : DMMF.ModelAction.findUniqueOrThrow

    // we have to use interface for arg type here, since as for TS 4.7.2
    // using BaseType & { rejectOnNotFound } intersection breaks type checking for `select`
    // option
    return `
/**
 * ${name} base type for ${action} actions
 */
export type ${baseTypeName}${ifExtensions(
      '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
      '',
    )} = {
${indent(argsToGenerate.map((arg) => new InputField(arg, false, false, this.genericsInfo).toTS()).join('\n'), TAB_SIZE)}
}

/**
 * ${this.getGeneratedComment()}
 */
export interface ${modelArgName}${ifExtensions(
      '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
      '',
    )} extends ${baseTypeName}${ifExtensions('<ExtArgs>', '')} {
 /**
  * Throw an Error if query returns no results
  * @deprecated since 4.0.0: use \`${replacement}\` method instead
  */
  rejectOnNotFound?: RejectOnNotFound
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
export type ${this.generatedTypeName}${ifExtensions(
      '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
      '',
    )} = {
${indent(
  args
    .map((arg) => {
      const noEnumerable = arg.inputTypes.some((input) => input.type === 'Json') && arg.name === 'pipeline'
      return new InputField(arg, false, noEnumerable, this.genericsInfo).toTS()
    })
    .join('\n'),
  TAB_SIZE,
)}
}
`
  }
}

type ActionWithBaseType = DMMF.ModelAction.findFirst | DMMF.ModelAction.findUnique

function getBaseTypeName(modelName: string, action: ActionWithBaseType): string {
  switch (action) {
    case DMMF.ModelAction.findFirst:
      return `${modelName}FindFirstArgsBase`
    case DMMF.ModelAction.findUnique:
      return `${modelName}FindUniqueArgsBase`
  }
}
