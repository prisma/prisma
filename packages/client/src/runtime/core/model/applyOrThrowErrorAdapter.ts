import { PrismaClientKnownRequestError } from '@prisma/engine-core'
import { DMMF } from '@prisma/generator-helper'

import { InternalRequestParams } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../../query'
import { createErrorMessageWithContext } from '../../utils/createErrorMessageWithContext'
import { NotFoundError } from '../../utils/rejectOnNotFound'

type RequestCallback = (requestParams: InternalRequestParams) => Promise<unknown>

/**
 * `findUniqueOrThrow` and `findFirstOrThrow` are implemented in the engine, but before that,
 * they used to be implemented on the client side.
 *
 * If the above mentioned methods returned no result, an error of type NotFoundError
 * is thrown. This error is client-side and, in order to not break existing code relying on it, we
 * need to wrap the request callback in a function that catches the error thrown by the Query Engine
 * and rethrow it as a NotFoundError.
 *
 * @param action the action name to wrap, wrapping the request for actions other than
 *  findUniqueOrThrow and findFirstOrThrow is a noop
 * @param dmmfModelName the model for which the action is being wrapped
 * @param requestCallback the request callback to wrap
 * @returns either the original callback or the original callback wrapped to throw a NotFoundError
 * in case the engine throws its own error to inform a missing record for findUniqueOrThrow and
 * findFirstOrThrow
 */
export function adaptErrors(
  action: DMMF.ModelAction,
  dmmfModelName: string,
  requestCallback: RequestCallback,
): RequestCallback {
  if (action === DMMF.ModelAction.findFirstOrThrow || action === DMMF.ModelAction.findUniqueOrThrow) {
    return applyOrThrowWrapper(dmmfModelName, requestCallback)
  }
  return requestCallback
}

function applyOrThrowWrapper(dmmfModelName: string, requestCallback: RequestCallback): RequestCallback {
  return async (requestParams) => {
    if ('rejectOnNotFound' in requestParams.args) {
      const message = createErrorMessageWithContext({
        originalMethod: requestParams.clientMethod,
        callsite: requestParams.callsite,
        message: "'rejectOnNotFound' option is not supported",
      })
      throw new PrismaClientValidationError(message)
    }
    const result = await requestCallback(requestParams).catch((e) => {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundError(`No ${dmmfModelName} found`)
      } else {
        throw e
      }
    })

    return result
  }
}
