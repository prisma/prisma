import { isError } from '@prisma/sdk/dist/cli/utils'
import { Action } from '../getPrismaClient'

export type RejectOnNotFound = boolean | ((error: Error) => Error) | undefined
export type InstanceRejectOnNotFound =
  | RejectOnNotFound
  | Record<string, RejectOnNotFound> // { findFirst: RejectOnNotFound }
  | Record<string, Record<string, RejectOnNotFound>> // { findFirst: {User: RejectOnNotFound} }

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
    this.stack = undefined
  }
}

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
  if (
    args &&
    typeof args === 'object' &&
    'rejectOnNotFound' in args &&
    args['rejectOnNotFound'] !== undefined
  ) {
    rejectOnNotFound = args['rejectOnNotFound']
    delete args['rejectOnNotFound']
  } else if (typeof clientInstance === 'boolean') {
    rejectOnNotFound = clientInstance
  } else if (
    clientInstance &&
    typeof clientInstance === 'object' &&
    action in clientInstance
  ) {
    const rejectPerOperation = clientInstance[action]
    if (rejectPerOperation && typeof rejectPerOperation === 'object') {
      if (modelName in rejectPerOperation) {
        return rejectPerOperation[modelName]
      }
      return undefined
    }
    rejectOnNotFound = getRejectOnNotFound(
      action,
      modelName,
      args,
      rejectPerOperation,
    )
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
 * @param typeName
 * @param [rejectOnNotFound]
 */
export function throwIfNotFound(
  data: any,
  clientMethod: string,
  typeName: string,
  rejectOnNotFound?: RejectOnNotFound,
) {
  if (rejectOnNotFound && !data && REGEX.exec(clientMethod)) {
    if (typeof rejectOnNotFound === 'boolean' && rejectOnNotFound) {
      throw new NotFoundError(`No ${typeName} found`)
    } else if (typeof rejectOnNotFound === 'function') {
      throw rejectOnNotFound(new NotFoundError(`No ${typeName} found`))
    } else if (isError(rejectOnNotFound)) {
      throw rejectOnNotFound
    }
    throw new NotFoundError(`No ${typeName} found`)
  }
}
