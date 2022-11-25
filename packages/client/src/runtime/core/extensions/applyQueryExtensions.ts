import { klona } from 'klona'

import { Client, InternalRequestParams } from '../../getPrismaClient'
import { createPrismaPromise } from '../request/createPrismaPromise'
import { PrismaPromise } from '../request/PrismaPromise'
import { RequiredArgs } from './$extends'

function iterateAndCallQueryCallbacks(
  client: Client,
  params: InternalRequestParams,
  queryCbs: RequiredArgs['query'][string][string][],
  i = 0,
) {
  return createPrismaPromise((transaction, lock) => {
    // allow query extensions to re-wrap in transactions
    // this will automatically discard the prev batch tx
    if (transaction !== undefined) {
      params.transaction = transaction
      params.lock = lock
    }

    // if not, call the next query cb and recurse query
    const result = queryCbs[i]({
      model: params.model,
      operation: params.action,
      args: klona(params.args),
      query: (args) => iterateAndCallQueryCallbacks(client, { ...params, args }, queryCbs, i + 1),
    })

    // if a query cb returns a value/skips `await query`
    // we can end up with a batch tx locking the process
    if ((result as PrismaPromise<any>).requestTransaction === undefined) {
      void lock?.then() // unlock this query in batch tx
    }

    return result
  })
}

export function applyQueryExtensions(client: Client, params: InternalRequestParams) {
  const { jsModelName, action } = params

  if (client._extensions.length === 0) return client._executeRequest(params)

  // query extensions only apply to model-bound operations (for now)
  if (jsModelName === undefined) return client._executeRequest(params)

  // iterate, filter, and process all the relevant query extensions
  const queryCbs = client._extensions.reduce((acc, extension) => {
    if (extension.query === undefined) return acc

    // when the extension is model-bound and the model name matches
    if (extension.query[jsModelName] !== undefined) {
      if (extension.query[jsModelName][action] !== undefined) {
        acc = [...acc, extension.query[jsModelName!][action]]
      }

      // when the model-bound extension has a wildcard for the operation
      if (extension.query[jsModelName]['$allOperations'] !== undefined) {
        acc = [...acc, extension.query[jsModelName]['$allOperations']]
      }
    }

    // when the extension isn't model-bound, apply it to all models
    if (extension.query['$allModels'] !== undefined) {
      if (extension.query['$allModels'][action] !== undefined) {
        acc = [...acc, extension.query['$allModels'][action]]
      }

      // when the non-model-bound extension has a wildcard for the operation
      if (extension.query['$allModels']['$allOperations'] !== undefined) {
        acc = [...acc, extension.query['$allModels']['$allOperations']]
      }
    }
    return acc
  }, [] as RequiredArgs['query'][string][string][])

  // the last "extension" is added by us and will execute the actual query
  queryCbs.push(({ args }) => client._executeRequest({ ...params, args }))

  // we clone the args here because we don't want to mutate the original
  return iterateAndCallQueryCallbacks(client, params, queryCbs)
}
