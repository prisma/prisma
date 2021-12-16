import { PrismaClientKnownRequestError } from '../PrismaClientKnownRequestError'
import { PrismaClientUnknownRequestError } from '../PrismaClientUnknownRequestError'
import type { RequestError } from '../types/RequestError'

export function prismaGraphQLToJSError(
  error: RequestError,
  clientVersion: string,
): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
  if (error.user_facing_error.error_code) {
    return new PrismaClientKnownRequestError(
      error.user_facing_error.message,
      error.user_facing_error.error_code,
      clientVersion,
      error.user_facing_error.meta,
    )
  }

  return new PrismaClientUnknownRequestError(error.error, clientVersion)
}
