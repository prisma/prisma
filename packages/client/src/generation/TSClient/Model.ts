import type { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'
import { klona } from 'klona'

import type { DMMFHelper } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import { lowerCase } from '../../runtime/utils/common'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import * as ts from '../ts-builders'
import {
  getAggregateArgsName,
  getAggregateGetName,
  getAggregateInputType,
  getAggregateName,
  getArgName,
  getAvgAggregateName,
  getCountAggregateInputName,
  getCountAggregateOutputName,
  getFieldArgName,
  getFieldRefsTypeName,
  getGroupByArgsName,
  getGroupByName,
  getGroupByPayloadName,
  getIncludeName,
  getMaxAggregateName,
  getMinAggregateName,
  getModelArgName,
  getModelFieldArgsName,
  getReturnType,
  getSelectName,
  getSumAggregateName,
  Projection,
} from '../utils'
import { buildComment } from '../utils/types/buildComment'
import { InputField } from './../TSClient'
import { ArgsType, MinimalArgsType } from './Args'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { TS } from './Generatable'
import { getArgFieldJSDoc, getArgs, getGenericMethod, getMethodJSDoc, wrapComment } from './helpers'
import { InputType } from './Input'
import { ModelFieldRefs } from './ModelFieldRefs'
import { ModelOutputField, OutputType } from './Output'
import { PayloadType } from './Payload'
import { SchemaOutputType } from './SchemaOutput'
import { buildIncludeType, buildScalarSelectType, buildSelectType } from './SelectInclude'
import { getModelActions } from './utils/getModelActions'
import { ifExtensions } from './utils/ifExtensions'

export class Model implements Generatable {
  protected outputType: OutputType
  protected type: DMMF.OutputType
  protected mapping?: DMMF.ModelMapping
  constructor(
    protected readonly model: DMMF.Model,
    protected readonly dmmf: DMMFHelper,
    protected readonly genericsInfo: GenericArgsInfo,
    protected readonly generator?: GeneratorConfig,
  ) {
    this.type = dmmf.outputTypeMap[model.name]
    this.outputType = new OutputType(dmmf, this.type)
    this.mapping = dmmf.mappings.modelOperations.find((m) => m.model === model.name)!
  }
  protected get argsTypes(): Generatable[] {
    const argsTypes: Generatable[] = []
    for (const action of Object.keys(DMMF.ModelAction)) {
      const fieldName = this.rootFieldNameForAction(action as DMMF.ModelAction)
      if (!fieldName) {
        continue
      }
      const field = this.dmmf.rootFieldMap[fieldName]
      if (!field) {
        throw new Error(`Oops this must not happen. Could not find field ${fieldName} on either Query or Mutation`)
      }

      if (action === 'updateMany' || action === 'deleteMany' || action === 'createMany') {
        argsTypes.push(new MinimalArgsType(field.args, this.type, this.genericsInfo, action as DMMF.ModelAction))
      } else if (action === 'findRaw' || action === 'aggregateRaw') {
        argsTypes.push(new MinimalArgsType(field.args, this.type, this.genericsInfo, action as DMMF.ModelAction))
      } else if (action !== 'groupBy' && action !== 'aggregate') {
        argsTypes.push(new ArgsType(field.args, this.type, this.genericsInfo, action as DMMF.ModelAction))
      }
    }

    for (const field of this.type.fields) {
      if (field.args.length) {
        if (field.outputType.location === 'outputObjectTypes' && typeof field.outputType.type === 'object') {
          argsTypes.push(
            new ArgsType(field.args, field.outputType.type, this.genericsInfo)
              .setGeneratedName(getModelFieldArgsName(field, this.model.name))
              .setComment(`${this.model.name}.${field.name}`),
          )
        }
      }
    }

    argsTypes.push(new ArgsType([], this.type, this.genericsInfo))

    return argsTypes
  }

  private rootFieldNameForAction(action: DMMF.ModelAction) {
    return this.mapping?.[action]
  }

  private getGroupByTypes() {
    const { model, mapping } = this

    const groupByType = this.dmmf.outputTypeMap[getGroupByName(model.name)]
    if (!groupByType) {
      throw new Error(`Could not get group by type for model ${model.name}`)
    }

    const groupByRootField = this.dmmf.rootFieldMap[mapping!.groupBy!]
    if (!groupByRootField) {
      throw new Error(`Could not find groupBy root field for model ${model.name}. Mapping: ${mapping?.groupBy}`)
    }

    const groupByArgsName = getGroupByArgsName(model.name)

    return `


export type ${groupByArgsName}${ifExtensions(
      '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
      '',
    )} = {
${indent(
  groupByRootField.args
    .map((arg) => {
      arg.comment = getArgFieldJSDoc(this.type, DMMF.ModelAction.groupBy, arg)
      return new InputField(arg, arg.name === 'by', this.genericsInfo).toTS()
    })
    .concat(
      groupByType.fields
        .filter((f) => f.outputType.location === 'outputObjectTypes')
        .map((f) => {
          if (f.outputType.location === 'outputObjectTypes') {
            return `${f.name}?: ${getAggregateInputType((f.outputType.type as DMMF.OutputType).name)}${
              f.name === '_count' ? ' | true' : ''
            }`
          }

          // to make TS happy, but can't happen, as we filter for outputObjectTypes
          return ''
        }),
    )
    .join('\n'),
  TAB_SIZE,
)}
}

${new OutputType(this.dmmf, groupByType).toTS()}

type ${getGroupByPayloadName(model.name)}<T extends ${groupByArgsName}> = Prisma.PrismaPromise<
  Array<
    PickArray<${groupByType.name}, T['by']> &
      {
        [P in ((keyof T) & (keyof ${groupByType.name}))]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], ${groupByType.name}[P]>
          : GetScalarType<T[P], ${groupByType.name}[P]>
      }
    >
  >
`
  }
  private getAggregationTypes() {
    const { model, mapping } = this
    let aggregateType = this.dmmf.outputTypeMap[getAggregateName(model.name)]
    if (!aggregateType) {
      throw new Error(`Could not get aggregate type "${getAggregateName(model.name)}" for "${model.name}"`)
    }
    aggregateType = klona(aggregateType)

    const aggregateRootField = this.dmmf.rootFieldMap[mapping!.aggregate!]
    if (!aggregateRootField) {
      throw new Error(`Could not find aggregate root field for model ${model.name}. Mapping: ${mapping?.aggregate}`)
    }

    const aggregateTypes = [aggregateType]

    const avgType = this.dmmf.outputTypeMap[getAvgAggregateName(model.name)]
    const sumType = this.dmmf.outputTypeMap[getSumAggregateName(model.name)]
    const minType = this.dmmf.outputTypeMap[getMinAggregateName(model.name)]
    const maxType = this.dmmf.outputTypeMap[getMaxAggregateName(model.name)]
    const countType = this.dmmf.outputTypeMap[getCountAggregateOutputName(model.name)]

    if (avgType) {
      aggregateTypes.push(avgType)
    }
    if (sumType) {
      aggregateTypes.push(sumType)
    }
    if (minType) {
      aggregateTypes.push(minType)
    }
    if (maxType) {
      aggregateTypes.push(maxType)
    }
    if (countType) {
      aggregateTypes.push(countType)
    }

    const aggregateArgsName = getAggregateArgsName(model.name)

    const aggregateName = getAggregateName(model.name)

    return `${aggregateTypes.map((type) => new SchemaOutputType(type).toTS()).join('\n')}

${
  aggregateTypes.length > 1
    ? aggregateTypes
        .slice(1)
        .map((type) => {
          const newType: DMMF.InputType = {
            name: getAggregateInputType(type.name),
            constraints: {
              maxNumFields: null,
              minNumFields: null,
            },
            fields: type.fields.map((field) => ({
              ...field,
              name: field.name,
              isNullable: false,
              isRequired: false,
              inputTypes: [
                {
                  isList: false,
                  location: 'scalar',
                  type: 'true',
                },
              ],
            })),
          }
          return new InputType(newType, this.genericsInfo).toTS()
        })
        .join('\n')
    : ''
}

export type ${aggregateArgsName}${ifExtensions(
      '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
      '',
    )} = {
${indent(
  aggregateRootField.args
    .map((arg) => {
      arg.comment = getArgFieldJSDoc(this.type, DMMF.ModelAction.aggregate, arg)
      return new InputField(arg, false, this.genericsInfo).toTS()
    })
    .concat(
      aggregateType.fields.map((f) => {
        let data = ''
        const comment = getArgFieldJSDoc(this.type, DMMF.ModelAction.aggregate, f.name)
        data += comment ? wrapComment(comment) + '\n' : ''
        if (f.name === '_count' || f.name === 'count') {
          data += `${f.name}?: true | ${getCountAggregateInputName(model.name)}`
        } else {
          data += `${f.name}?: ${getAggregateInputType((f.outputType.type as DMMF.OutputType).name)}`
        }
        return data
      }),
    )
    .join('\n'),
  TAB_SIZE,
)}
}

export type ${getAggregateGetName(model.name)}<T extends ${getAggregateArgsName(model.name)}> = {
      [P in keyof T & keyof ${aggregateName}]: P extends '_count' | 'count'
    ? T[P] extends true
      ? number
      : GetScalarType<T[P], ${aggregateName}[P]>
    : GetScalarType<T[P], ${aggregateName}[P]>
}`
  }
  public toTSWithoutNamespace(): string {
    const { model } = this
    const docLines = model.documentation ?? ''
    const modelLine = `Model ${model.name}\n`
    const docs = `${modelLine}${docLines}`

    return ifExtensions(
      () => {
        return `export type ${
          model.name
        }Payload<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs> = {
${indent(
  `objects: {
${indent(
  model.fields
    .filter((f) => f.kind === 'object')
    .map((field) => new ModelOutputField(this.dmmf, field, false).toTS())
    .join('\n'),
  TAB_SIZE,
)}
}`,
  TAB_SIZE,
)}
${indent(
  `scalars: runtime.Types.Extensions.GetResult<{
${indent(
  model.fields
    .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
    .map((field) => new ModelOutputField(this.dmmf, field, !this.dmmf.typeMap[field.type]).toTS())
    .join('\n'),
  TAB_SIZE,
)}
}, ExtArgs['result']['${lowerCase(model.name)}']>`,
  TAB_SIZE,
)}
}

${buildComment(docs)}export type ${model.name} = ${model.name}Payload['scalars']
`
      },
      () => {
        return `${buildComment(docs)}export type ${model.name} = {
${indent(
  model.fields
    .filter((f) => (f.kind !== 'object' && f.kind !== 'unsupported') || this.dmmf.typeMap[f.type])
    .map((field) => new ModelOutputField(this.dmmf, field, !this.dmmf.typeMap[field.type]).toTS())
    .join('\n'),
  TAB_SIZE,
)}
}
`
      },
    )
  }
  public toTS(): string {
    const { model, outputType } = this

    const hasRelationField = model.fields.some((f) => f.kind === 'object')
    const includeType = hasRelationField
      ? ts.stringify(
          buildIncludeType({ modelName: this.model.name, dmmf: this.dmmf, fields: this.outputType.fields }),
          {
            newLine: 'both',
          },
        )
      : ''

    return `
/**
 * Model ${model.name}
 */

${!this.dmmf.typeMap[model.name] ? this.getAggregationTypes() : ''}

${!this.dmmf.typeMap[model.name] ? this.getGroupByTypes() : ''}

${ts.stringify(buildSelectType({ modelName: this.model.name, fields: this.outputType.fields }))}
${ifExtensions(() => {
  return ts.stringify(buildScalarSelectType({ modelName: this.model.name, fields: this.outputType.fields }), {
    newLine: 'leading',
  })
}, '')}
${includeType}
${ifExtensions(
  `type ${model.name}GetPayload<S extends boolean | null | undefined | ${getArgName(
    model.name,
  )}> = runtime.Types.GetFindResult<${model.name}Payload, S>`,
  new PayloadType(this.outputType, this.dmmf).toTS(),
)}

${new ModelDelegate(this.outputType, this.dmmf, this.generator).toTS()}

${new ModelFieldRefs(this.generator, this.outputType).toTS()}

// Custom InputTypes
${this.argsTypes.map((gen) => TS(gen)).join('\n')}
`
  }
}
export class ModelDelegate implements Generatable {
  constructor(
    protected readonly outputType: OutputType,
    protected readonly dmmf: DMMFHelper,
    protected readonly generator?: GeneratorConfig,
  ) {}

  /**
   * Returns all available non-aggregate or group actions
   * Includes both dmmf and client-only actions
   *
   * @param availableActions
   * @returns
   */
  private getNonAggregateActions(availableActions: DMMF.ModelAction[]): DMMF.ModelAction[] {
    const actions = availableActions.filter((key) => key !== 'aggregate' && key !== 'groupBy' && key !== 'count')

    return actions
  }

  public toTS(): string {
    const { fields, name } = this.outputType

    const mapping = this.dmmf.mappingsMap[name] ?? { model: name, plural: `${name}s` }
    const modelOrType = this.dmmf.typeAndModelMap[name]

    const availableActions = getModelActions(this.dmmf, name)
    const nonAggregateActions = this.getNonAggregateActions(availableActions)
    const groupByArgsName = getGroupByArgsName(name)
    const countArgsName = getModelArgName(name, DMMF.ModelAction.count)

    let fieldsProxy = ''
    if (this.generator?.previewFeatures.includes('fieldReference')) {
      fieldsProxy = `
  /**
   * Fields of the ${name} model
   */
  readonly fields: ${getFieldRefsTypeName(name)};
`
    }
    return `\
${
  availableActions.includes(DMMF.ModelAction.aggregate)
    ? `type ${countArgsName}${ifExtensions(
        '<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs>',
        '',
      )} = 
  Omit<${getModelArgName(name, DMMF.ModelAction.findMany)}, 'select' | 'include'> & {
    select?: ${getCountAggregateInputName(name)} | true
  }
`
    : ''
}
export interface ${name}Delegate<GlobalRejectSettings extends Prisma.RejectOnNotFound | Prisma.RejectPerOperation | false | undefined${ifExtensions(
      ', ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs',
      '',
    )}> {
${ifExtensions(
  `${indent(
    `[K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['${name}'], meta: { name: '${name}' } }`,
    TAB_SIZE,
  )}`,
  '',
)}
${indent(
  nonAggregateActions
    .map(
      (actionName): string =>
        `${getMethodJSDoc(actionName, mapping, modelOrType)}
${actionName}${getGenericMethod(name, actionName)}(
  ${getArgs(name, actionName)}
): ${getReturnType({ name, actionName, projection: Projection.select })}`,
    )
    .join('\n\n'),
  TAB_SIZE,
)}

${
  availableActions.includes(DMMF.ModelAction.aggregate)
    ? `${indent(getMethodJSDoc(DMMF.ModelAction.count, mapping, modelOrType), TAB_SIZE)}
  count<T extends ${countArgsName}>(
    args?: Subset<T, ${countArgsName}>,
  ): Prisma.PrismaPromise<
    T extends _Record<'select', any>
      ? T['select'] extends true
        ? number
        : GetScalarType<T['select'], ${getCountAggregateOutputName(name)}>
      : number
  >
`
    : ''
}
${
  availableActions.includes(DMMF.ModelAction.aggregate)
    ? `${indent(getMethodJSDoc(DMMF.ModelAction.aggregate, mapping, modelOrType), TAB_SIZE)}
  aggregate<T extends ${getAggregateArgsName(name)}>(args: Subset<T, ${getAggregateArgsName(
        name,
      )}>): Prisma.PrismaPromise<${getAggregateGetName(name)}<T>>
`
    : ''
}
${
  availableActions.includes(DMMF.ModelAction.groupBy)
    ? `${indent(getMethodJSDoc(DMMF.ModelAction.groupBy, mapping, modelOrType), TAB_SIZE)}
  groupBy<
    T extends ${groupByArgsName},
    HasSelectOrTake extends Or<
      Extends<'skip', Keys<T>>,
      Extends<'take', Keys<T>>
    >,
    OrderByArg extends True extends HasSelectOrTake
      ? { orderBy: ${groupByArgsName}['orderBy'] }
      : { orderBy?: ${groupByArgsName}['orderBy'] },
    OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
    ByFields extends TupleToUnion<T['by']>,
    ByValid extends Has<ByFields, OrderFields>,
    HavingFields extends GetHavingFields<T['having']>,
    HavingValid extends Has<ByFields, HavingFields>,
    ByEmpty extends T['by'] extends never[] ? True : False,
    InputErrors extends ByEmpty extends True
    ? \`Error: "by" must not be empty.\`
    : HavingValid extends False
    ? {
        [P in HavingFields]: P extends ByFields
          ? never
          : P extends string
          ? \`Error: Field "$\{P}" used in "having" needs to be provided in "by".\`
          : [
              Error,
              'Field ',
              P,
              \` in "having" needs to be provided in "by"\`,
            ]
      }[HavingFields]
    : 'take' extends Keys<T>
    ? 'orderBy' extends Keys<T>
      ? ByValid extends True
        ? {}
        : {
            [P in OrderFields]: P extends ByFields
              ? never
              : \`Error: Field "$\{P}" in "orderBy" needs to be provided in "by"\`
          }[OrderFields]
      : 'Error: If you provide "take", you also need to provide "orderBy"'
    : 'skip' extends Keys<T>
    ? 'orderBy' extends Keys<T>
      ? ByValid extends True
        ? {}
        : {
            [P in OrderFields]: P extends ByFields
              ? never
              : \`Error: Field "$\{P}" in "orderBy" needs to be provided in "by"\`
          }[OrderFields]
      : 'Error: If you provide "skip", you also need to provide "orderBy"'
    : ByValid extends True
    ? {}
    : {
        [P in OrderFields]: P extends ByFields
          ? never
          : \`Error: Field "$\{P}" in "orderBy" needs to be provided in "by"\`
      }[OrderFields]
  >(args: SubsetIntersection<T, ${groupByArgsName}, OrderByArg> & InputErrors): {} extends InputErrors ? ${getGroupByPayloadName(
        name,
      )}<T> : Prisma.PrismaPromise<InputErrors>`
    : ''
}
${fieldsProxy}
}

/**
 * The delegate class that acts as a "Promise-like" for ${name}.
 * Why is this prefixed with \`Prisma__\`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export class Prisma__${name}Client<T, Null = never${ifExtensions(
      ', ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs',
      '',
    )}> implements Prisma.PrismaPromise<T> {
  private readonly _dmmf;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  readonly [Symbol.toStringTag]: 'PrismaPromise';
  constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
${indent(
  fields
    .filter((f) => f.outputType.location === 'outputObjectTypes' && f.name !== '_count')
    .map((f) => {
      const fieldTypeName = (f.outputType.type as DMMF.OutputType).name
      return `
${f.name}<T extends ${getFieldArgName(f, name)}${ifExtensions(
        '<ExtArgs> = {}',
        '= {}',
      )}>(args?: Subset<T, ${getFieldArgName(f, name)}${ifExtensions('<ExtArgs>', '')}>): ${getReturnType({
        name: fieldTypeName,
        actionName: f.outputType.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findUnique,
        hideCondition: false,
        isField: true,
        renderPromise: true,
        fieldName: f.name,
        isChaining: true,
        projection: Projection.select,
      })};`
    })
    .join('\n'),
  2,
)}

  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}`
  }
}
