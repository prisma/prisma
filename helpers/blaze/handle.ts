function handleSync<R, E = Error>(fn: () => R): R | E {
  try {
    return fn()
  } catch (e: unknown) {
    return e as E
  }
}

async function handleAsync<R, E = Error>(fn: () => Promise<R> | R): Promise<R | E> {
  try {
    return await fn()
  } catch (e: unknown) {
    return e as E
  }
}

/**
 * Executes a function, catches exceptions, and returns any outcome.
 * @param fn to be executed
 */
const handle = handleSync as typeof handleSync & {
  async: typeof handleAsync
}

handle.async = handleAsync

export { handle }
