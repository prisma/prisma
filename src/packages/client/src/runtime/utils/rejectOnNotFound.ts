import { isError } from '@prisma/sdk'
import { Action } from '../getPrismaClient'

export type RejectOnNotFound = boolean | Error | ((error: Error) => Error)
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
  args?: any,
  instance?: InstanceRejectOnNotFound,
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
  } else if (typeof instance === 'boolean' || isError(instance)) {
    rejectOnNotFound = instance
  } else if (instance && typeof instance === 'object' && action in instance) {
    const RONF = instance[action]
    rejectOnNotFound = getRejectOnNotFound(action, args, RONF)
  } else if (typeof instance === 'function') {
    rejectOnNotFound = instance
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
