import { InputField } from './../TSClient'
import { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'
import { DMMFClass } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import {
  getFieldArgName,
  getIncludeName,
  getModelArgName,
  getSelectName,
  getSelectReturnType,
  Projection,
  getAggregateName,
  getAvgAggregateName,
  getSumAggregateName,
  getMinAggregateName,
  getMaxAggregateName,
  getAggregateArgsName,
  getAggregateGetName,
  getAggregateScalarGetName,
  getAggregateInputType,
  getGroupByArgsName,
  getGroupByName,
  getCountAggregateName,
  getGroupByPayloadName,
} from '../utils'
import { ArgsType, MinimalArgsType } from './Args'
import { Generatable, TS } from './Generatable'
import { ExportCollector, getArgFieldJSDoc, getArgs, getGenericMethod, getMethodJSDoc } from './helpers'
import { InputType } from './Input'
import { ModelOutputField, OutputType } from './Output'
import { SchemaOutputType } from './SchemaOutput'
import { TAB_SIZE } from './constants'
import { PayloadType } from './Payload'
import { klona } from 'klona'

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
      if (action === 'updateMany' || action === 'deleteMany') {
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
            )}`
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
    )}<T extends ${groupByArgsName}> = Promise<
  PickArray<${groupByType.name}, T['by']> & {
    [P in ((keyof T) & (keyof ${groupByType.name}))]: GetScalarType<T[P], ${
      groupByType.name
    }[P]>
  }
>
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

    const countFieldIndex = aggregateType.fields.findIndex(
      (f) => f.name === 'count',
    )

    aggregateType.fields[countFieldIndex] = {
      name: 'count',
      args: [],
      isRequired: false,
      isNullable: true,
      outputType: {
        isList: false,
        location: 'scalar',
        type: 'Int',
      },
    }

    const aggregateTypes = [aggregateType]

    const avgType = this.dmmf.outputTypeMap[getAvgAggregateName(model.name)]
    const sumType = this.dmmf.outputTypeMap[getSumAggregateName(model.name)]
    const minType = this.dmmf.outputTypeMap[getMinAggregateName(model.name)]
    const maxType = this.dmmf.outputTypeMap[getMaxAggregateName(model.name)]
    const countType = this.dmmf.outputTypeMap[getCountAggregateName(model.name)]

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
        if (f.name === 'count') {
          return `${f.name}?: true`
        }
        return `${f.name}?: ${getAggregateInputType(
          (f.outputType.type as DMMF.OutputType).name,
        )}`
      }),
    )
    .join('\n'),
  TAB_SIZE,
)}
}

export type ${getAggregateGetName(model.name)}<T extends ${getAggregateArgsName(
      model.name,
    )}> = {
  [P in keyof T]: P extends 'count' ? number : ${
    avgType ? `${getAggregateScalarGetName(model.name)}<T[P]>` : 'never'
  }
}

${
  avgType
    ? `export type ${getAggregateScalarGetName(model.name)}<T extends any> = {
  [P in keyof T]: P extends keyof ${getAvgAggregateName(
    model.name,
  )} ? ${getAvgAggregateName(model.name)}[P] : never
}`
    : ''
}

    `
  }
  public toTSWithoutNamespace(): string {
    const { model } = this
    return `/**
 * Model ${model.name}
 */

export type ${model.name} = {
${indent(
  model.fields
    .filter((f) => f.kind !== 'object')
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

    // TODO: handle findUnique
    mapping['findOne'] = mapping['findUnique']

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
    return `\
export interface ${name}Delegate {
${indent(
  actions
    .map(
      ([actionName]: [any, any]): string =>
        `${getMethodJSDoc(actionName, mapping, model)}
${actionName}${getGenericMethod(name, actionName)}(
  ${getArgs(name, actionName)}
): ${getSelectReturnType({ name, actionName, projection: Projection.select })}`,
    )
    .join('\n'),
  TAB_SIZE,
)}
  ${getMethodJSDoc(DMMF.ModelAction.count, mapping, model)}
  count(args?: Omit<${getModelArgName(
    name,
    DMMF.ModelAction.findMany,
  )}, 'select' | 'include'>): Promise<number>

  ${
    groupByEnabled
      ? `  
  ${getMethodJSDoc(DMMF.ModelAction.groupBy, mapping, model)}
  groupBy<T extends ${getGroupByArgsName(
    name,
  )}>(args: Subset<T, ${getGroupByArgsName(
          name,
        )}>): Promise<${getGroupByPayloadName(name)}<T>>`
      : ``
  }

  ${getMethodJSDoc(DMMF.ModelAction.aggregate, mapping, model)}
  aggregate<T extends ${getAggregateArgsName(
    name,
  )}>(args: Subset<T, ${getAggregateArgsName(
      name,
    )}>): Promise<${getAggregateGetName(name)}<T>>
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
