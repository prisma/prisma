import { DMMF } from '@prisma/generator-helper'
import type { O } from 'ts-toolbelt'

import type { Client, InternalRequestParams } from '../../getPrismaClient'
import { getCallSite } from '../../utils/CallSite'
import {
  addObjectProperties,
  addProperty,
  cacheProperties,
  type CompositeProxyLayer,
  createCompositeProxy,
} from '../compositeProxy'
import type { PrismaPromise } from '../request/PrismaPromise'
import type { UserArgs } from '../request/UserArgs'
import { applyAggregates } from './applyAggregates'
import { applyFieldsProxy } from './applyFieldsProxy'
import { applyFluent } from './applyFluent'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'

export type ModelAction = (
  paramOverrides: O.Optional<InternalRequestParams>,
) => (userArgs?: UserArgs) => PrismaPromise<unknown>

const fluentProps = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'create',
  'update',
  'upsert',
  'delete',
] as const
const aggregateProps = ['aggregate', 'count', 'groupBy'] as const

/**
 * Dynamically creates a model interface via a proxy.
 * @param client to trigger the request execution
 * @param dmmfModelName the dmmf name of the model
 * @returns
 */
export function applyModel(client: Client, dmmfModelName: string) {
  const modelExtensions = client._extensions.getAllModelExtensions(dmmfModelName) ?? {}

  const layers = [
    modelActionsLayer(client, dmmfModelName),
    fieldsPropertyLayer(client, dmmfModelName),
    addObjectProperties(modelExtensions),
    addProperty('name', () => dmmfModelName),
    addProperty('$name', () => dmmfModelName),
    addProperty('$parent', () => client._appliedParent),
  ]

  return createCompositeProxy({}, layers)
}

/**
 * Dynamically creates a model interface via a proxy.
 * @param client to trigger the request execution
 * @param dmmfModelName the dmmf name of the model
 * @returns
 */
function modelActionsLayer(client: Client, dmmfModelName: string): CompositeProxyLayer<string> {
  // we use the javascript model name for display purposes
  const jsModelName = dmmfToJSModelName(dmmfModelName)
  const ownKeys = Object.keys(DMMF.ModelAction).concat('count')

  return {
    getKeys() {
      return ownKeys
    },

    getPropertyValue(key) {
      const dmmfActionName = key as DMMF.ModelAction

      // we return a function as the model action that we want to expose
      // it takes user args and executes the request in a Prisma Promise
      const action = (paramOverrides: O.Optional<InternalRequestParams>) => (userArgs?: UserArgs) => {
        const callSite = getCallSite(client._errorFormat) // used for showing better errors

        return client._createPrismaPromise(
          (transaction) => {
            const params: InternalRequestParams = {
              // data and its dataPath for nested results
              args: userArgs,
              dataPath: [],

              // action name and its related model
              action: dmmfActionName,
              model: dmmfModelName,

              // method name for display only
              clientMethod: `${jsModelName}.${key}`,
              jsModelName,

              // transaction information
              transaction,

              // stack trace
              callsite: callSite,
            }

            return client._request({ ...params, ...paramOverrides })
          },
          {
            action: dmmfActionName,
            args: userArgs,
            model: dmmfModelName,
          },
        )
      }

      // we give the control over action for building the fluent api
      if ((fluentProps as readonly string[]).includes(dmmfActionName)) {
        return applyFluent(client, dmmfModelName, action)
      }

      // we handle the edge case of aggregates that need extra steps
      if (isValidAggregateName(key)) {
        return applyAggregates(client, key, action)
      }

      return action({}) // and by default, don't override any params
    },
  }
}

function isValidAggregateName(action: string): action is (typeof aggregateProps)[number] {
  return (aggregateProps as readonly string[]).includes(action)
}

function fieldsPropertyLayer(client: Client, dmmfModelName: string) {
  return cacheProperties(
    addProperty('fields', () => {
      const model = client._runtimeDataModel.models[dmmfModelName]
      return applyFieldsProxy(dmmfModelName, model)
    }),
  )
}
