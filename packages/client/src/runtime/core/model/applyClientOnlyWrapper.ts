import { assertNever } from '@prisma/internals'

import { ClientOnlyModelAction } from '../../clientActions'
import { InternalRequestParams } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../../query'
import { createErrorMessageWithContext } from '../../utils/createErrorMessageWithContext'
import { NotFoundError } from '../../utils/rejectOnNotFound'

type RequestCallback = (requestParams: InternalRequestParams) => Promise<unknown>

export function wrapRequest(
  prop: ClientOnlyModelAction,
  dmmfModelName: string,
  requestCallback: RequestCallback,
): RequestCallback {
  if (prop === 'findFirstOrThrow' || prop === 'findUniqueOrThrow') {
    return applyOrThrowWrapper(dmmfModelName, requestCallback)
  }

  assertNever(prop, 'Unknown wrapper name')
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
    const result = await requestCallback(requestParams)
    if (result === null || result === undefined) {
      throw new NotFoundError(`No ${dmmfModelName} found`)
    }
    return result
  }
}
