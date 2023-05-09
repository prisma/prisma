import { isError, setClassName } from '@prisma/internals'

import { PrismaClientKnownRequestError } from '../core/errors/PrismaClientKnownRequestError'
import { Action } from '../core/types/JsApi'
import { clientVersion } from './clientVersion'

export type RejectOnNotFound = boolean | ((error: Error) => Error) | undefined
export type InstanceRejectOnNotFound =
  | RejectOnNotFound
  | Record<string, RejectOnNotFound> // { findFirst: RejectOnNotFound }
  | Record<string, Record<string, RejectOnNotFound>> // { findFirst: {User: RejectOnNotFound} }

/**
 * @deprecated please don´t rely on type checks to this error anymore.
 * This will become a PrismaClientKnownRequestError with code P2025
 * in the future major version of the client
 */
export class NotFoundError extends PrismaClientKnownRequestError {
  constructor(message: string) {
    super(message, { code: 'P2025', clientVersion })
    this.name = 'NotFoundError'
  }
}
setClassName(NotFoundError, 'NotFoundError')

/**
 * Gets the configured rejection action
 * @param action
 * @param [args]
 * @param [instance]
 * @returns {RejectOnNotFound}
 */
export function getRejectOnNotFound(
  action: Action,
  modelName: string,
  args?: any,
  clientInstance?: InstanceRejectOnNotFound,
): RejectOnNotFound {
  let rejectOnNotFound: RejectOnNotFound
  if (args && typeof args === 'object' && 'rejectOnNotFound' in args && args['rejectOnNotFound'] !== undefined) {
    rejectOnNotFound = args['rejectOnNotFound']
    delete args['rejectOnNotFound']
  } else if (typeof clientInstance === 'boolean') {
    rejectOnNotFound = clientInstance
  } else if (clientInstance && typeof clientInstance === 'object' && action in clientInstance) {
    const rejectPerOperation = clientInstance[action]
    if (rejectPerOperation && typeof rejectPerOperation === 'object') {
      if (modelName in rejectPerOperation) {
        return rejectPerOperation[modelName]
      }
      return undefined
    }
    rejectOnNotFound = getRejectOnNotFound(action, modelName, args, rejectPerOperation)
  } else if (typeof clientInstance === 'function') {
    rejectOnNotFound = clientInstance
  } else {
    rejectOnNotFound = false
  }
  return rejectOnNotFound
}

const REGEX = /(findUnique|findFirst)/
/**
 * Throws an error based on the current rejectOnNotFound configuration
 * @param data
 * @param clientMethod
 * @param modelName
 * @param [rejectOnNotFound]
 */
export function throwIfNotFound(
  data: unknown,
  clientMethod: string,
  modelName: string | undefined,
  rejectOnNotFound?: RejectOnNotFound,
) {
  modelName ??= 'record'
  if (rejectOnNotFound && !data && REGEX.exec(clientMethod)) {
    if (typeof rejectOnNotFound === 'boolean' && rejectOnNotFound) {
      throw new NotFoundError(`No ${modelName} found`)
    } else if (typeof rejectOnNotFound === 'function') {
      throw rejectOnNotFound(new NotFoundError(`No ${modelName} found`))
    } else if (isError(rejectOnNotFound)) {
      throw rejectOnNotFound
    }
    throw new NotFoundError(`No ${modelName} found`)
  }
}
