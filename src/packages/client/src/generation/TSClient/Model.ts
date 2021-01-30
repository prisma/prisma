import { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'
import { klona } from 'klona'
import { DMMFClass } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import {
  getAggregateArgsName,
  getAggregateGetName,
  getAggregateInputType,
  getAggregateName,
  getAvgAggregateName,
  getCountAggregateInputName,
  getCountAggregateOutputName,
  getFieldArgName,
  getGroupByArgsName,
  getGroupByName,
  getGroupByPayloadName,
  getIncludeName,
  getMaxAggregateName,
  getMinAggregateName,
  getModelArgName,
  getSelectName,
  getSelectReturnType,
  getSumAggregateName,
  Projection,
} from '../utils'
import { InputField } from './../TSClient'
import { ArgsType, MinimalArgsType } from './Args'
import { TAB_SIZE } from './constants'
import { Generatable, TS } from './Generatable'
import {
  ExportCollector,
  getArgFieldJSDoc,
  getArgs,
  getGenericMethod,
  getMethodJSDoc,
  wrapComment,
} from './helpers'
import { InputType } from './Input'
import { ModelOutputField, OutputType } from './Output'
import { PayloadType } from './Payload'
import { SchemaOutputType } from './SchemaOutput'

export class Model implements Generatable {
  protected outputType?: OutputType
  protected mapping?: DMMF.ModelMapping
  constructor(
    protected readonly model: DMMF.Model,
    protected readonly dmmf: DMMFClass,
    protected readonly generator?: GeneratorConfig,
    protected readonly collector?: ExportCollector,
  ) {
    const outputType = dmmf.outputTypeMap[model.name]
    this.outputType = new OutputType(dmmf, outputType)
    this.mapping = dmmf.mappings.modelOperations.find(
      (m) => m.model === model.name,
    )!
  }
  protected get argsTypes(): Generatable[] {
    const { mapping, model } = this
    if (!mapping) {
      return []
    }

    const argsTypes: Generatable[] = []
    for (const action in DMMF.ModelAction) {
      const fieldName = mapping[action]
      if (!fieldName) {
        continue
      }
      const field = this.dmmf.rootFieldMap[fieldName]
      if (!field) {
        throw new Error(
          `Oops this must not happen. Could not find field ${fieldName} on either Query or Mutation`,
        )
      }
      if (
        action === 'updateMany' ||
        action === 'deleteMany' ||
        action === 'createMany'
      ) {
        argsTypes.push(
          new MinimalArgsType(
            field.args,
            model,
            action as DMMF.ModelAction,
            this.collector,
          ),
        )
      } else if (action !== 'groupBy' && action !== 'aggregate') {
        argsTypes.push(
          new ArgsType(
            field.args,
            model,
            action as DMMF.ModelAction,
            this.collector,
          ),
        )
      }
    }

    argsTypes.push(new ArgsType([], model))

    return argsTypes
  }
  private getGroupByTypes() {
    const { model, mapping } = this

    const groupByType = this.dmmf.outputTypeMap[getGroupByName(model.name)]
    if (!groupByType) {
      throw new Error(`Could not get group by type for model ${model.name}`)
    }

    const groupByRootField = this.dmmf.rootFieldMap[mapping!.groupBy!]
    if (!groupByRootField) {
      throw new Error(
        `Could not find groupBy root field for model ${model.name}. Mapping: ${mapping?.groupBy}`,
      )
    }

    const groupByArgsName = getGroupByArgsName(model.name)

    return `
    
    
export type ${groupByArgsName} = {
${indent(
  groupByRootField.args
    .map((arg) => {
      arg.comment = getArgFieldJSDoc(model, DMMF.ModelAction.groupBy, arg)
      return new InputField(arg, false, arg.name === 'by').toTS()
    })
    .concat(
      groupByType.fields
        .filter((f) => f.outputType.location === 'outputObjectTypes')
        .map((f) => {
          if (f.outputType.location === 'outputObjectTypes') {
            return `${f.name}?: ${getAggregateInputType(
              (f.outputType.type as DMMF.OutputType).name,
            )}${f.name === 'count' ? ' | true' : ''}`
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

type ${getGroupByPayloadName(
      model.name,
    )}<T extends ${groupByArgsName}> = Promise<Array<
  PickArray<${groupByType.name}, T['by']> & {
    [P in ((keyof T) & (keyof ${groupByType.name}))]: GetScalarType<T[P], ${
      groupByType.name
    }[P]>
  }
>>
    `
  }
  private getAggregationTypes() {
    const { model, mapping } = this
    let aggregateType = this.dmmf.outputTypeMap[getAggregateName(model.name)]
    if (!aggregateType) {
      throw new Error(
        `Could not get aggregate type "${getAggregateName(model.name)}" for "${
          model.name
        }"`,
      )
    }
    aggregateType = klona(aggregateType)

    const aggregateRootField = this.dmmf.rootFieldMap[mapping!.aggregate!]
    if (!aggregateRootField) {
      throw new Error(
        `Could not find aggregate root field for model ${model.name}. Mapping: ${mapping?.aggregate}`,
      )
    }

    const aggregateTypes = [aggregateType]

    const avgType = this.dmmf.outputTypeMap[getAvgAggregateName(model.name)]
    const sumType = this.dmmf.outputTypeMap[getSumAggregateName(model.name)]
    const minType = this.dmmf.outputTypeMap[getMinAggregateName(model.name)]
    const maxType = this.dmmf.outputTypeMap[getMaxAggregateName(model.name)]
    const countType = this.dmmf.outputTypeMap[
      getCountAggregateOutputName(model.name)
    ]

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

    for (const aggregateType of aggregateTypes) {
      this.collector?.addSymbol(aggregateType.name)
    }

    const aggregateArgsName = getAggregateArgsName(model.name)

    const aggregateName = getAggregateName(model.name)

    this.collector?.addSymbol(aggregateArgsName)

    return `${aggregateTypes
      .map((type) => new SchemaOutputType(type, this.collector).toTS())
      .join('\n')}

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
          return new InputType(newType, this.collector).toTS()
        })
        .join('\n')
    : ''
}

export type ${aggregateArgsName} = {
${indent(
  aggregateRootField.args
    .map((arg) => {
      arg.comment = getArgFieldJSDoc(model, DMMF.ModelAction.aggregate, arg)
      return new InputField(arg).toTS()
    })
    .concat(
      aggregateType.fields.map((f) => {
        let data = ''
        const comment = getArgFieldJSDoc(
          model,
          DMMF.ModelAction.aggregate,
          f.name,
        )
        data += comment ? wrapComment(comment) + '\n' : ''
        if (f.name === 'count') {
          data += `${f.name}?: true | ${getCountAggregateInputName(model.name)}`
        } else {
          data += `${f.name}?: ${getAggregateInputType(
            (f.outputType.type as DMMF.OutputType).name,
          )}`
        }
        return data
      }),
    )
    .join('\n'),
  TAB_SIZE,
)}
}

export type ${getAggregateGetName(model.name)}<T extends ${getAggregateArgsName(
      model.name,
    )}> = {
  [P in keyof T & keyof ${aggregateName}]: P extends 'count'
    ? T[P] extends true
      ? number
      : GetScalarType<T[P], ${aggregateName}[P]>
    : GetScalarType<T[P], ${aggregateName}[P]>
}`
  }
  public toTSWithoutNamespace(): string {
    const { model } = this
    return `/**
 * Model ${model.name}
 */

export type ${model.name} = {
${indent(
  model.fields
    .filter((f) => f.kind !== 'object' && f.kind !== 'unsupported')
    .map((field) => new ModelOutputField(this.dmmf, field, true).toTS())
    .join('\n'),
  TAB_SIZE,
)}
}
`
  }
  public toTS(): string {
    const { model, outputType } = this

    if (!outputType) {
      return ''
    }

    const hasRelationField = model.fields.some((f) => f.kind === 'object')
    const groupByEnabled = (this.generator?.previewFeatures ?? []).includes(
      'groupBy',
    )

    const includeType = hasRelationField
      ? `\nexport type ${getIncludeName(model.name)} = {
${indent(
  outputType.fields
    .filter((f) => f.outputType.location === 'outputObjectTypes')
    .map(
      (f) =>
        `${f.name}?: boolean` +
        (f.outputType.location === 'outputObjectTypes'
          ? ` | ${getFieldArgName(f)}`
          : ''),
    )
    .join('\n'),
  TAB_SIZE,
)}
}\n`
      : ''

    return `
/**
 * Model ${model.name}
 */

${this.getAggregationTypes()}

${groupByEnabled ? this.getGroupByTypes() : ''}

export type ${getSelectName(model.name)} = {
${indent(
  outputType.fields
    .map(
      (f) =>
        `${f.name}?: boolean` +
        (f.outputType.location === 'outputObjectTypes'
          ? ` | ${getFieldArgName(f)}`
          : ''),
    )
    .join('\n'),
  TAB_SIZE,
)}
}
${includeType}
${new PayloadType(this.outputType!).toTS()}

${new ModelDelegate(this.outputType!, this.dmmf, this.generator).toTS()}

// Custom InputTypes
${this.argsTypes.map(TS).join('\n')}
`
  }
}
export class ModelDelegate implements Generatable {
  constructor(
    protected readonly outputType: OutputType,
    protected readonly dmmf: DMMFClass,
    protected readonly generator?: GeneratorConfig,
  ) {}
  public toTS(): string {
    const { fields, name } = this.outputType
    const mapping = this.dmmf.mappingsMap[name]
    if (!mapping) {
      return ''
    }
    const model = this.dmmf.modelMap[name]

    const actions = Object.entries(mapping).filter(
      ([key, value]) =>
        key !== 'model' &&
        key !== 'plural' &&
        key !== 'aggregate' &&
        key !== 'groupBy' &&
        value,
    )
    const previewFeatures = this.generator?.previewFeatures ?? []
    const groupByEnabled = previewFeatures.includes('groupBy')
    const groupByArgsName = getGroupByArgsName(name)
    const countArgsName = getModelArgName(name, DMMF.ModelAction.count)
    return `\
type ${countArgsName} = Merge<
  Omit<${getModelArgName(
    name,
    DMMF.ModelAction.findMany,
  )}, 'select' | 'include'> & {
    select?: ${getCountAggregateInputName(name)} | true
  }
>

export interface ${name}Delegate<GlobalRejectSettings> {
${indent(
  actions
    .map(
      ([actionName]: [any, any]): string =>
        `${getMethodJSDoc(actionName, mapping, model)}
${actionName}${getGenericMethod(name, actionName)}(
  ${getArgs(name, actionName)}
): ${getSelectReturnType({ name, actionName, projection: Projection.select })}`,
    )
    .join('\n\n'),
  TAB_SIZE,
)}

${indent(getMethodJSDoc(DMMF.ModelAction.count, mapping, model), TAB_SIZE)}
  count<T extends ${countArgsName}>(
    args?: Subset<T, ${countArgsName}>,
  ): Promise<
    T extends Record<'select', any>
      ? T['select'] extends true
        ? number
        : GetScalarType<T['select'], ${getCountAggregateOutputName(name)}>
      : number
  >

${indent(getMethodJSDoc(DMMF.ModelAction.aggregate, mapping, model), TAB_SIZE)}
  aggregate<T extends ${getAggregateArgsName(
    name,
  )}>(args: Subset<T, ${getAggregateArgsName(
      name,
    )}>): Promise<${getAggregateGetName(name)}<T>>

${
  groupByEnabled
    ? `${indent(
        getMethodJSDoc(DMMF.ModelAction.groupBy, mapping, model),
        TAB_SIZE,
      )}
  groupBy<
    T extends ${groupByArgsName},
    HasSelectOrTake extends Or<
      Extends<'skip', Keys<T>>,
      Extends<'take', Keys<T>>
    >,
    OrderByArg extends True extends HasSelectOrTake
      ? { orderBy: ${groupByArgsName}['orderBy'] }
      : { orderBy?: ${groupByArgsName}['orderBy'] },
    OrderFields extends Keys<MaybeTupleToUnion<T['orderBy']>>,
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
      )}<T> : Promise<InputErrors>`
    : ``
}
}

/**
 * The delegate class that acts as a "Promise-like" for ${name}.
 * Why is this prefixed with \`Prisma__\`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export class Prisma__${name}Client<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
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
  constructor(_dmmf: runtime.DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';
${indent(
  fields
    .filter((f) => f.outputType.location === 'outputObjectTypes')
    .map((f) => {
      const fieldTypeName = (f.outputType.type as DMMF.OutputType).name
      return `
${f.name}<T extends ${getFieldArgName(
        f,
      )} = {}>(args?: Subset<T, ${getFieldArgName(f)}>): ${getSelectReturnType({
        name: fieldTypeName,
        actionName: f.outputType.isList
          ? DMMF.ModelAction.findMany
          : DMMF.ModelAction.findUnique,
        hideCondition: false,
        isField: true,
        renderPromise: true,
        fieldName: f.name,
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
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
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
