import indent from 'indent-string'

import { DMMFHelper } from '../../runtime/dmmf'
import { lowerCase } from '../../runtime/utils/common'
import { getModelArgName } from '../utils'
import { getModelActions } from './utils/getModelActions'
import { ifExtensions } from './utils/ifExtensions'

type GetNeedsValueType = (modelName: string) => string

const defaultGetNeedsValueType: GetNeedsValueType = (modelName) =>
  `runtime.Types.Extensions.GetResultSelect<Prisma.${modelName}SelectScalar, ExtArgs['result']['${lowerCase(
    modelName,
  )}']>`

export class ExtensionGenericParam {
  constructor(
    public name: string,
    public extendedType?: (getNeedsValueType: GetNeedsValueType) => string,
    public defaultType?: string,
  ) {}

  stringify(getModelResult: GetNeedsValueType) {
    const parts = [this.name]
    if (this.extendedType) {
      parts.push(`extends ${this.extendedType(getModelResult)}`)
    }
    if (this.defaultType) {
      parts.push(`= ${this.defaultType}`)
    }
    return parts.join(' ')
  }
}

function clientExtensionsGenericResultParams(dmmf: DMMFHelper) {
  const modelNames = Object.keys(dmmf.getModelMap())

  const resultGenericParams = (modelName: string) => {
    return new ExtensionGenericParam(
      `R_${modelName}_Needs`,
      (getNeedsValueType) => `Record<string, ${getNeedsValueType(modelName)}>`,
    )
  }

  return [
    ...modelNames.map(resultGenericParams),
    new ExtensionGenericParam('R', () => "runtime.Types.Extensions.Args['result']", '{}'),
  ]
}

function clientExtensionsResultDefinition(dmmf: DMMFHelper) {
  const modelNames = Object.keys(dmmf.getModelMap())

  const resultParam = (modelName: string) => {
    return `${lowerCase(modelName)}?: {
        [K in keyof R_${modelName}_Needs]: {
          needs: R_${modelName}_Needs[K]
          compute: (data: Prisma.${modelName}GetPayload<{ select: R_${modelName}_Needs[K] }, ExtArgs>) => unknown
        }
      }`
  }

  return `{
      $allModels?: Record<string, {
        compute: (data: unknown) => unknown
      }>
      ${modelNames.map(resultParam).join('\n      ')}
    }`
}

function clientExtensionsGenericModelParams() {
  return [new ExtensionGenericParam('M', () => "runtime.Types.Extensions.Args['model']", '{}')]
}

function clientExtensionsModelDefinition(dmmf: DMMFHelper) {
  const modelNames = Object.keys(dmmf.getModelMap())

  const modelParam = (modelName: string) => {
    return `${lowerCase(modelName)}?: { [K: symbol]: PrismaClient<never, never, false, ExtArgs>['${lowerCase(
      modelName,
    )}'] }`
  }

  return `{
      $allModels?: Record<string, unknown>
      ${modelNames.map(modelParam).join('\n      ')}
    }`
}

function clientExtensionsGenericQueryParams() {
  return [new ExtensionGenericParam('Q', () => "runtime.Types.Extensions.Args['query']", '{}')]
}

function queryExtensionsArgsTypeDefinition(dmmf: DMMFHelper) {
  const modelNames = Object.keys(dmmf.getModelMap())

  return `export type QueryExtensionArgs<ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs> = {${modelNames.reduce(
    (acc, modelName) => {
      const actions = getModelActions(dmmf, modelName)

      return `${acc}
  ${lowerCase(modelName)}: {${actions.reduce((acc, action) => {
        return `${acc}
    ${action}: {
      args: { model: '${modelName}', operation: '${action}', args: Prisma.${getModelArgName(
          modelName,
          action,
        )}<ExtArgs>, data: PrismaPromise<runtime.Types.Utils.OptionalFlat<${modelName}>> },
      result: Promise<runtime.Types.Utils.OptionalFlat<${modelName}>>
    }`
      }, '')}
  }`
    },
    '',
  )}
}`
}

function clientExtensionsQueryDefinition(dmmf: DMMFHelper) {
  const modelNames = Object.keys(dmmf.getModelMap())

  const allOperationsSubParam = (modelNames: string[], indent: string) => {
    return `{
    ${indent}$allOperations?: {${modelNames.reduce((acc, modelName) => {
      const actions = getModelActions(dmmf, modelName)
      return `${acc}${actions.reduce((acc, action) => {
        return `${acc}
      ${indent}(args: Prisma.QueryExtensionArgs<ExtArgs>['${lowerCase(
          modelName,
        )}']['${action}']['args']): Prisma.QueryExtensionArgs<ExtArgs>['${lowerCase(
          modelName,
        )}']['${action}']['result']`
      }, '')}`
    }, '')}
    ${indent}}
  ${indent}}`
  }

  const allModelsParam = `{
        $allModels?: {${modelNames.reduce((acc, modelName) => {
          const actions = getModelActions(dmmf, modelName)
          return `${acc}${actions.reduce((acc, action) => {
            return `${acc}
          ${action}?(args: Prisma.QueryExtensionArgs<ExtArgs>['${lowerCase(
              modelName,
            )}']['${action}']['args']): Prisma.QueryExtensionArgs<ExtArgs>['${lowerCase(
              modelName,
            )}']['${action}']['result']`
          }, '')}`
        }, '')}
        } & ${allOperationsSubParam(modelNames, '      ')}
      }`

  const concreteModelParam = `{${modelNames.reduce((acc, modelName) => {
    const actions = getModelActions(dmmf, modelName)
    return `${acc}
        ${lowerCase(modelName)}?: {${actions.reduce((acc, action) => {
      return `${acc}
          ${action}?(args: Prisma.QueryExtensionArgs<ExtArgs>['${lowerCase(
        modelName,
      )}']['${action}']['args']): Prisma.QueryExtensionArgs<ExtArgs>['${lowerCase(modelName)}']['${action}']['result']`
    }, '')}
        } & ${allOperationsSubParam([modelName], '      ')}`
  }, '')}
      }`

  return `${allModelsParam} & ${concreteModelParam}`
}

function clientExtensionsClientGenericParams() {
  return [new ExtensionGenericParam(`C`, () => "runtime.Types.Extensions.Args['client']", '{}')]
}

function clientExtensionsClientDefinition() {
  return `Record<\`\$\${string}\`, unknown>`
}

export function getAllExtensionsGenericParams(dmmf: DMMFHelper): ExtensionGenericParam[] {
  const result = clientExtensionsGenericResultParams(dmmf)
  const model = clientExtensionsGenericModelParams()
  const client = clientExtensionsClientGenericParams()
  const query = clientExtensionsGenericQueryParams()

  return [...result, ...model, ...query, ...client]
}

export function stringifyGenericParameters(
  genericParams: ExtensionGenericParam[],
  indentation = 2,
  getModelResult: GetNeedsValueType = defaultGetNeedsValueType,
) {
  return indent(genericParams.map((param) => param.stringify(getModelResult)).join(',\n'), indentation)
}

function extensionConfigTypeDefinition(genericParams: ExtensionGenericParam[], dmmf: DMMFHelper) {
  return ifExtensions(() => {
    const result = clientExtensionsResultDefinition(dmmf)
    const model = clientExtensionsModelDefinition(dmmf)
    const client = clientExtensionsClientDefinition()
    const query = clientExtensionsQueryDefinition(dmmf)

    return `
  /**
   * Extension config, passed to $extends or Prisma.defineExtension
   */
  export type ExtensionConfig<
    ExtArgs extends runtime.Types.Extensions.Args,
${stringifyGenericParameters(genericParams, 4, defaultGetNeedsValueType)},
  > = {
    result?: R & ${result}
    model?: M & ${model}
    query?: ${query}
    client?: C & ${client}
  }
  `
  }, '')
}

export function extensionsPrismaNamespaceTypesDefinition(genericParams: ExtensionGenericParam[], dmmf: DMMFHelper) {
  return ifExtensions(() => {
    const extensionConfigType = extensionConfigTypeDefinition(genericParams, dmmf)
    const queryExtensionArgsType = queryExtensionsArgsTypeDefinition(dmmf)
    const defineExtension = defineExtensionDefinition(genericParams)

    return [extensionConfigType, queryExtensionArgsType, defineExtension].join('\n\n')
  }, '')
}

export function extensionConfigType(currentArgs: string, genericParameters: ExtensionGenericParam[]) {
  return `Prisma.ExtensionConfig<${currentArgs}, ${genericParameters.map((param) => param.name).join(', ')}>`
}

export function defineExtensionDefinition(genericParameters: ExtensionGenericParam[]) {
  return ifExtensions(() => {
    return `
/**
 * Declares the extension without applying it to the client
 */
export function defineExtension<
  Ext extends ${extensionConfigType(
    'runtime.Types.Extensions.DefaultArgs',
    genericParameters,
  )} | ((client: PrismaClient) => PrismaClient<any, any, any, { result: R, model: M, query: Q, client: C }>),
${stringifyGenericParameters(genericParameters, undefined, (modelName) => `Prisma.${modelName}SelectScalar`)},
>(config: Ext): Ext
`
  }, '')
}
