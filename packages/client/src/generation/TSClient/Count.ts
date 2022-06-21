import type { GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'

import type { DMMFHelper } from '../../runtime/dmmf'
import { DMMF } from '../../runtime/dmmf-types'
import {
  getAggregateArgsName,
  getAggregateGetName,
  getCountAggregateInputName,
  getCountAggregateOutputName,
  getFieldArgName,
  getGroupByArgsName,
  getGroupByPayloadName,
  getModelArgName,
  getReturnType,
  getSelectName,
  Projection,
} from '../utils'
import { ArgsType } from './Args'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { TS } from './Generatable'
import type { ExportCollector } from './helpers'
import { getArgs, getGenericMethod, getMethodJSDoc } from './helpers'
import { OutputType } from './Output'
import { PayloadType } from './Payload'

export class Count implements Generatable {
  constructor(
    protected readonly type: DMMF.OutputType,
    protected readonly dmmf: DMMFHelper,
    protected readonly generator?: GeneratorConfig,
    protected readonly collector?: ExportCollector,
  ) {}
  protected get argsTypes(): Generatable[] {
    const argsTypes: Generatable[] = []

    argsTypes.push(new ArgsType([], this.type))

    return argsTypes
  }
  public toTS(): string {
    const { type } = this
    const { name } = type

    const outputType = new OutputType(this.dmmf, this.type)

    return `
/**
 * Count Type ${name}
 */

${outputType.toTS()}

export type ${getSelectName(name)} = {
${indent(
  type.fields
    .map(
      (f) => `${f.name}?: boolean` + (f.outputType.location === 'outputObjectTypes' ? ` | ${getFieldArgName(f)}` : ''),
    )
    .join('\n'),
  TAB_SIZE,
)}
}

${new PayloadType(outputType, false).toTS()}

${/*new CountDelegate(outputType, this.dmmf, this.generator).toTS()*/ ''}

// Custom InputTypes
${this.argsTypes.map((gen) => TS(gen)).join('\n')}
`
  }
}

class CountDelegate implements Generatable {
  constructor(
    protected readonly outputType: OutputType,
    protected readonly dmmf: DMMFHelper,
    protected readonly generator?: GeneratorConfig,
  ) {}
  public toTS(): string {
    const { fields, name } = this.outputType
    const mapping = this.dmmf.mappingsMap[name]
    if (!mapping) {
      return ''
    }
    const modelOrType = this.dmmf.typeAndModelMap[name]

    const actions = Object.entries(mapping).filter(
      ([key, value]) => key !== 'model' && key !== 'plural' && key !== 'aggregate' && key !== 'groupBy' && value,
    )
    const groupByArgsName = getGroupByArgsName(name)
    const countArgsName = getModelArgName(name, DMMF.ModelAction.count)
    return `\
type ${countArgsName} = Merge<
  Omit<${getModelArgName(name, DMMF.ModelAction.findMany)}, 'select' | 'include'> & {
    select?: ${getCountAggregateInputName(name)} | true
  }
>

export interface ${name}Delegate<GlobalRejectSettings> {
${indent(
  actions
    .map(
      ([actionName]: [any, any]): string =>
        `${getMethodJSDoc(actionName, mapping, modelOrType)}
${actionName}${getGenericMethod(name, actionName)}(
  ${getArgs(name, actionName)}
): ${getReturnType({ name, actionName, projection: Projection.select })}`,
    )
    .join('\n\n'),
  TAB_SIZE,
)}

${indent(getMethodJSDoc(DMMF.ModelAction.count, mapping, modelOrType), TAB_SIZE)}
  count<T extends ${countArgsName}>(
    args?: Subset<T, ${countArgsName}>,
  ): PrismaPromise<
    T extends _Record<'select', any>
      ? T['select'] extends true
        ? number
        : GetScalarType<T['select'], ${getCountAggregateOutputName(name)}>
      : number
  >

${indent(getMethodJSDoc(DMMF.ModelAction.aggregate, mapping, modelOrType), TAB_SIZE)}
  aggregate<T extends ${getAggregateArgsName(name)}>(args: Subset<T, ${getAggregateArgsName(
      name,
    )}>): PrismaPromise<${getAggregateGetName(name)}<T>>

${indent(getMethodJSDoc(DMMF.ModelAction.groupBy, mapping, modelOrType), TAB_SIZE)}
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
    )}<T> : Promise<InputErrors>
}

/**
 * The delegate class that acts as a "Promise-like" for ${name}.
 * Why is this prefixed with \`Prisma__\`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export class Prisma__${name}Client<T> implements PrismaPromise<T> {
  [prisma]: true;
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
${f.name}<T extends ${getFieldArgName(f)}>(args?: Subset<T, ${getFieldArgName(f)}>): ${getReturnType({
        name: fieldTypeName,
        actionName: f.outputType.isList ? DMMF.ModelAction.findMany : DMMF.ModelAction.findUnique,
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
