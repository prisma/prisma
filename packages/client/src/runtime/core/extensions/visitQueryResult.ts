import { DMMF } from '@prisma/generator-helper'

import { BaseDMMFHelper } from '../../dmmf'

export type IncludeSelect = {
  select?: Selection
  include?: Selection
}

export type Selection = Record<string, boolean | IncludeSelect>

type ModelVisitor = (value: object, model: DMMF.Model, queryArgs: IncludeSelect) => object | undefined

type VisitParams = {
  result: object
  args: IncludeSelect
  model: DMMF.Model
  dmmf: BaseDMMFHelper
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
export function visitQueryResult({ visitor, result, args, dmmf, model }: VisitParams) {
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i++) {
      result[i] = visitQueryResult({
        result: result[i],
        args,
        model,
        dmmf,
        visitor,
      })
    }
    return result
  }
  const visitResult = visitor(result, model, args) ?? result
  if (args.include) {
    visitNested({ includeOrSelect: args.include, result: visitResult, parentModel: model, dmmf, visitor })
  }
  if (args.select) {
    visitNested({ includeOrSelect: args.select, result: visitResult, parentModel: model, dmmf, visitor })
  }
  return visitResult
}

type VisitNestedParams = {
  includeOrSelect: IncludeSelect
  result: object
  parentModel: DMMF.Model
  dmmf: BaseDMMFHelper
  visitor: ModelVisitor
}

function visitNested({ includeOrSelect, result, parentModel, dmmf, visitor }: VisitNestedParams) {
  for (const [fieldName, subConfig] of Object.entries(includeOrSelect)) {
    if (!subConfig || result[fieldName] == null) {
      continue
    }
    const field = parentModel.fields.find((field) => field.name === fieldName)
    if (!field || field.kind !== 'object' || !field.relationName) {
      continue
    }
    const args = typeof subConfig === 'object' ? subConfig : {}
    result[fieldName] = visitQueryResult({
      visitor,
      result: result[fieldName],
      args,
      model: dmmf.getModelMap()[field.type],
      dmmf,
    })
  }
}
