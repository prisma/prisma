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

export function wrapExtensionFn<R, Args extends unknown[]>(
  name: string | undefined,
  fn: (...args: Args) => R,
): (...args: Args) => R {
  return (...args) => {
    try {
      return fn(...args)
    } catch (error) {
      throw new PrismaClientExtensionError(name, error)
    }
  }
}
