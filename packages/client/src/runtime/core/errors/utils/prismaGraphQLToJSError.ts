import { RequestError } from '../../engines/common/types/RequestError'
import { PrismaClientKnownRequestError } from '../PrismaClientKnownRequestError'
import { PrismaClientUnknownRequestError } from '../PrismaClientUnknownRequestError'

export function prismaGraphQLToJSError(
  { error, user_facing_error }: RequestError,
  clientVersion: string,
): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
  if (user_facing_error.error_code) {
    return new PrismaClientKnownRequestError(user_facing_error.message, {
      code: user_facing_error.error_code,
      clientVersion,
      meta: user_facing_error.meta,
      batchRequestIdx: user_facing_error.batch_request_idx,
    })
  }

  return new PrismaClientUnknownRequestError(error, {
    clientVersion,
    batchRequestIdx: user_facing_error.batch_request_idx,
  })
}
