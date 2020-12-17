import pluralize from 'pluralize'
import { DMMF } from '../../runtime/dmmf-types'
import { capitalize, lowerCase } from '../../runtime/utils/common'
import { getAggregateArgsName, getModelArgName, unique } from '../utils'
import { JSDocMethodBodyCtx, JSDocs } from './constants'

export function getMethodJSDocBody(
  action: DMMF.ModelAction | 'findOne',
  mapping: DMMF.ModelMapping,
  model: DMMF.Model,
): string {
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

export function getMethodJSDoc(
  action: DMMF.ModelAction,
  mapping: DMMF.ModelMapping,
  model: DMMF.Model,
): string {
  return wrapComment(getMethodJSDocBody(action, mapping, model))
}
export function getGenericMethod(name: string, actionName: DMMF.ModelAction) {
  if (actionName === 'count') {
    return ''
  }
  if (actionName === 'aggregate') {
    return `<T extends ${getAggregateArgsName(name)}>`
  }
  return `<T extends ${getModelArgName(name, actionName)}>`
}
export function getArgs(name: string, actionName: DMMF.ModelAction) {
  if (actionName === 'count') {
    return `args?: Omit<${getModelArgName(
      name,
      DMMF.ModelAction.findMany,
    )}, 'select' | 'include'>`
  }
  if (actionName === 'aggregate') {
    return `args: Subset<T, ${getAggregateArgsName(name)}>`
  }
  return `args${
    actionName === DMMF.ModelAction.findMany ||
    actionName === DMMF.ModelAction.findFirst ||
    actionName === DMMF.ModelAction.deleteMany
      ? '?'
      : ''
  }: Subset<T, ${getModelArgName(name, actionName)}>`
}
export function wrapComment(str: string): string {
  return `/**\n${str
    .split('\n')
    .map((l) => ' * ' + l)
    .join('\n')}\n**/`
}
export function getArgFieldJSDoc(
  model?: DMMF.Model,
  action?: DMMF.ModelAction,
  field?: DMMF.SchemaArg | string,
): string | undefined {
  if (!field || !action || !model) return
  const fieldName = typeof field === 'string' ? field : field.name
  if (JSDocs[action] && JSDocs[action]?.fields[fieldName]) {
    const singular = model.name
    const plural = pluralize(model.name)
    const comment = JSDocs[action]?.fields[fieldName](singular, plural)
    return comment as string
  }
}

export function escapeJson(str: string): string {
  return str
    .replace(/\\n/g, '\\\\n')
    .replace(/\\r/g, '\\\\r')
    .replace(/\\t/g, '\\\\t')
}

export class ExportCollector {
  symbols: string[] = []
  addSymbol(symbol: string) {
    this.symbols.push(symbol)
  }
  getSymbols() {
    return unique(this.symbols)
  }
}
