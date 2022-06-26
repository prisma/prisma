import type { F, O } from 'ts-toolbelt'

import {
  type ClientModelAction,
  type ClientOnlyModelAction,
  clientOnlyActions,
  getDmmfActionName,
  isClientOnlyAction,
} from '../../clientActions'
import type { Action, Client, InternalRequestParams } from '../../getPrismaClient'
import { createPrismaPromise } from '../request/createPrismaPromise'
import type { PrismaPromise } from '../request/PrismaPromise'
import { getCallSite } from '../utils/getCallSite'
import { applyAggregates } from './applyAggregates'
import { wrapRequest } from './applyClientOnlyWrapper'
import { applyFluent } from './applyFluent'
import type { UserArgs } from './UserArgs'
import { defaultProxyHandlers } from './utils/defaultProxyHandlers'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'

export type ModelAction = (
  paramOverrides: O.Optional<InternalRequestParams>,
) => (userArgs?: UserArgs) => PrismaPromise<unknown>

const fluentProps = ['findUnique', 'findFirst', 'create', 'update', 'upsert', 'delete'] as const
const aggregateProps = ['aggregate', 'count', 'groupBy'] as const

/**
 * Dynamically creates a model interface via a proxy.
 * @param client to trigger the request execution
 * @param dmmfModelName the dmmf name of the model
 * @returns
 */
export function applyModel(client: Client, dmmfModelName: string) {
  // we use the javascript model name for display purposes
  const jsModelName = dmmfToJSModelName(dmmfModelName)
  const ownKeys = getOwnKeys(client, dmmfModelName)
  const baseObject = {} // <-- user mutations go in there

  // we construct a proxy that acts as the model interface
  return new Proxy(baseObject, {
    get(target, prop: string): F.Return<ModelAction> | undefined {
      // only allow actions that are valid and available for this model
      if (prop in target || typeof prop === 'symbol') return target[prop]
      if (!isValidActionName(client, dmmfModelName, prop)) return undefined
      const dmmfActionName = getDmmfActionName(prop as ClientModelAction)

      let requestFn = (params: InternalRequestParams) => client._request(params)
      if (isClientOnlyAction(prop)) {
        requestFn = wrapRequest(prop, dmmfModelName, requestFn)
      }
      // we return a function as the model action that we want to expose
      // it takes user args and executes the request in a Prisma Promise
      const action = (paramOverrides: O.Optional<InternalRequestParams>) => (userArgs?: UserArgs) => {
        const context = userArgs?.context as UserArgs
        if (userArgs?.context) {
          delete userArgs.context
        }

        const callSite = getCallSite(client._errorFormat) // used for showing better errors

        return createPrismaPromise((txId, lock, otelCtx) => {
          const data = { args: userArgs, context, dataPath: [] } // data and its dataPath for nested results
          const action = { action: dmmfActionName, model: dmmfModelName } // action name and its related model
          const method = { clientMethod: `${jsModelName}.${prop}`, jsModelName } // method name for display only
          const tx = { runInTransaction: !!txId, transactionId: txId, lock } // transaction information
          const trace = { callsite: callSite, otelCtx: otelCtx } // stack trace and opentelemetry
          const params = { ...data, ...action, ...method, ...tx, ...trace }

          return requestFn({ ...params, ...paramOverrides })
        })
      }

      // we give the control over action for building the fluent api
      if ((fluentProps as readonly string[]).includes(dmmfActionName)) {
        return applyFluent(client, dmmfModelName, action)
      }

      // we handle the edge case of aggregates that need extra steps
      if (isValidAggregateName(prop)) {
        return applyAggregates(client, prop, action)
      }

      return action({}) // and by default, don't override any params
    },
    ...defaultProxyHandlers(ownKeys),
  })
}

// the only accessible fields are the ones that are actions
function getOwnKeys(client: Client, dmmfModelName: string) {
  return [...Object.keys(client._baseDmmf.mappingsMap[dmmfModelName]), 'count'].filter(
    (key) => !['model', 'plural'].includes(key),
  )
}

// tells if a given `action` is valid & available for a `model`
function isValidActionName(
  client: Client,
  dmmfModelName: string,
  action: string,
): action is Action | ClientOnlyModelAction {
  if (isClientOnlyAction(action)) {
    return isValidActionName(client, dmmfModelName, clientOnlyActions[action].wrappedAction)
  }
  return getOwnKeys(client, dmmfModelName).includes(action)
}

function isValidAggregateName(action: string): action is typeof aggregateProps[number] {
  return (aggregateProps as readonly string[]).includes(action)
}
