import pluralize from 'pluralize'

import { ClientModelAction } from '../../runtime/clientActions'
import { DMMF } from '../../runtime/dmmf-types'
import { capitalize, lowerCase } from '../../runtime/utils/common'
import { getAggregateArgsName, getModelArgName, unique } from '../utils'
import type { JSDocMethodBodyCtx } from './jsdoc'
import { JSDocs } from './jsdoc'

export function getMethodJSDocBody(action: ClientModelAction, mapping: DMMF.ModelMapping, model: DMMF.Model): string {
  const ctx: JSDocMethodBodyCtx = {
    singular: capitalize(mapping.model),
    plural: capitalize(mapping.plural),
    firstScalar: model.fields.find((f) => f.kind === 'scalar'),
    method: `prisma.${lowerCase(mapping.model)}.${action}`,
    action,
    mapping,
    model,
  }
  const jsdoc = JSDocs[action]?.body(ctx)

  return jsdoc ? jsdoc : ''
}

export function getMethodJSDoc(action: ClientModelAction, mapping: DMMF.ModelMapping, model: DMMF.Model): string {
  return wrapComment(getMethodJSDocBody(action, mapping, model))
}
export function getGenericMethod(name: string, actionName: ClientModelAction) {
  if (actionName === 'count') {
    return ''
  }
  if (actionName === 'aggregate') {
    return `<T extends ${getAggregateArgsName(name)}>`
  }
  if (actionName === 'findRaw' || actionName === 'aggregateRaw') {
    return ''
  }
  if (actionName === 'findFirst' || actionName === 'findUnique') {
    return `<T extends ${getModelArgName(
      name,
      actionName,
    )},  LocalRejectSettings = T["rejectOnNotFound"] extends RejectOnNotFound ? T['rejectOnNotFound'] : undefined>`
  }
  const modelArgName = getModelArgName(name, actionName)

  if (!modelArgName) {
    console.log({ name, actionName })
  }
  return `<T extends ${modelArgName}>`
}
export function getArgs(modelName: string, actionName: ClientModelAction) {
  if (actionName === 'count') {
    return `args?: Omit<${getModelArgName(modelName, DMMF.ModelAction.findMany)}, 'select' | 'include'>`
  }
  if (actionName === 'aggregate') {
    return `args: Subset<T, ${getAggregateArgsName(modelName)}>`
  }
  if (actionName === 'findRaw' || actionName === 'aggregateRaw') {
    return `args?: ${getModelArgName(modelName, actionName)}`
  }
  return `args${
    actionName === DMMF.ModelAction.findMany ||
    actionName === DMMF.ModelAction.findFirst ||
    actionName === DMMF.ModelAction.deleteMany ||
    actionName === DMMF.ModelAction.createMany ||
    actionName === 'findFirstOrThrow' ||
    actionName === 'findUniqueOrThrow'
      ? '?'
      : ''
  }: SelectSubset<T, ${getModelArgName(modelName, actionName)}>`
}
export function wrapComment(str: string): string {
  return `/**\n${str
    .split('\n')
    .map((l) => ' * ' + l)
    .join('\n')}\n**/`
}
export function getArgFieldJSDoc(
  type?: DMMF.OutputType,
  action?: ClientModelAction,
  field?: DMMF.SchemaArg | string,
): string | undefined {
  if (!field || !action || !type) return
  const fieldName = typeof field === 'string' ? field : field.name
  if (JSDocs[action] && JSDocs[action]?.fields[fieldName]) {
    const singular = type.name
    const plural = pluralize(type.name)
    const comment = JSDocs[action]?.fields[fieldName](singular, plural)
    return comment as string
  }

  return undefined
}

export function escapeJson(str: string): string {
  return str.replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r').replace(/\\t/g, '\\\\t')
}
