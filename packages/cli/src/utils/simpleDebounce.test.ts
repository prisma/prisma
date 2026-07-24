import { simpleDebounce } from './simpleDebounce'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('simpleDebounce', () => {
  test('executes immediately if not running', async () => {
    const fn = jest.fn().mockResolvedValue('result')
    const debounced = simpleDebounce(fn)

    await debounced('arg1')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  test('queues last call if running', async () => {
    let resolveFirst: (value?: any) => void
    const firstCallPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })

    const fn = jest.fn().mockImplementation(async (arg) => {
      if (arg === 'first') {
        await firstCallPromise
      }
    })

    const debounced = simpleDebounce(fn)

    // First call starts execution
    const p1 = debounced('first')

    // Second call should be queued
    void debounced('second')

    // Third call should replace second in queue
    void debounced('third')

    // Finish first call
    resolveFirst!()
    await p1

    // Wait for queue processing
    await sleep(10)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 'first')
    expect(fn).toHaveBeenNthCalledWith(2, 'third')
  })

  test('handles errors gracefully', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'))
    const debounced = simpleDebounce(fn)
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await debounced()

    expect(fn).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
