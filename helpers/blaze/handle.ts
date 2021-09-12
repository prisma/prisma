/**
 * Executes a function, catches exceptions, and returns any outcome.
 * @param fn to be executed
 */
function handle<R, E = Error>(fn: () => Promise<R>): Promise<R | E>
function handle<R, E = Error>(fn: () => R): R | E
function handle(fn: () => unknown): unknown {
  try {
    const result = fn()

    if (result instanceof Promise) {
      return handleAsync(result)
    }

    return result
  } catch (e: unknown) {
    return e
  }
}

async function handleAsync(promise: Promise<unknown>) {
  try {
    return await promise
  } catch (e: unknown) {
    return e
  }
}

export { handle }
