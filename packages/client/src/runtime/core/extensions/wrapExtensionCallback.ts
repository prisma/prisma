import { isPromiseLike, mapObjectValues } from '@prisma/internals'

export class PrismaClientExtensionError extends Error {
  constructor(public extensionName: string | undefined, cause: unknown) {
    super(`${getTitleFromExtensionName(extensionName)}: ${getMessageFromCause(cause)}`, { cause })
    this.name = 'PrismaClientExtensionError'
    // For older versions
    if (!this.cause) {
      this.cause = cause
    }

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, PrismaClientExtensionError)
    }
  }

  get [Symbol.toStringTag]() {
    return 'PrismaClientExtensionError'
  }
}

function getTitleFromExtensionName(extensionName: string | undefined) {
  if (extensionName) {
    return `Error caused by extension "${extensionName}"`
  }
  return 'Error caused by an extension'
}

function getMessageFromCause(cause: unknown) {
  if (cause instanceof Error) {
    return cause.message
  }
  return `${cause}`
}

export function wrapExtensionCallback<ResultT, ThisT, Args extends unknown[]>(
  name: string | undefined,
  fn: (this: ThisT, ...args: Args) => ResultT,
): (this: ThisT, ...args: Args) => ResultT {
  return function (...args) {
    try {
      const result = fn.apply(this, args)
      if (isPromiseLike(result)) {
        return result.then(undefined, (error) => Promise.reject(new PrismaClientExtensionError(name, error))) as ResultT
      }
      return result
    } catch (error) {
      throw new PrismaClientExtensionError(name, error)
    }
  }
}

export function wrapAllExtensionCallbacks(
  name: string | undefined,
  object: Record<string, (...args: unknown[]) => unknown> | undefined,
) {
  if (!object) {
    return object
  }
  return mapObjectValues(object, (prop) =>
    typeof prop === 'function' ? wrapExtensionCallback(name, prop as (...args: unknown[]) => unknown) : prop,
  )
}
