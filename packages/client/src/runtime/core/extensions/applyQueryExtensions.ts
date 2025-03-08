import type { Client, InternalRequestParams } from '../../getPrismaClient'
import type { RequestParams } from '../../RequestHandler'
import { deepCloneArgs } from '../../utils/deepCloneArgs'
import type { CustomDataProxyFetch } from '../engines'
import type { QueryOptionsCb } from '../types/exported/ExtensionArgs'
import type { BatchInternalParams, BatchQueryOptionsCb } from '../types/internal/ExtensionsInternalArgs'

function iterateAndCallQueryCallbacks(
  client: Client,
  params: InternalRequestParams,
  queryCbs: QueryOptionsCb[],
  i = 0,
) {
  return client._createPrismaPromise((transaction) => {
    // we need to keep track of the previous customDataProxyFetch
    const prevCustomFetch = params.customDataProxyFetch

    // allow query extensions to re-wrap in transactions
    // this will automatically discard the prev batch tx
    if ('transaction' in params && transaction !== undefined) {
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
      args: deepCloneArgs(params.args ?? {}),
      // @ts-expect-error because not part of public API
      __internalParams: params,
      query: (args, __internalParams = params) => {
        // we need to keep track of the current customDataProxyFetch
        // this is to cascade customDataProxyFetch like a middleware
        const currCustomFetch = __internalParams.customDataProxyFetch
        __internalParams.customDataProxyFetch = composeCustomDataProxyFetch(prevCustomFetch, currCustomFetch)
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
  const cbs = client._extensions.getAllQueryCallbacks(jsModelName ?? '$none', operation)

  return iterateAndCallQueryCallbacks(client, params, cbs)
}

type BatchExecuteCallback = (params: BatchInternalParams) => Promise<unknown[]>

export function createApplyBatchExtensionsFunction(executeBatch: BatchExecuteCallback) {
  return (requests: RequestParams[]) => {
    const params = { requests }
    const callbacks = requests[0].extensions.getAllBatchQueryCallbacks()
    if (!callbacks.length) {
      return executeBatch(params)
    }

    return iterateAndCallBatchCallbacks(params, callbacks, 0, executeBatch)
  }
}

export function iterateAndCallBatchCallbacks(
  params: BatchInternalParams,
  callbacks: BatchQueryOptionsCb[],
  i: number,
  executeBatch: BatchExecuteCallback,
) {
  if (i === callbacks.length) {
    return executeBatch(params)
  }

  const prevFetch = params.customDataProxyFetch
  const transaction = params.requests[0].transaction
  return callbacks[i]({
    args: {
      queries: params.requests.map((request) => ({
        model: request.modelName,
        operation: request.action,
        args: request.args,
      })),
      transaction: transaction
        ? {
            isolationLevel: transaction.kind === 'batch' ? transaction.isolationLevel : undefined,
          }
        : undefined,
    },
    __internalParams: params,
    query(_args, __internalParams = params) {
      const nextFetch = __internalParams.customDataProxyFetch
      __internalParams.customDataProxyFetch = composeCustomDataProxyFetch(prevFetch, nextFetch)
      return iterateAndCallBatchCallbacks(__internalParams, callbacks, i + 1, executeBatch)
    },
  })
}

const noopFetch: CustomDataProxyFetch = (f) => f
function composeCustomDataProxyFetch(prevFetch = noopFetch, nextFetch = noopFetch): CustomDataProxyFetch {
  return (f) => prevFetch(nextFetch(f))
}
