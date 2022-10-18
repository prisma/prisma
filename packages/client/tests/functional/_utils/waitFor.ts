import { performance } from 'perf_hooks'

const MAX_WAIT = 5000

/**
 * Waits until provided callback stops throwing.
 * If it does not happen within MAX_WAIT, throws last thrown error
 *
 * Simplified version of testing-library's waitFor that works without DOM
 * https://testing-library.com/docs/dom-testing-library/api-async/#waitfor
 * @param cb
 */
export async function waitFor(cb: () => void | Promise<void>) {
  const start = performance.now()
  let error: unknown = null

  while (performance.now() - start < MAX_WAIT) {
    try {
      await cb()
      return
    } catch (e) {
      error = e
      await delay(100)
    }
  }

  throw error
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
