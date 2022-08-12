import { callOnce } from './callOnce'

test('returns the result correctly', async () => {
  const wrapper = callOnce(jest.fn().mockResolvedValue('hello'))
  await expect(wrapper()).resolves.toBe('hello')
})

test('forwards the arguments correctly', async () => {
  const wrapper = callOnce((x: number) => Promise.resolve(x + 1))
  await expect(wrapper(2)).resolves.toBe(3)
})

test('сalls wrapped function only once before promise resolves', async () => {
  const wrapped = jest.fn().mockResolvedValue('hello')
  const wrapper = callOnce(wrapped)
  void wrapper()
  void wrapper()
  await wrapper()

  expect(wrapped).toBeCalledTimes(1)
})

test('caches the result', async () => {
  const wrapped = jest.fn().mockResolvedValue('hello')
  const wrapper = callOnce(wrapped)
  await wrapper()
  await wrapper()
  const result = await wrapper()

  expect(wrapped).toBeCalledTimes(1)
  expect(result).toBe('hello')
})
