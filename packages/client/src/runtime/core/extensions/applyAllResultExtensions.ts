import { dmmfToJSModelName } from '../model/utils/dmmfToJSModelName'
import { RuntimeDataModel } from '../runtimeDataModel'
import { JsArgs } from '../types/JsApi'
import { applyResultExtensions } from './applyResultExtensions'
import { MergedExtensionsList } from './MergedExtensionsList'
import { visitQueryResult } from './visitQueryResult'

type ApplyAllResultExtensionsParams = {
  result: object | null
  modelName: string
  args: JsArgs
  extensions: MergedExtensionsList
  runtimeDataModel: RuntimeDataModel
}

/**
 * Walks the result of the query and applies all possible result extensions
 * to all parts of it, including nested relations
 */
export function applyAllResultExtensions({
  result,
  modelName,
  args,
  extensions,
  runtimeDataModel,
}: ApplyAllResultExtensionsParams) {
  if (extensions.isEmpty() || result == null) {
    return result
  }
  const model = runtimeDataModel.models[modelName]
  if (!model) {
    return result
  }
  return visitQueryResult({
    result,
    args: args ?? {},
    modelName,
    runtimeDataModel,
    visitor: (value, dmmfModelName, args) =>
      applyResultExtensions({
        result: value,
        modelName: dmmfToJSModelName(dmmfModelName),
        select: args.select,
        extensions,
      }),
  })
}
