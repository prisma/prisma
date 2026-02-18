import { RuntimeDataModel } from '@prisma/client-common'

import { JsArgs } from '../types/exported/JsApi'

type ResolveResultExtensionContextParams = {
  dataPath: string[]
  modelName: string
  args?: JsArgs
  runtimeDataModel: RuntimeDataModel
}

type ResultExtensionContext = {
  modelName: string
  args: JsArgs
}

export function resolveResultExtensionContext({
  dataPath,
  modelName,
  args,
  runtimeDataModel,
}: ResolveResultExtensionContextParams): ResultExtensionContext {
  const rootContext = {
    modelName,
    args: args ?? {},
  }

  const relationPath = dataPath.filter((segment) => segment !== 'select' && segment !== 'include')
  if (relationPath.length === 0) {
    return rootContext
  }

  let currentModelName = modelName
  let currentArgs: JsArgs = args ?? {}

  for (const relationFieldName of relationPath) {
    const currentModel = runtimeDataModel.models[currentModelName]
    if (!currentModel) {
      return rootContext
    }

    const relationField = currentModel.fields.find((field) => field.name === relationFieldName)
    if (!relationField || relationField.kind !== 'object' || !relationField.relationName) {
      return rootContext
    }

    currentModelName = relationField.type
    currentArgs = resolveNextArgs(currentArgs, relationFieldName)
  }

  return {
    modelName: currentModelName,
    args: currentArgs,
  }
}

function resolveNextArgs(args: JsArgs, relationFieldName: string): JsArgs {
  const selectArgs = asNestedArgs(args.select?.[relationFieldName])
  if (selectArgs) {
    return selectArgs
  }

  const includeArgs = asNestedArgs(args.include?.[relationFieldName])
  if (includeArgs) {
    return includeArgs
  }

  return {}
}

function asNestedArgs(value: unknown): JsArgs | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsArgs
  }

  return undefined
}
