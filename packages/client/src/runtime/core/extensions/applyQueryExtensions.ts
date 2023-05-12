import { klona } from 'klona/full'

import { Client, InternalRequestParams } from '../../getPrismaClient'
import { createPrismaPromise } from '../request/createPrismaPromise'
import { QueryOptionsCb } from './$extends'

function iterateAndCallQueryCallbacks(
  client: Client,
  params: InternalRequestParams,
  queryCbs: QueryOptionsCb[],
  i = 0,
) {
  return createPrismaPromise((transaction) => {
    // we need to keep track of the previous customDataProxyFetch
    const prevCustomFetch = params.customDataProxyFetch ?? ((f) => f)

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
      operation: params.model ? params.action : params.clientMethod,
      args: klona(params.args ?? {}),
      // @ts-expect-error because not part of public API
      __internalParams: params,
      query: (args, __internalParams = params) => {
        // we need to keep track of the current customDataProxyFetch
        // this is to cascade customDataProxyFetch like a middleware
        const currCustomFetch = __internalParams.customDataProxyFetch ?? ((f) => f)
        __internalParams.customDataProxyFetch = (f) => prevCustomFetch(currCustomFetch(f))
        __internalParams.args = args

        return iterateAndCallQueryCallbacks(client, __internalParams, queryCbs, i + 1)
      },
    })
  })
}

export function applyQueryExtensions(client: Client, params: InternalRequestParams): Promise<any> {
  const { jsModelName, action, clientMethod } = params
  const operation = jsModelName ? action : clientMethod

  // query extensions only apply to model-bound operations
  if (client._extensions.isEmpty()) {
    return client._executeRequest(params)
  }

  // get the cached query cbs for a given model and action
  const cbs = client._extensions.getAllQueryCallbacks(jsModelName ?? '*', operation)

  return iterateAndCallQueryCallbacks(client, params, cbs)
}
