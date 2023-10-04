import { dmmfToJSModelName } from '../model/utils/dmmfToJSModelName'
import { RuntimeDataModel } from '../runtimeDataModel'
import { JsArgs } from '../types/exported/JsApi'
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
  // We return the result directly (not applying result extensions) if
  // - there is no extension to apply
  // - result is `null`
  // - result is not an object (e.g. `.count()`)
  if (extensions.isEmpty() || result == null || typeof result !== 'object') {
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
