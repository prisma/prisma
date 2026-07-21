import { afterEach, describe, expect, test, vi } from 'vitest'

import { timeout } from '../utils/prompt-timeout'

describe('timeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('resolves with the value when the promise settles in time', async () => {
    await expect(timeout(Promise.resolve('answer'), 1000)).resolves.toBe('answer')
  })

  test('rejects with the original error when the promise rejects', async () => {
    const error = new Error('stdin closed')
    await expect(timeout(Promise.reject(error), 1000)).rejects.toBe(error)
  })

  test('resolves with undefined when the promise does not settle in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const resultPromise = timeout(new Promise<string>(() => {}), 30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    await expect(resultPromise).resolves.toBeUndefined()
  })

  // A timer left behind would keep the event loop alive for the full timeout and
  // delay the exit of the command that showed the prompt.
  test('clears the timer once the promise settles', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    await timeout(Promise.resolve('answer'), 30_000)
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.getTimerCount()).toBe(0)
  })

  test('clears the timer once the promise rejects', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    await expect(timeout(Promise.reject(new Error('nope')), 30_000)).rejects.toThrow('nope')
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.getTimerCount()).toBe(0)
  })
})
