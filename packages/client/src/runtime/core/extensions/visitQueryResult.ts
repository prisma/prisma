import { RuntimeDataModel } from '../runtimeDataModel'
import { JsArgs, Selection } from '../types/JsApi'

type ModelVisitor = (value: object, modelName: string, queryArgs: JsArgs) => object | undefined

type VisitParams = {
  result: object
  args: JsArgs
  modelName: string
  runtimeDataModel: RuntimeDataModel
  visitor: ModelVisitor
}

/**
 * Function recursively walks through provided query response using `include` and `select`
 * query parameters and calls `visitor` callback for each model it encounters.
 * `visitor` receives the value of a particular response section, model it corresponds to and
 * the arguments used to query it. If visitor returns any non-undefined value that value will
 * replace corresponding part of the final result.
 *
 * @param params
 * @returns
 */
export function visitQueryResult({ visitor, result, args, runtimeDataModel, modelName }: VisitParams) {
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i++) {
      result[i] = visitQueryResult({
        result: result[i],
        args,
        modelName,
        runtimeDataModel,
        visitor,
      })
    }
    return result
  }
  const visitResult = visitor(result, modelName, args) ?? result
  if (args.include) {
    visitNested({
      includeOrSelect: args.include,
      result: visitResult,
      parentModelName: modelName,
      runtimeDataModel,
      visitor,
    })
  }
  if (args.select) {
    visitNested({
      includeOrSelect: args.select,
      result: visitResult,
      parentModelName: modelName,
      runtimeDataModel,
      visitor,
    })
  }
  return visitResult
}

type VisitNestedParams = {
  includeOrSelect: Selection
  result: object
  parentModelName: string
  runtimeDataModel: RuntimeDataModel
  visitor: ModelVisitor
}

function visitNested({ includeOrSelect, result, parentModelName, runtimeDataModel, visitor }: VisitNestedParams) {
  for (const [fieldName, subConfig] of Object.entries(includeOrSelect)) {
    if (!subConfig || result[fieldName] == null) {
      continue
    }
    const parentModel = runtimeDataModel.models[parentModelName]
    const field = parentModel.fields.find((field) => field.name === fieldName)
    if (!field || field.kind !== 'object' || !field.relationName) {
      continue
    }
    const args = typeof subConfig === 'object' ? subConfig : {}
    result[fieldName] = visitQueryResult({
      visitor,
      result: result[fieldName],
      args,
      modelName: field.type,
      runtimeDataModel,
    })
  }
}
