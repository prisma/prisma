import type { O } from 'ts-toolbelt'
import type { Action, Client, InternalRequestParams } from '../../getPrismaClient'
import { createPrismaPromise } from '../request/createPrismaPromise'
import type { PrismaPromise } from '../request/PrismaPromise'
import { getCallSite } from '../utils/getCallSite'
import { applyAggregates } from './applyAggregates'
import { applyFluent } from './applyFluent'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'

const EMPTY_OBJECT = {}

export type ModelAction = (
  paramOverrides: O.Optional<InternalRequestParams>,
) => (userArgs: object) => PrismaPromise<unknown>

/**
 * Tells if a given `action` is valid & available for a `model`.
 * @param client to provide dmmf information
 * @param dmmfModelName the dmmf name of the model
 * @param action the method that has been called
 * @returns
 */
function isValidActionName(client: Client, dmmfModelName: string, action: string): action is Action {
  // we retrieve the possible actions for this model
  const dmmfModelMapping = client._dmmf.mappingsMap[dmmfModelName]

  // TODO: edge case, not actually present in the DMMF
  if (action === 'count') return true

  // these are not allowed or valid actions on a model
  if (['model', 'plural'].includes(action)) return false

  // only valid actions are allowed to be called on models
  if (dmmfModelMapping[action] === undefined) return false

  return true
}

/**
 * Dynamically creates a model interface via a proxy.
 * @param client to trigger the request execution
 * @param dmmfModelName the dmmf name of the model
 * @returns
 */
export function applyModel(client: Client, dmmfModelName: string) {
  // we use the javascript model name for display purposes
  const jsModelName = dmmfToJSModelName(dmmfModelName)

  // we construct a proxy that acts as the model interface
  return new Proxy(EMPTY_OBJECT, {
    get(_, prop: string) {
      // only allow valid actions to be accessed on a model
      if (!isValidActionName(client, dmmfModelName, prop)) return undefined

      // we return a function as the model action that we want to expose
      // it takes user args and executes the request in a Prisma Promise
      const action = (paramOverrides: O.Optional<InternalRequestParams>) => (userArgs: object) => {
        return createPrismaPromise((txId, runInTx, span) => {
          const data = { args: userArgs, dataPath: [] } // the data and the dataPath for the result
          const action = { action: prop, model: dmmfModelName } // the action and its related model
          const method = { clientMethod: `${jsModelName}.${prop}` } // method name for display only
          const tx = { runInTransaction: !!runInTx, transactionId: txId } // transaction information
          const trace = { callsite: getCallSite(), span: span } // the stack trace and opentelemetry
          const params = { ...data, ...action, ...method, ...tx, ...trace }

          return client._request({ ...params, ...paramOverrides })
        })
      }

      // we give the control over action for building the fluent api
      if (prop === 'findUnique' || prop === 'findFirst') {
        return applyFluent(client, dmmfModelName, action)
      }

      // we handle the edge case of aggregates that need extra steps
      if (prop === 'aggregate' || prop === 'count' || prop === 'groupBy') {
        return applyAggregates(client, prop, action)
      }

      return action({}) // and by default, don't override any params
    },
  })
}
