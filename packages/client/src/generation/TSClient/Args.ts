import indent from 'indent-string'

import { ClientModelAction } from '../../runtime/clientActions'
import { DMMF } from '../../runtime/dmmf-types'
import { getIncludeName, getModelArgName, getSelectName } from '../utils'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import type { ExportCollector } from './helpers'
import { getArgFieldJSDoc } from './helpers'
import { InputField } from './Input'

export class ArgsType implements Generatable {
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly type: DMMF.OutputType,
    protected readonly action?: ClientModelAction,
    protected readonly collector?: ExportCollector,
  ) {}
  public toTS(): string {
    const { action, args } = this
    const { name } = this.type
    for (const arg of args) {
      arg.comment = getArgFieldJSDoc(this.type, action, arg)
    }

    const selectName = getSelectName(name)
    this.collector?.addSymbol(selectName)

    const bothArgsOptional: DMMF.SchemaArg[] = [
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
      this.collector?.addSymbol(includeName)
      bothArgsOptional.push({
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
    const addRejectOnNotFound = action === DMMF.ModelAction.findUnique || action === DMMF.ModelAction.findFirst
    if (addRejectOnNotFound) {
      const replacement = action === DMMF.ModelAction.findFirst ? 'findFirstOrThrow' : 'findUniqueOrThrow'
      bothArgsOptional.push({
        name: 'rejectOnNotFound',
        isRequired: false,
        isNullable: true,
        inputTypes: [
          {
            type: 'RejectOnNotFound',
            location: 'scalar',
            isList: false,
          },
        ],
        deprecation: {
          sinceVersion: '4.0.0',
          reason: `Use \`${replacement}\` method instead`,
          plannedRemovalVersion: '5.0.0',
        },
        comment: `Throw an Error if a ${name} can't be found`,
      })
    }
    bothArgsOptional.push(...args)

    const modelArgName = getModelArgName(name, action)
    this.collector?.addSymbol(modelArgName)

    return `
/**
 * ${name} ${action ? action : 'without action'}
 */
export type ${modelArgName} = {
${indent(bothArgsOptional.map((arg) => new InputField(arg).toTS()).join('\n'), TAB_SIZE)}
}
`
  }
}

export class MinimalArgsType implements Generatable {
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly type: DMMF.OutputType,
    protected readonly action?: DMMF.ModelAction,
    protected readonly collector?: ExportCollector,
  ) {}
  public toTS(): string {
    const { action, args } = this
    const { name } = this.type

    for (const arg of args) {
      arg.comment = getArgFieldJSDoc(this.type, action, arg)
    }

    const typeName = getModelArgName(name, action)

    this.collector?.addSymbol(typeName)

    return `
/**
 * ${name} ${action ? action : 'without action'}
 */
export type ${typeName} = {
${indent(
  args
    .map((arg) => {
      const noEnumerable = arg.inputTypes.some((input) => input.type === 'Json') && arg.name === 'pipeline'
      return new InputField(arg, false, noEnumerable).toTS()
    })
    .join('\n'),
  TAB_SIZE,
)}
}
`
  }
}
