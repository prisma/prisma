import pluralize from 'pluralize'

import { DMMF } from '../dmmf-types'
import { getAggregateArgsName, getModelArgName } from '../utils'
import { capitalize, lowerCase } from '../utils/common'
import type { JSDocMethodBodyCtx } from './jsdoc'
import { JSDocs } from './jsdoc'

export function getMethodJSDocBody(action: DMMF.ModelAction, mapping: DMMF.ModelMapping, model: DMMF.Model): string {
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

export function getMethodJSDoc(action: DMMF.ModelAction, mapping: DMMF.ModelMapping, model: DMMF.Model): string {
  return wrapComment(getMethodJSDocBody(action, mapping, model))
}
export function getGenericMethod(name: string, actionName: DMMF.ModelAction) {
  if (actionName === DMMF.ModelAction.count) {
    return ''
  }
  if (actionName === DMMF.ModelAction.aggregate) {
    return `<T extends ${getAggregateArgsName(name)}>`
  }
  if (actionName === DMMF.ModelAction.findRaw || actionName === DMMF.ModelAction.aggregateRaw) {
    return ''
  }
  if (actionName === DMMF.ModelAction.findFirst || actionName === DMMF.ModelAction.findUnique) {
    return `<T extends ${getModelArgName(name, actionName)}<ExtArgs>>`
  }
  const modelArgName = getModelArgName(name, actionName)

  if (!modelArgName) {
    console.log({ name, actionName })
  }
  return `<T extends ${modelArgName}<ExtArgs>>`
}
export function getArgs(modelName: string, actionName: DMMF.ModelAction) {
  if (actionName === DMMF.ModelAction.count) {
    return `args?: Omit<${getModelArgName(modelName, DMMF.ModelAction.findMany)}, 'select' | 'include' | 'distinct' >`
  }
  if (actionName === DMMF.ModelAction.aggregate) {
    return `args: Subset<T, ${getAggregateArgsName(modelName)}>`
  }
  if (actionName === DMMF.ModelAction.findRaw || actionName === DMMF.ModelAction.aggregateRaw) {
    return `args?: ${getModelArgName(modelName, actionName)}`
  }
  return `args${
    actionName === DMMF.ModelAction.findMany ||
    actionName === DMMF.ModelAction.findFirst ||
    actionName === DMMF.ModelAction.deleteMany ||
    actionName === DMMF.ModelAction.createMany ||
    actionName === DMMF.ModelAction.findUniqueOrThrow ||
    actionName === DMMF.ModelAction.findFirstOrThrow
      ? '?'
      : ''
  }: SelectSubset<T, ${getModelArgName(modelName, actionName)}<ExtArgs>>`
}
export function wrapComment(str: string): string {
  return `/**\n${str
    .split('\n')
    .map((l) => ' * ' + l)
    .join('\n')}\n**/`
}
export function getArgFieldJSDoc(
  type?: DMMF.OutputType,
  action?: DMMF.ModelAction,
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
