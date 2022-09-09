import indent from 'indent-string'

import { get } from '../../../../../helpers/blaze/get'
import { DMMFHelper } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import { getArgName, getModelArgName, getPayloadName, Projection } from '../utils'
import type { Generatable } from './Generatable'
import type { OutputType } from './Output'

export class PayloadType implements Generatable {
  constructor(
    protected readonly type: OutputType,
    protected readonly dmmf: DMMFHelper,
    protected readonly findMany = true,
  ) {}

  public toTS(): string {
    const { type } = this
    const { name } = type

    const argsName = getArgName(name, false)

    const include = this.renderRelations(Projection.include)
    const select = this.renderRelations(Projection.select)

    const isModel = !this.dmmf.typeMap[name]
    const findManyArg = isModel && this.findMany ? ` | ${getModelArgName(name, DMMF.ModelAction.findMany)}` : ''

    return `\
export type ${getPayloadName(name)}<
  S extends boolean | null | undefined | ${argsName},
  U = keyof S
    > = S extends true
      ? ${name}
  : S extends undefined
  ? never
  : S extends ${argsName}${findManyArg}
  ?'include' extends U
  ? ${name} ${include.length > 0 ? ` & ${include}` : ''}
  : 'select' extends U
  ? ${select}
  : ${name}
: ${name}
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

    const selectPrefix = projection === Projection.select ? ` P extends keyof ${type.name} ? ${type.name}[P] :` : ''

    return `{
  [P in TrueKeys<S['${projection}']>]:
${indent(
  relations
    .map(
      (f) =>
        `P extends '${f.name}' ? ${this.wrapType(
          f,
          `${getPayloadName(
            (f.outputType.type as DMMF.OutputType).name,
          )}<Exclude<S['${projection}'], undefined | null>[P]>`,
        )} :`,
    )
    .join('\n'),
  6,
)} ${selectPrefix} never
} `
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
