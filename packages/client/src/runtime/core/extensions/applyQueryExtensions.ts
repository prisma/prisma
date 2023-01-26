import { klona } from 'klona'

import { Client, InternalRequestParams } from '../../getPrismaClient'
import { createPrismaPromise } from '../request/createPrismaPromise'
import { RequiredArgs } from './$extends'

function iterateAndCallQueryCallbacks(
  client: Client,
  params: InternalRequestParams,
  queryCbs: RequiredArgs['query'][string][string][],
  i = 0,
) {
  return createPrismaPromise((transaction) => {
    // allow query extensions to re-wrap in transactions
    // this will automatically discard the prev batch tx
    if (transaction !== undefined) {
      if (params.transaction?.kind === 'batch') {
        void params.transaction.lock.then() // discard
      }
      params.transaction = transaction
    }

    // if we are done recursing, we execute the request
    if (i === queryCbs.length) {
      return client._executeRequest(params)
    }

    // if not, call the next query cb and recurse query
    return queryCbs[i]({
      model: params.model,
      operation: params.action,
      args: klona(params.args ?? {}),
      // @ts-expect-error because not part of public API
      __internalParams: params,
      query: (args, __internalParams = params) => {
        __internalParams.args = args

        return iterateAndCallQueryCallbacks(client, __internalParams, queryCbs, i + 1)
      },
    })
  })
}

export function applyQueryExtensions(client: Client, params: InternalRequestParams) {
  const { jsModelName, action } = params

  // query extensions only apply to model-bound operations (for now)
  if (jsModelName === undefined || client._extensions.isEmpty()) {
    return client._executeRequest(params)
  }

  return iterateAndCallQueryCallbacks(client, params, client._extensions.getAllQueryCallbacks(jsModelName, action))
}
