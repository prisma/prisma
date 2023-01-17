import { DMMF } from '@prisma/generator-helper'
import type { O } from 'ts-toolbelt'

import type { Client, InternalRequestParams } from '../../getPrismaClient'
import { getCallSite } from '../../utils/CallSite'
import {
  addObjectProperties,
  addProperty,
  cacheProperties,
  CompositeProxyLayer,
  createCompositeProxy,
} from '../compositeProxy'
import { createPrismaPromise } from '../request/createPrismaPromise'
import type { PrismaPromise } from '../request/PrismaPromise'
import { applyAggregates } from './applyAggregates'
import { applyFieldsProxy } from './applyFieldsProxy'
import { applyFluent } from './applyFluent'
import { adaptErrors } from './applyOrThrowErrorAdapter'
import type { UserArgs } from './UserArgs'
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
  const layers: CompositeProxyLayer[] = [modelActionsLayer(client, dmmfModelName), modelMetaLayer(dmmfModelName)]

  if (client._engineConfig.previewFeatures?.includes('fieldReference')) {
    layers.push(fieldsPropertyLayer(client, dmmfModelName))
  }

  const modelExtensions = client._extensions.getAllModelExtensions(dmmfModelName)
  if (modelExtensions) {
    layers.push(addObjectProperties(modelExtensions))
  }

  return createCompositeProxy({}, layers)
}

function modelMetaLayer(dmmfModelName: string): CompositeProxyLayer {
  return addProperty('name', () => dmmfModelName)
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
  const ownKeys = getOwnKeys(client, dmmfModelName)

  return {
    getKeys() {
      return ownKeys
    },

    getPropertyValue(key) {
      const dmmfActionName = key as DMMF.ModelAction

      let requestFn = (params: InternalRequestParams) => client._request(params)
      requestFn = adaptErrors(dmmfActionName, dmmfModelName, requestFn)

      // we return a function as the model action that we want to expose
      // it takes user args and executes the request in a Prisma Promise
      const action = (paramOverrides: O.Optional<InternalRequestParams>) => (userArgs?: UserArgs) => {
        const callSite = getCallSite(client._errorFormat) // used for showing better errors

        return createPrismaPromise((transaction, lock) => {
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
            lock,

            // stack trace
            callsite: callSite,
          }

          return requestFn({ ...params, ...paramOverrides })
        })
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

function getOwnKeys(client: Client, dmmfModelName: string) {
  const actionKeys = Object.keys(client._baseDmmf.mappingsMap[dmmfModelName]).filter(
    (key) => key !== 'model' && key !== 'plural',
  )
  actionKeys.push('count')

  return actionKeys
}

function isValidAggregateName(action: string): action is typeof aggregateProps[number] {
  return (aggregateProps as readonly string[]).includes(action)
}

function fieldsPropertyLayer(client: Client, dmmfModelName: string) {
  return cacheProperties(
    addProperty('fields', () => {
      const model = client._baseDmmf.modelMap[dmmfModelName]
      return applyFieldsProxy(model)
    }),
  )
}
