import indent from 'indent-string'

import { get } from '../../../../../helpers/blaze/get'
import { DMMFHelper } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import { lowerCase } from '../../runtime/utils/common'
import { getArgName, getModelArgName, getPayloadName, Projection } from '../utils'
import type { Generatable } from './Generatable'
import type { OutputType } from './Output'
import { ifExtensions } from './utils/ifExtensions'

export class PayloadType implements Generatable {
  constructor(
    protected readonly type: OutputType,
    protected readonly dmmf: DMMFHelper,
    protected readonly findMany = true,
  ) { }

  public toTS(): string {
    const { type } = this
    const { name } = type

    const argsName = getArgName(name)

    const include = this.renderRelations(Projection.include)
    const select = this.renderRelations(Projection.select)

    const isModel = !this.dmmf.typeMap[name]
    const findManyArg =
      isModel && this.findMany ? ` | ${getModelArgName(name, DMMF.ModelAction.findMany)}${ifExtensions('', '')}` : ''

    return `\
export type ${getPayloadName(name)}<S extends boolean | null | undefined | ${argsName}${ifExtensions(
      `, ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs, _${name} = runtime.Types.Extensions.GetResult<${name}, ExtArgs['result']['${lowerCase(
        name,
      )}']>`,
      '',
    )}> =
  S extends { select: any, include: any } ? 'Please either choose \`select\` or \`include\`' :
  S extends true ? ${ifExtensions(`_${name}`, name)} :
  S extends undefined ? never :
  S extends { include: any } & (${argsName}${findManyArg})
  ? ${ifExtensions(`_${name}`, name)} ${include.length > 0 ? ifExtensions(`& ${include}`, ` & ${include}`) : ''}
  : S extends { select: any } & (${argsName}${findManyArg})
    ? ${select}
    : ${ifExtensions(`_${name}`, name)}
`
  }
  private renderRelations(projection: Projection): string {
    const { type } = this

    const relationsProjectionChoice = {
      // For select, a "relation"" can be a model or a composite
      [Projection.select]: () => {
        return type.fields.filter((f) => {
          return f.outputType.location === 'outputObjectTypes'
        })
      },

      // But for include, a "relation" can only be a model
      [Projection.include]: () => {
        const nonCompositeRelations = type.fields.filter((f) => {
          return (
            f.outputType.location === 'outputObjectTypes' &&
            typeof f.outputType.type === 'object' &&
            !this.dmmf.typeMap[f.outputType.type.name]
          )
        })

        return nonCompositeRelations
      },
    }

    const relations = get(relationsProjectionChoice, projection)()

    if (projection === Projection.include && relations.length === 0) return ''

    const typeName = ifExtensions(`_${type.name}`, type.name)

    const isSelect = projection === Projection.select
    const selectPrefix = isSelect ? ` P extends keyof ${typeName} ? ${typeName}[P] :` : ''
    const selectPartial = projection === Projection.select ?
      `
    ` : ''

    const possiblyPartialContent = `{
      [P in TruthyKeys<S['${projection}']>]:
    ${indent(
      relations
        .map(
          (f) =>
            `P extends '${f.name}' ? ${this.wrapType(
              f,
              `${getPayloadName((f.outputType.type as DMMF.OutputType).name)}<S['${projection}'][P]${ifExtensions(
                ', ExtArgs',
                '',
              )}>`,
            )} :`,
        )
        .join('\n'),
      6,
    )} ${selectPrefix} never
    }`



    const wrapWithPartial = (shouldWrap: boolean, content: string) => {
      return shouldWrap ? `Partial<${content}>` : content
    }

    const alwaysThereContent = !isSelect ? '' : `{
      [P in ActuallyTruthyKeys<S['${projection}']>]:
    ${indent(
      relations
        .map(
          (f) =>
            `P extends '${f.name}' ? ${this.wrapType(
              f,
              `${getPayloadName((f.outputType.type as DMMF.OutputType).name)}<S['${projection}'][P]${ifExtensions(
                ', ExtArgs',
                '',
              )}>`,
            )} :`,
        )
        .join('\n'),
      6,
    )} ${selectPrefix} never
    }`
    return wrapWithPartial(isSelect, possiblyPartialContent)
  }
  private wrapType(field: DMMF.SchemaField, str: string): string {
    const { outputType } = field
    if (!field.isNullable && !outputType.isList) {
      return str
    }
    if (outputType.isList) {
      return `Array < ${str}> `
    }
    if (str === 'Null') {
      return 'null'
    }
    if (field.isNullable) {
      str += ' | null'
    }
    return str
  }
}
