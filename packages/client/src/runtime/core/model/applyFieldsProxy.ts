import { keyBy } from '@prisma/internals'

import { RuntimeModel } from '../runtimeDataModel'
import { FieldRefImpl } from './FieldRef'
import { defaultProxyHandlers } from './utils/defaultProxyHandlers'

export type FieldProxy = {
  readonly [key: string]: FieldRefImpl<string, string>
}

export function applyFieldsProxy(modelName: string, model: RuntimeModel): FieldProxy {
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
          return new FieldRefImpl(modelName, prop, dmmfField.type, dmmfField.isList, dmmfField.kind === 'enum')
        }

        return undefined
      },
      ...defaultProxyHandlers(Object.keys(scalarFields)),
    },
  )
}
