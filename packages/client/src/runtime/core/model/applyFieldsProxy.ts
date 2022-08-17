import { DMMF } from '@prisma/generator-helper'
import { keyBy } from '@prisma/internals'

import { FieldRefImpl } from '../../FieldRef'
import { defaultProxyHandlers } from './utils/defaultProxyHandlers'

export type FieldProxy = {
  readonly [key: string]: FieldRefImpl<string, string>
}

export function applyFieldsProxy(model: DMMF.Model): FieldProxy {
  const scalarFieldsList = model.fields.filter((field) => !field.relationName)
  const scalarFields = keyBy(scalarFieldsList, (field) => field.name)
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop in target || typeof prop === 'symbol') {
          return target[prop]
        }
        const dmmfField = scalarFields[prop]
        if (dmmfField) {
          return new FieldRefImpl(model.name, prop, dmmfField.type, dmmfField.isList)
        }

        return undefined
      },
      ...defaultProxyHandlers(Object.keys(scalarFields)),
    },
  )
}
