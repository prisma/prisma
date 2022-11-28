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
  if (queryCbs.length === 0) return client._executeRequest(params)

  return createPrismaPromise((transaction, lock) => {
    // allow query extensions to re-wrap in transactions
    // this will automatically discard the prev batch tx
    if (transaction !== undefined) {
      void params.lock?.then() // discard previous lock
      params.transaction = transaction
      params.lock = lock // assign newly acquired lock
    }

    // if we are done recursing, we execute the request
    if (i === queryCbs.length) {
      return client._executeRequest(params)
    }

    // if not, call the next query cb and recurse query
    return queryCbs[i]({
      model: params.model,
      operation: params.action,
      args: klona(params.args),
      query: (args) => {
        params.args = args
        return iterateAndCallQueryCallbacks(client, params, queryCbs, i + 1)
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
