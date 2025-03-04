import pluralize from 'pluralize'

import type { DMMF } from '../dmmf-types'
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

export function wrapComment(str: string): string {
  return `/**\n${str
    .split('\n')
    .map((l) => ` * ${l}`)
    .join('\n')}\n**/`
}
export function getArgFieldJSDoc(
  type?: DMMF.OutputType,
  action?: DMMF.ModelAction,
  field?: DMMF.SchemaArg | string,
): string | undefined {
  if (!field || !action || !type) return
  const fieldName = typeof field === 'string' ? field : field.name
  if (JSDocs[action]?.fields[fieldName]) {
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
