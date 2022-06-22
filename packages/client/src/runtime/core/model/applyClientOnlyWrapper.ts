import { assertNever } from '@prisma/internals'

import { ClientOnlyModelAction } from '../../clientActions'
import { InternalRequestParams } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../../query'
import { printStack } from '../../utils/printStack'
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
      const { stack } = printStack({
        originalMethod: requestParams.clientMethod,
        callsite: requestParams.callsite,
      })
      throw new PrismaClientValidationError(`${stack}\n'rejectOnNotFound' option is not supported`)
    }
    const result = await requestCallback(requestParams)
    if (result === null || result === undefined) {
      throw new NotFoundError(`No ${dmmfModelName} found`)
    }
    return result
  }
}
