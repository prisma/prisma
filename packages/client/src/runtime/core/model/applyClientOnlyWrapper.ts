import { assertNever } from '@prisma/internals'

import { ClientOnlyModelAction } from '../../clientActions'
import { InternalRequestParams } from '../../getPrismaClient'
import { printStack } from '../../utils/printStack'
import { NotFoundError } from '../../utils/rejectOnNotFound'

type RequestCallback = (requestParams: InternalRequestParams) => Promise<unknown>

export function wrapRequest(
  prop: ClientOnlyModelAction,
  jsModelName: string,
  requestCallback: RequestCallback,
): RequestCallback {
  if (prop === 'findFirstOrThrow' || prop === 'findUniqueOrThrow') {
    return applyOrThrowWrapper(jsModelName, requestCallback)
  }

  assertNever(prop, 'Unknown wrapper name')
}

function applyOrThrowWrapper(jsModelName: string, requestCallback: RequestCallback): RequestCallback {
  return async (requestParams) => {
    if ('rejectOnNotFound' in requestParams.args) {
      const { stack } = printStack({
        originalMethod: requestParams.clientMethod,
        callsite: requestParams.callsite,
      })
      throw new TypeError(`${stack}\n'rejectOnNotFound' option is not supported`)
    }
    const result = await requestCallback(requestParams)
    if (result === null || result === undefined) {
      throw new NotFoundError(`No ${jsModelName} found`)
    }
    return result
  }
}
