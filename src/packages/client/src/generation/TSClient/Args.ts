import indent from 'indent-string';
import { Generatable } from "./Generatable"
import { DMMF } from '../../runtime/dmmf-types'
import { ExportCollector, topLevelArgsJsDocs } from "./helpers"
import pluralize from 'pluralize'
import { getIncludeName, getModelArgName, getSelectName } from "../utils"
import { InputField } from './Input';
import { tab } from './constants';

export class ArgsType implements Generatable {
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly model: DMMF.Model,
    protected readonly action?: DMMF.ModelAction,
    protected readonly collector?: ExportCollector
  ) { }
  public toTS(): string {
    const { action, args } = this
    const { name } = this.model

    const singular = name
    const plural = pluralize(name)

    for (const arg of args) {
      if (action && topLevelArgsJsDocs[action][arg.name]) {
        const comment = topLevelArgsJsDocs[action][arg.name](singular, plural)
        arg.comment = comment
      }
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
            isList: false
          }
        ],
        comment: `Select specific fields to fetch from the ${name}`,
      },
    ]

    const hasRelationField = this.model.fields.some((f) => f.kind === 'object')

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
            isList: false
          }
        ],
        comment: `Choose, which related nodes to fetch as well.`,
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
${indent(
      bothArgsOptional.map((arg) => new InputField(arg).toTS()).join('\n'),
      tab,
    )}
}
`
  }
}

export class MinimalArgsType implements Generatable {
  constructor(
    protected readonly args: DMMF.SchemaArg[],
    protected readonly model: DMMF.Model,
    protected readonly action?: DMMF.ModelAction,
    protected readonly collector?: ExportCollector
  ) { }
  public toTS(): string {
    const { action, args } = this
    const { name } = this.model

    const typeName = getModelArgName(name, action)

    this.collector?.addSymbol(typeName)

    return `
/**
 * ${name} ${action ? action : 'without action'}
 */
export type ${typeName} = {
${indent(args.map((arg) => new InputField(arg).toTS()).join('\n'), tab)}
}
`
  }
}
