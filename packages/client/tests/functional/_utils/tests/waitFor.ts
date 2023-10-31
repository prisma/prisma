import { performance } from 'perf_hooks'

import { delay } from './delay'

const MAX_WAIT = 5000

/**
 * Waits until provided callback stops throwing.
 * If it does not happen within MAX_WAIT, throws last thrown error
 *
 * Simplified version of testing-library's waitFor that works without DOM
 * https://testing-library.com/docs/dom-testing-library/api-async/#waitfor
 * @param cb
 */
export async function waitFor<T>(cb: () => T | Promise<T>): Promise<T> {
  const start = performance.now()
  let error: unknown = null

  while (performance.now() - start < MAX_WAIT) {
    try {
      return await cb()
    } catch (e) {
      error = e
      await delay(100)
    }
  }

  throw error
}
